package weread

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"maps"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/domain/weread/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
	"github.com/redis/go-redis/v9"
)

// Reader 是 weread 业务接口，handler 层依赖此接口。
type Reader interface {
	CreateUserToken(ctx context.Context, userID string, token string) error
	FetchUserShelf(ctx context.Context, userID string) (*dto.WereadShelfResponse, error)
	FetchBookInfo(ctx context.Context, userID string, bookID string) (*dto.WereadBookResponse, error)
	FetchBookProgress(ctx context.Context, userID string, bookID string, refresh bool) (*dto.WereadBookProgress, error)
	FetchReadDetail(ctx context.Context, userID string, mode string, baseTime *int) (*dto.ReadDetailSnapshot, error)
	FetchYearlyHeatmap(ctx context.Context, userID string, year *int) (map[string]int, error)
	FetchBooksRecommend(ctx context.Context, userID string, count, maxIdx int) ([]dto.BookRecommendItem, error)
}

// Repositoryer 是 weread 数据访问接口。
type Repositoryer interface {
	CreateUserToken(ctx context.Context, userID string, token string) error
	GetUserToken(ctx context.Context, userID string) (string, error)
}

const (
	shelfPath        = "/shelf/sync"
	bookPath         = "/book/info"
	bookProgressPath = "/book/getprogress"
	readDetailPath   = "/readdata/detail"
	recommendPath    = "/book/recommend"
)

// Service 实现 Reader，组合 HTTP 客户端与缓存。
type Service struct {
	repo   Repositoryer
	client *Client
}

// New 构造 Service。opts 允许注入测试配置（如 WithBaseURL）。
func New(httpCli *httpclient.Client, redisCli *redis.Client, repo Repositoryer, opts ...ClientOption) *Service {
	return &Service{
		repo:   repo,
		client: NewClient(httpCli, redisCli, repo, opts...),
	}
}

// 导入用户API Key
func (s *Service) CreateUserToken(ctx context.Context, userID string, token string) error {
	pattern := regexp.MustCompile(`^wrk\-`)
	if !pattern.MatchString(token) {
		return errs.ErrInvaildWereadToken
	}

	return s.repo.CreateUserToken(ctx, userID, token)
}

// FetchUserShelf 获取用户微信读书书架数据，解析上游原生结构后转换为前端契约返回，不落库 MongoDB。
func (s *Service) FetchUserShelf(ctx context.Context, userID string) (*dto.WereadShelfResponse, error) {
	const cacheTTL = 5 * time.Minute
	cacheKey := "weread:shelf:" + userID
	raw, err := s.client.SendRequest(ctx, cacheKey, cacheTTL, userID, shelfPath)
	if err != nil {
		return nil, err
	}

	var upstream dto.WereadShelfRaw
	if err := json.Unmarshal(raw, &upstream); err != nil {
		return nil, fmt.Errorf("%w: parse shelf response: %w", ErrUpstream, err)
	}
	return dto.ParseShelfRaw(upstream), nil
}

func (s *Service) FetchBookInfo(ctx context.Context, userID string, bookID string) (*dto.WereadBookResponse, error) {
	cacheTTL := 24 * time.Hour
	extra := map[string]any{"bookId": bookID}
	raw, err := s.client.SendRequest(ctx, "weread:book:"+bookID, cacheTTL, userID, bookPath, extra)
	if err != nil {
		return nil, err
	}
	var rawResp wereadBookRaw
	if err := json.Unmarshal(raw, &rawResp); err != nil {
		return nil, fmt.Errorf("%w: parse book response: %w", ErrUpstream, err)
	}
	return rawResp.toDTO(time.Now().UTC()), nil
}

