package service

import (
	"context"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/domain/blog/errs"
	"github.com/KanoCifer/kuroome-blog/internal/model"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
)

// AdminRepositoryer 定义 admin 后台对 posts 集合的读写契约。
type AdminRepositoryer interface {
	CreatePost(ctx context.Context, post *document.Post) (string, error)
	GetPostByID(ctx context.Context, id string) (*document.Post, error)
	UpdatePostByID(ctx context.Context, id string, update bson.M) error
	DeletePostByID(ctx context.Context, id string) error
	ListPostViewsData(ctx context.Context) ([]document.PostViewData, error)
}

// VisitorRepositoryer 定义 visitor_track 表的写入契约。
type VisitorRepositoryer interface {
	Insert(ctx context.Context, v *model.VisitorTrack) error
}

// Adminer 定义 admin 后台的用例契约。
type Adminer interface {
	AddPost(ctx context.Context, post dto.PostRequest) (id string, err error)
	UpdatePost(ctx context.Context, id string, post dto.PostUpdate) error
	DeletePost(ctx context.Context, id string) error
	TrackVisitor(ctx context.Context, data dto.VisitorResponse) error
	ListPostViewsData(ctx context.Context) ([]dto.PostViewResponse, error)
}

type adminService struct {
	repo    AdminRepositoryer
	visitor VisitorRepositoryer
	redis   *redis.Client
}

func NewAdminService(
	repo AdminRepositoryer,
	visitor VisitorRepositoryer,
	redis *redis.Client,
) *adminService {
	return &adminService{
		repo:    repo,
		visitor: visitor,
		redis:   redis,
	}
}

// ptrIf 在字符串非空时返回其指针，否则返回 nil。
// 用于把前端上报的空字符串正确入库为 NULL（schema 已改为 nullable），
// 与 parse-ua 脚本下线后"字段缺失即无意义"的语义对齐。
func ptrIf(s string) *string {
	if s != "" {
		return &s
	}
	return nil
}

func (s *adminService) AddPost(ctx context.Context, post dto.PostRequest) (string, error) {
	doc := &document.Post{
		Title:    post.Title,
		Body:     post.Body,
		Tags:     post.Tags,
		IsPinned: boolToInt(post.IsPinned),
	}
	if post.Summary != "" {
		doc.Summary = &post.Summary
	}
	if post.Cover != "" {
		doc.Cover = &post.Cover
	}
	id, err := s.repo.CreatePost(ctx, doc)
	if err != nil {
		return "", err
	}
	s.invalidateBlogCache(ctx)
	return id, nil
}

// UpdatePost 部分更新文章 —— 与 DevTaskService.Update / FishService.UpdateFishingSpot 同模式：
// 只把前端实际传了的字段塞进 bson.M，避免未传字段被静默覆盖为零值。
// updated_at 由 service 层刷新（不再由 repo 负责），与项目其它 update 路径对齐。
func (s *adminService) UpdatePost(ctx context.Context, id string, post dto.PostUpdate) error {
	if _, err := bson.ObjectIDFromHex(id); err != nil {
		return blogerrs.ErrInvalidPostID
	}
	_, err := s.repo.GetPostByID(ctx, id)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return blogerrs.ErrPostNotFound
		}
		return err
	}

	update := bson.M{}
	if post.Title != nil {
		update["title"] = *post.Title
	}
	if post.Body != nil {
		update["body"] = *post.Body
	}
	if post.Summary != nil {
		update["summary"] = *post.Summary
	}
	if post.Cover != nil {
		update["cover"] = *post.Cover
	}
	if post.Tags != nil {
		update["tags"] = *post.Tags
	}
	if post.IsPinned != nil {
		update["is_pinned"] = boolToInt(*post.IsPinned)
	}
	if len(update) == 0 {
		return nil
	}
	update["updated_at"] = time.Now().UTC()

	if err := s.repo.UpdatePostByID(ctx, id, update); err != nil {
		return err
	}
	s.invalidateBlogCache(ctx)
	return nil
}

func (s *adminService) DeletePost(ctx context.Context, id string) error {
	if _, err := bson.ObjectIDFromHex(id); err != nil {
		return blogerrs.ErrInvalidPostID
	}
	_, err := s.repo.GetPostByID(ctx, id)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return blogerrs.ErrPostNotFound
		}
		return err
	}

	if err := s.repo.DeletePostByID(ctx, id); err != nil {
		return err
	}
	s.invalidateBlogCache(ctx)
	return nil
}

func (s *adminService) ListPostViewsData(ctx context.Context) ([]dto.PostViewResponse, error) {
	docs, err := s.repo.ListPostViewsData(ctx)
	if err != nil {
		return nil, err
	}
	data := make([]dto.PostViewResponse, 0, len(docs))
	for _, d := range docs {
		data = append(data, dto.PostViewResponse{Title: d.Title, Views: d.Views})
	}
	return data, nil
}

// TrackVisitor 把一次访问同步写入 PostgreSQL。
//
// 历史：前端曾经经 Redis app:migration_queue 缓冲，再由 Python taskiq
// 定时任务消费落库——那条链路久经失败（缺显式 commit、browser 列约束、
// DTO 与 schema 不对齐），所以此处改为 Go 端直写，不再依赖 Redis 跨语言消费。
// visit_time 不使用前端传的值，由 PG default current_timestamp 填充。
func (s *adminService) TrackVisitor(ctx context.Context, data dto.VisitorResponse) error {
	track := &model.VisitorTrack{
		VisitorID:        data.VisitorID,
		PageURL:          data.PageURL,
		PagePath:         data.PagePath,
		Referrer:         ptrIf(data.Referrer),
		Browser:          ptrIf(data.Browser),
		ScreenResolution: ptrIf(data.ScreenResolution),
		Language:         ptrIf(data.Language),
		IPAddress:        data.IpAddress,
		BrowserName:      ptrIf(data.BrowserName),
		BrowserVersion:   ptrIf(data.BrowserVersion),
		OSName:           ptrIf(data.OSName),
		OSVersion:        ptrIf(data.OSVersion),
		CPU:              ptrIf(data.Cpu),
		DeviceType:       ptrIf(data.DeviceType),
	}
	return s.visitor.Insert(ctx, track)
}

func (s *adminService) invalidateBlogCache(ctx context.Context) {
	if s.redis == nil {
		return
	}
	keys := []string{"cache:get_blogs", "cache:get_blog_post", "cache:get_blog"}
	s.redis.Del(ctx, keys...)
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
