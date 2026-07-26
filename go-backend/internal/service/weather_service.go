package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
	"github.com/KanoCifer/kuroome-blog/pkg/qweather"
)

type Weatherer interface {
	GetTide(ctx context.Context, harbor, date string) (json.RawMessage, bool, error)

	GetCurrent(ctx context.Context, location, locationID *string) (json.RawMessage, error)
	GetHourly(ctx context.Context, hours int, location, locationID *string) (json.RawMessage, error)
	GetForecast(ctx context.Context, days int, location, locationID *string) (json.RawMessage, error)
	GetIndices(ctx context.Context, location, locationID *string) (json.RawMessage, error)
	GetPOI(ctx context.Context, location string) (json.RawMessage, error)
	GetNearbyTSTA(ctx context.Context, location string) (map[string]string, error)

	GetFullWeatherData(ctx context.Context, location string) (*dto.FullWeatherData, error)
}

type WeatherService struct {
	qw *qweatherClient
}

func NewWeatherService(
	http *httpclient.Client,
	redis *redis.Client,
	cfg config.WeatherConfig,
	signer *qweather.Signer,
) *WeatherService {
	return &WeatherService{
		qw: newQWeatherClient(http, redis, cfg.QweatherBaseURL, signer),
	}
}

// GetTide 复用 qweatherClient 的缓存层，并在外层独立 peek redis 以
// 返回 (data, from_cache) 元组，与 Python 端行为一致。
func (s *WeatherService) GetTide(ctx context.Context, harbor, date string) (json.RawMessage, bool, error) {
	cacheKey := fmt.Sprintf("qweather:tide:%s:%s", harbor, date)

	if s.qw.redis != nil {
		cached, err := s.qw.redis.Get(ctx, cacheKey).Bytes()
		if err == nil && len(cached) > 0 {
			return cached, true, nil
		}
	}

	data, err := s.qw.Get(ctx, "/v7/ocean/tide",
		map[string]string{"location": harbor, "date": date},
		cacheKey, 12*time.Hour,
	)
	return data, false, err
}

func (s *WeatherService) GetCurrent(ctx context.Context, location, locationID *string) (json.RawMessage, error) {
	locValue, params, err := s.qw.ResolveLocation(location, locationID)
	if err != nil {
		return nil, err
	}
	return s.qw.Get(ctx, "/v7/weather/now", params,
		"qweather:current:"+locValue, 10*time.Minute)
}

func (s *WeatherService) GetHourly(ctx context.Context, hours int, location, locationID *string) (json.RawMessage, error) {
	locValue, params, err := s.qw.ResolveLocation(location, locationID)
	if err != nil {
		return nil, err
	}
	return s.qw.Get(ctx, fmt.Sprintf("/v7/weather/%dh", hours), params,
		"qweather:hourly:"+locValue, 30*time.Minute)
}

func (s *WeatherService) GetForecast(ctx context.Context, days int, location, locationID *string) (json.RawMessage, error) {
	locValue, params, err := s.qw.ResolveLocation(location, locationID)
	if err != nil {
		return nil, err
	}
	return s.qw.Get(ctx, fmt.Sprintf("/v7/weather/%dd", days), params,
		"qweather:forecast:"+locValue+":"+fmt.Sprintf("%dd", days), 1*time.Hour)
}

func (s *WeatherService) GetIndices(ctx context.Context, location, locationID *string) (json.RawMessage, error) {
	locValue, params, err := s.qw.ResolveLocation(location, locationID)
	if err != nil {
		return nil, err
	}
	params["type"] = "4"
	return s.qw.Get(ctx, "/v7/indices/1d", params,
		"qweather:indices:"+locValue, 12*time.Hour)
}

func (s *WeatherService) GetPOI(ctx context.Context, location string) (json.RawMessage, error) {
	return s.qw.Get(ctx, "/geo/v2/poi/lookup",
		map[string]string{"location": location, "type": "scenic"},
		fmt.Sprintf("qweather:poi:%s:scenic", location), 24*time.Hour)
}

func (s *WeatherService) GetNearbyTSTA(ctx context.Context, location string) (map[string]string, error) {
	data, err := s.qw.Get(ctx, "/geo/v2/poi/lookup",
		map[string]string{"location": location, "type": "TSTA"},
		fmt.Sprintf("qweather:tsta:%s", location), 24*time.Hour)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		POI []struct {
			ID string `json:"id"`
		} `json:"poi"`
	}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return nil, fmt.Errorf("weather: parse tsta: %w", err)
	}
	if len(parsed.POI) == 0 {
		return map[string]string{}, nil
	}
	return map[string]string{"id": parsed.POI[0].ID}, nil
}

// GetFullWeatherData 组合全部 5 个 endpoint，保留 Python 端 try/except 语义。
// 任何 Weather 域错误向上抛 ErrUpstream / ErrUnavailable；
// 兜底意外异常包装为 ErrUnavailable 风格的 503。
func (s *WeatherService) GetFullWeatherData(ctx context.Context, location string) (*dto.FullWeatherData, error) {
	// POI 解析
	poiData, err := s.GetPOI(ctx, location)
	if err != nil {
		return nil, err
	}
	var poiParsed struct {
		POI []struct {
			Name string `json:"name"`
			ID   string `json:"id"`
		} `json:"poi"`
	}
	if err := json.Unmarshal(poiData, &poiParsed); err != nil {
		return nil, fmt.Errorf("weather: parse poi: %w", err)
	}
	var poiName, poiID string
	if len(poiParsed.POI) > 0 {
		poiName = poiParsed.POI[0].Name
		poiID = poiParsed.POI[0].ID
	}
	slog.InfoContext(ctx, "POI lookup returned",
		"location", location, "name", poiName, "id", poiID)

	// 潮汐站点（失败容错）
	var tstaID string
	tstaInfo, err := s.GetNearbyTSTA(ctx, location)
	if err != nil {
		slog.ErrorContext(ctx, "fetch nearby TSTA failed",
			"location", location, "error", err.Error())
	} else if id, ok := tstaInfo["id"]; ok && id != "" {
		tstaID = id
		slog.InfoContext(ctx, "found nearby TSTA", "id", tstaID)
	} else {
		slog.WarnContext(ctx, "no nearby TSTA", "location", location)
	}

	if poiName == "" && poiID == "" {
		return nil, fmt.Errorf("%w: no POI for %s", ErrUpstream, location)
	}

	// 5 个 endpoint 并发获取
	current, err := s.GetCurrent(ctx, &location, nil)
	if err != nil {
		return nil, err
	}
	hourly, err := s.GetHourly(ctx, 24, &location, nil)
	if err != nil {
		return nil, err
	}
	daily, err := s.GetForecast(ctx, 3, &location, nil)
	if err != nil {
		return nil, err
	}
	dateStr := time.Now().UTC().Format("20060102")
	harbor := tstaID
	if harbor == "" {
		harbor = "P2352"
	}
	tide, _, err := s.GetTide(ctx, harbor, dateStr)
	if err != nil {
		return nil, err
	}
	indices, err := s.GetIndices(ctx, &location, nil)
	if err != nil {
		return nil, err
	}

	slog.DebugContext(ctx, "fetched full weather data",
		"location", location, "poi", poiName)

	return &dto.FullWeatherData{
		Current:      current,
		Hourly:       hourly,
		Daily:        daily,
		Tide:         tide,
		Indices:      indices,
		LocationName: poiName,
		POIID:        poiID,
	}, nil
}
