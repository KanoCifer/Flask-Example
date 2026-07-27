package weread

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
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
}

// Repositoryer 是 weread 数据访问接口。
type Repositoryer interface {
	CreateUserToken(ctx context.Context, userID string, token string) error
	GetUserToken(ctx context.Context, userID string) (string, error)
}

const (
	shelfPath = "/shelf/sync"
	bookPath  = "/book/info"
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

// FetchUserShelf 获取用户微信读书书架数据，解析为 DTO 返回，不落库 MongoDB。
func (s *Service) FetchUserShelf(ctx context.Context, userID string) (*dto.WereadShelfResponse, error) {
	const cacheTTL = 5 * time.Minute
	cacheKey := "weread:shelf:" + userID
	raw, err := s.client.SendRequest(ctx, cacheKey, cacheTTL, userID, shelfPath)
	if err != nil {
		return nil, err
	}

	var resp dto.WereadShelfResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("%w: parse shelf response: %w", ErrUpstream, err)
	}
	return &resp, nil
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
