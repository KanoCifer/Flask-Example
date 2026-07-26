package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/service"
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

type WeatherHandler struct {
	svc Weatherer
}

func NewWeatherHandler(svc Weatherer) *WeatherHandler {
	return &WeatherHandler{svc: svc}
}

func (h *WeatherHandler) GetTide(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		response.APIError(c, "date is required", 400)
		return
	}
	harbor := c.DefaultQuery("harbor", "P2352")

	data, fromCache, err := h.svc.GetTide(c.Request.Context(), harbor, date)
	if err != nil {
		h.respondError(c, err)
		return
	}

	msg := "Tide information retrieved successfully"
	if fromCache {
		msg = "Tide information retrieved from cache"
	}
	response.Success(c, dto.ToTideResponse(data, fromCache), msg)
}

func (h *WeatherHandler) GetFullWeather(c *gin.Context) {
	location := c.Query("location")
	if location == "" {
		response.APIError(c, "location is required", 400)
		return
	}

	start := time.Now()

	data, err := h.svc.GetFullWeatherData(c.Request.Context(), location)
	if err != nil {
		h.respondError(c, err)
		return
	}
	lag := time.Since(start)

	slog.Debug("FullWeather", "indices", string(data.Indices), "lag", lag)
	response.Success(c, data,
		"Full weather data retrieved successfully")
}

func (h *WeatherHandler) respondError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidLocation):
		response.APIError(c, "missing location or location_id", 400)
	case errors.Is(err, service.ErrUpstream):
		response.APIError(c, "qweather upstream error", 502)
	case errors.Is(err, service.ErrUnavailable):
		response.APIError(c, "qweather unavailable", 503)
	default:
		slog.ErrorContext(c.Request.Context(), "weather handler unexpected error",
			"path", c.FullPath(), "error", err.Error())
		response.APIError(c, "internal error", 500)
	}
}

func (h *WeatherHandler) RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/weather")
	g.GET("/tide", h.GetTide)
	g.GET("/full", h.GetFullWeather)
}