// FetchBookProgress 获取单本书阅读进度，Redis 10 分钟缓存，不写 Mongo。
// refresh=true 先清旧缓存再走 SendRequest，强制触发上游拉取并回写缓存。
// 上游 /book/getprogress 有两种返回形态：
//   - 顶层 {bookId, timestamp, book: {...progress fields}}  → 解析 .book
//   - 直平 {...progress fields}                              → 直接解析
//
// 对齐 Python stats.py fetch_progress_by_book_id。
func (s *Service) FetchBookProgress(ctx context.Context, userID string, bookID string, refresh bool) (*dto.WereadBookProgress, error) {
	const cacheTTL = 10 * time.Minute
	cacheKey := "weread:book-progress:" + userID + ":" + bookID

	if refresh {
		if err := s.client.InvalidateCache(ctx, cacheKey); err != nil {
			slog.WarnContext(ctx, "weread invalidate book-progress cache", "cache_key", cacheKey, "error", err)
		}
	}

	extra := map[string]any{"bookId": bookID}
	raw, err := s.client.SendRequest(ctx, cacheKey, cacheTTL, userID, bookProgressPath, extra)
	if err != nil {
		return nil, err
	}

	// 上游有时把进度字段包在 raw["book"] 里,顶多只剩 bookId/timestamp;
	// 先按嵌套结构尝试,解析失败/无 book 字段时回退直平结构。
	var wrapped struct {
		Book json.RawMessage `json:"book"`
	}
	if err := json.Unmarshal(raw, &wrapped); err == nil && len(wrapped.Book) > 0 && string(wrapped.Book) != "null" {
		var p dto.WereadBookProgress
		if err := json.Unmarshal(wrapped.Book, &p); err != nil {
			return nil, fmt.Errorf("%w: parse progress.book: %w", ErrUpstream, err)
		}
		return &p, nil
	}

	var p dto.WereadBookProgress
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, fmt.Errorf("%w: parse progress: %w", ErrUpstream, err)
	}
	return &p, nil
}

// FetchReadDetail 获取指定 mode + 周期的阅读统计快照。
// mode: weekly | monthly | annually | overall。
// baseTime 为 nil 表示当前周期；overall 模式忽略 baseTime。
// 对齐 Python stats.py orchestra_read_detail。
func (s *Service) FetchReadDetail(ctx context.Context, userID string, mode string, baseTime *int) (*dto.ReadDetailSnapshot, error) {
	const cacheTTL = 1 * time.Hour

	baseTimeOrZero := 0
	if baseTime != nil {
		baseTimeOrZero = *baseTime
	}
	cacheKey := "weread:readdetail:" + userID + ":" + mode + ":" + strconv.Itoa(baseTimeOrZero)

	extra := map[string]any{"mode": mode}
	if baseTime != nil && mode != "overall" {
		extra["baseTime"] = *baseTime
	}

	raw, err := s.client.SendRequest(ctx, cacheKey, cacheTTL, userID, readDetailPath, extra)
	if err != nil {
		return nil, err
	}

	var snapshot dto.ReadDetailSnapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		return nil, fmt.Errorf("%w: parse readdetail response: %w", ErrUpstream, err)
	}
	snapshot.FetchedAt = time.Now().UTC().Format(time.RFC3339)
	return &snapshot, nil
}

// FetchYearlyHeatmap 拉取用户指定年份每日的阅读时长(秒)。
// 实现：按月并发拉取 mode=monthly，合并 12 个月的 readTimes 为全年日级映射。
// year 为 nil 走当前年。对齐 Python stats.py fetch_yearly_heatmap。
func (s *Service) FetchYearlyHeatmap(ctx context.Context, userID string, year *int) (map[string]int, error) {
	now := time.Now()
	targetYear := now.Year()
	if year != nil {
		targetYear = *year
	}

	// 计算该年每个月初的 unix 秒时间戳（对齐 Python _calc_timestamp_to_fetch）
	lastMonth := 12
	if targetYear == now.Year() {
		lastMonth = int(now.Month())
	}
	timestamps := make([]int, 0, lastMonth)
	for m := 1; m <= lastMonth; m++ {
		ts := time.Date(targetYear, time.Month(m), 1, 0, 0, 0, 0, now.Location())
		timestamps = append(timestamps, int(ts.Unix()))
	}

	// 按月并发拉取，单月失败降级继续
	var wg sync.WaitGroup
	results := make([]map[string]int, len(timestamps))
	for i, ts := range timestamps {
		wg.Add(1)
		go func(idx int, baseTime int) {
			defer wg.Done()
			extra := map[string]any{"mode": "monthly", "baseTime": baseTime}
			raw, err := s.client.SendRequest(ctx, "", 0, userID, readDetailPath, extra)
			if err != nil {
				slog.WarnContext(ctx, "heatmap month fetch failed", "baseTime", baseTime, "error", err)
				return
			}
			var monthSnap dto.ReadDetailSnapshot
			if err := json.Unmarshal(raw, &monthSnap); err != nil {
				slog.WarnContext(ctx, "heatmap month parse failed", "baseTime", baseTime, "error", err)
				return
			}
			results[idx] = monthSnap.ReadTimes
		}(i, ts)
	}
	wg.Wait()

	// 合并各月 readTimes
	merged := make(map[string]int)
	for _, readTimes := range results {
		if readTimes == nil {
			continue
		}
		maps.Copy(merged, readTimes)
	}
	return merged, nil
}

