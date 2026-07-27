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
	raw, err := s.client.SendRequest(ctx, "weread:book:"+bookID, cacheTTL, userID, bookPath)
	if err != nil {
		return nil, err
	}
	var resp dto.WereadBookResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("%w: parse book response: %w", ErrUpstream, err)
	}
	return &resp, nil
}
