package service

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/domain/blog/errs"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
)

// BlogRepositoryer 定义博客读表面对 posts 集合的读写契约。
type BlogRepositoryer interface {
	ListPosts(ctx context.Context, page, perPage int, search string) ([]document.Post, int64, error)
	AggregateTagCounts(ctx context.Context) ([]document.TagCount, error)
	GetPostByID(ctx context.Context, id string) (*document.Post, error)
	IncrementViews(ctx context.Context, id string) error
	IncrementLikes(ctx context.Context, id string) (int, error)
	ListPostsByTag(ctx context.Context, tag string, page, perPage int) ([]document.Post, int64, error)
}

// Bloger 定义博客读表面的用例契约。
type Bloger interface {
	ListPosts(ctx context.Context, page int, search string) (*dto.BlogListResponse, error)
	GetPost(ctx context.Context, id string) (*dto.PostResponse, error)
	IncrementViews(ctx context.Context, id string) error
	LikePost(ctx context.Context, id string) (int, error)
	ListTags(ctx context.Context) ([]dto.TagResponse, error)
	ListPostsByTag(ctx context.Context, tag string, page, perPage int) (*dto.PostsByTagResponse, error)
}

type blogService struct {
	repo BlogRepositoryer
}

func NewBlogService(repo BlogRepositoryer) *blogService {
	return &blogService{repo: repo}
}

func pagination(page, perPage, total int) dto.Pagination {
	pages := 0
	if perPage > 0 {
		pages = (total + perPage - 1) / perPage
	}
	prev, next := (*int)(nil), (*int)(nil)
	if page > 1 {
		v := page - 1
		prev = &v
	}
	if page < pages {
		v := page + 1
		next = &v
	}
	return dto.Pagination{
		Page:    page,
		PerPage: perPage,
		Total:   total,
		Pages:   pages,
		HasPrev: page > 1,
		HasNext: page < pages,
		PrevNum: prev,
		NextNum: next,
	}
}

// ListPosts 分页列出博客（含标签聚合）—— 与 Python get_blogs 对齐。
func (s *blogService) ListPosts(ctx context.Context, page int, search string) (*dto.BlogListResponse, error) {
	if page < 1 {
		page = 1
	}
	const perPage = 10

	posts, total, err := s.repo.ListPosts(ctx, page, perPage, search)
	if err != nil {
		slog.ErrorContext(ctx, "list posts", "error", err)
		return nil, err
	}

	tagCounts, err := s.repo.AggregateTagCounts(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "aggregate tag counts", "error", err)
		return nil, err
	}

	tags := make([]dto.TagResponse, 0, len(tagCounts))
	for _, tc := range tagCounts {
		tags = append(tags, dto.TagResponse{Name: tc.Name, Count: tc.Count})
	}

	return &dto.BlogListResponse{
		Posts:      dto.ToPostList(posts),
		Tags:       tags,
		Pagination: pagination(page, perPage, int(total)),
	}, nil
}

// GetPost 按 ID 获取单篇博客 —— 与 Python get_blog_post 对齐。
func (s *blogService) GetPost(ctx context.Context, id string) (*dto.PostResponse, error) {
	if id == "" {
		return nil, blogerrs.ErrInvalidPostID
	}
	if _, err := bson.ObjectIDFromHex(id); err != nil {
		return nil, blogerrs.ErrInvalidPostID
	}

	post, err := s.repo.GetPostByID(ctx, id)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, blogerrs.ErrPostNotFound
		}
		slog.ErrorContext(ctx, "get post by id", "error", err, "id", id)
		return nil, err
	}
	out := dto.ToPostResponse(*post)
	return &out, nil
}

// IncrementViews 原子递增单篇文章的浏览量。
// 调用方以 fire-and-forget goroutine 触发，不阻塞读取路径。
func (s *blogService) IncrementViews(ctx context.Context, id string) error {
	if id == "" {
		return blogerrs.ErrInvalidPostID
	}
	return s.repo.IncrementViews(ctx, id)
}

// LikePost 原子递增单篇文章的喜欢数并返回递增后的值。
// 一次性表态：调用方（handler / 客户端）负责幂等，服务端不做重复判定。
func (s *blogService) LikePost(ctx context.Context, id string) (int, error) {
	if id == "" {
		return 0, blogerrs.ErrInvalidPostID
	}
	if _, err := bson.ObjectIDFromHex(id); err != nil {
		return 0, blogerrs.ErrInvalidPostID
	}
	return s.repo.IncrementLikes(ctx, id)
}

// ListTags 列出所有标签及文章数 —— 与 Python list_tags 对齐。
func (s *blogService) ListTags(ctx context.Context) ([]dto.TagResponse, error) {
	tagCounts, err := s.repo.AggregateTagCounts(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "aggregate tag counts", "error", err)
		return nil, err
	}
	tags := make([]dto.TagResponse, 0, len(tagCounts))
	for _, tc := range tagCounts {
		tags = append(tags, dto.TagResponse{Name: tc.Name, Count: tc.Count})
	}
	return tags, nil
}

// ListPostsByTag 按标签分页列出博客 —— 与 Python get_posts_by_tag 对齐。
func (s *blogService) ListPostsByTag(ctx context.Context, tag string, page, perPage int) (*dto.PostsByTagResponse, error) {
	tag = strings.TrimSpace(tag)
	if tag == "" {
		return nil, blogerrs.ErrInvalidPostID
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 10
	}

	posts, total, err := s.repo.ListPostsByTag(ctx, tag, page, perPage)
	if err != nil {
		slog.ErrorContext(ctx, "list posts by tag", "error", err, "tag", tag)
		return nil, err
	}

	return &dto.PostsByTagResponse{
		Posts:      dto.ToPostList(posts),
		Tag:        tag,
		Pagination: pagination(page, perPage, int(total)),
	}, nil
}