// FetchBooksRecommend 从微信读书远端获取推荐阅读的书籍。
// 远端可能直接返回 list，也可能包一层 {"books": [...]}。
// 对齐 Python recommend.py fetch_books_recommend。
func (s *Service) FetchBooksRecommend(ctx context.Context, userID string, count, maxIdx int) ([]dto.BookRecommendItem, error) {
	cacheKey := "weread:recommend:" + userID + ":" + strconv.Itoa(count) + ":" + strconv.Itoa(maxIdx)
	const cacheTTL = 1 * time.Hour

	extra := map[string]any{"count": count, "maxIdx": maxIdx}
	raw, err := s.client.SendRequest(ctx, cacheKey, cacheTTL, userID, recommendPath, extra)
	if err != nil {
		return nil, err
	}

	// 兼容两种上游形态：直接 list 或 {"books": [...]}
	var items []map[string]any
	if err := json.Unmarshal(raw, &items); err != nil {
		var wrapped struct {
			Books []map[string]any `json:"books"`
		}
		if err := json.Unmarshal(raw, &wrapped); err != nil {
			return nil, fmt.Errorf("%w: parse recommend response: %w", ErrUpstream, err)
		}
		items = wrapped.Books
	}

	out := make([]dto.BookRecommendItem, 0, len(items))
	for _, item := range items {
		book, _ := item["book"].(map[string]any)
		if book == nil {
			book = item
		}
		cover, _ := book["cover"].(string)
		out = append(out, dto.BookRecommendItem{
			BookId:       strField(book, "bookId"),
			Title:        strField(book, "title"),
			Author:       strField(book, "author"),
			Cover:        optStrPtr(cover),
			Reason:       strField(item, "reason"),
			ReadingCount: intField(item, "readingCount"),
			SearchIdx:    intField(item, "searchIdx"),
			NewRating:    intField(item, "newRating"),
		})
	}
	return out, nil
}

// strField 从 map 中取字符串字段，缺失返回空串。
func strField(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

// intField 从 map 中取整数字段，缺失/类型不符返回 0。
func intField(m map[string]any, key string) int {
	switch v := m[key].(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case json.Number:
		n, _ := v.Int64()
		return int(n)
	default:
		return 0
	}
}

// optStrPtr 将空串转为 nil 指针，非空返回指针（用于 omitempty 字段）。
func optStrPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// wereadBookRaw 是微信读书 /book/info 原生响应的字段结构。
// 字段名与 API 返回一致，再经 toDTO 映射为前端/契约字段（对齐 Python map_book_info）。
type wereadBookRaw struct {
	BookId           string         `json:"bookId"`
	Title            string         `json:"title"`
	Author           string         `json:"author"`
	Translator       string         `json:"translator"`
	Cover            string         `json:"cover"`
	Intro            string         `json:"intro"`
	Category         string         `json:"category"`
	Publisher        string         `json:"publisher"`
	PublishTime      string         `json:"publishTime"`
	ISBN             string         `json:"isbn"`
	WordCount        int            `json:"wordCount"`
	NewRating        float64        `json:"newRating"`
	NewRatingCount   int            `json:"newRatingCount"`
	NewRatingDetails map[string]int `json:"newRatingDetail"`
}

// toDTO 将原生响应映射为前端契约 DTO（bookId→id、intro→introduction、newRatingDetail→newRatingDetails）。
func (r wereadBookRaw) toDTO(fetchedAt time.Time) *dto.WereadBookResponse {
	return &dto.WereadBookResponse{
		ID:               r.BookId,
		Title:            r.Title,
		Author:           r.Author,
		Translator:       r.Translator,
		Cover:            r.Cover,
		Introduction:     r.Intro,
		Category:         r.Category,
		Publisher:        r.Publisher,
		PublishTime:      r.PublishTime,
		ISBN:             r.ISBN,
		WordCount:        r.WordCount,
		NewRating:        r.NewRating,
		NewRatingCount:   r.NewRatingCount,
		NewRatingDetails: r.NewRatingDetails,
		FetchedAt:        fetchedAt,
	}
}
