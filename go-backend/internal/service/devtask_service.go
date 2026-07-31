package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"github.com/KanoCifer/kuroome-blog/internal/domain/devtask/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
	"github.com/KanoCifer/kuroome-blog/internal/repository/mongodb"
)

// DevTaskServiceer devtask 读表面 —— handler 依赖接口，便于 mock 测试。
// 所有接口一律使用 slug 作为任务标识，不暴露 ObjectID。
type DevTasker interface {
	Create(ctx context.Context, userID int, req dto.DevTaskCreate) (*dto.DevTaskResponse, error)
	GetBySlug(ctx context.Context, slug string, withParent bool) (*dto.DevTaskResponse, error)
	List(ctx context.Context, filter dto.DevTaskFilter, page, perPage int) (*dto.DevTaskListResponse, error)
	Update(ctx context.Context, slug string, req dto.DevTaskUpdate) error
	BatchUpdateStatus(ctx context.Context, slugs []string, status document.DevTaskStatus) (*BatchStatusResult, error)
	SoftDelete(ctx context.Context, slug string) error
	HardDelete(ctx context.Context, slug string) error
	FindFrontier(ctx context.Context, limit int) ([]dto.DevTaskResponse, error)
}

// DevTaskRepositoryer devtask 持久层接口 —— service 依赖接口，便于 mock 测试。
// 所有接口一律使用 slug 作为任务标识，不暴露 ObjectID。
type DevTaskRepositoryer interface {
	Create(ctx context.Context, task *document.DevTask) error
	GetBySlug(ctx context.Context, slug string) (*document.DevTask, error)
	List(ctx context.Context, filter mongodb.ListFilter, page, perPage int) ([]document.DevTask, int64, error)
	Update(ctx context.Context, slug string, fields bson.M) error
	BatchUpdateStatus(ctx context.Context, slugs []string, status document.DevTaskStatus) (int64, error)
	SoftDelete(ctx context.Context, slug string) error
	HardDelete(ctx context.Context, slug string) error
	ArchiveDoneTasks(ctx context.Context) (int64, error)
	FindFrontier(ctx context.Context, limit int) ([]document.DevTask, error)
	NextSlugSeq(ctx context.Context) (int, error)
}

type DevTaskService struct {
	repo DevTaskRepositoryer
}

func NewDevTaskService(repo DevTaskRepositoryer) *DevTaskService {
	return &DevTaskService{repo: repo}
}

var slugRegex = regexp.MustCompile(`^task-(\d+)$`)

// Create 创建任务。
func (s *DevTaskService) Create(ctx context.Context, userID int, req dto.DevTaskCreate) (*dto.DevTaskResponse, error) {
	var slug string

	if req.Slug != nil && *req.Slug != "" {
		// 自定义 slug：校验格式、seq、唯一性。
		matches := slugRegex.FindStringSubmatch(*req.Slug)
		if matches == nil {
			return nil, devtaskerrs.ErrSlugInvalidFormat
		}
		customNum := 0
		fmt.Sscanf(matches[1], "%d", &customNum)

		seq, err := s.repo.NextSlugSeq(ctx)
		if err != nil {
			return nil, err
		}
		if customNum < seq {
			return nil, devtaskerrs.ErrSlugSequenceTooSmall
		}

		// 唯一性检查（避免并发创建同一 slug）。
		if _, err := s.repo.GetBySlug(ctx, *req.Slug); err == nil {
			return nil, devtaskerrs.ErrSlugConflict
		} else if !errors.Is(err, mongo.ErrNoDocuments) {
			return nil, err
		}

		slug = *req.Slug
	} else {
		// 自增生成 slug —— counters 集合单文档 $inc 保证原子性，并发安全。
		seq, err := s.repo.NextSlugSeq(ctx)
		if err != nil {
			return nil, err
		}
		slug = fmt.Sprintf("task-%d", seq)
	}

	now := time.Now().UTC()
	task := &document.DevTask{
		UserID:             userID,
		Title:              req.Title,
		Description:        req.Description,
		Detail:             req.Detail,
		Type:               req.Type,
		Priority:           req.Priority,
		Scope:              req.Scope,
		Status:             document.StatusTriage,
		DueDate:            req.DueDate,
		CreatedAt:          now,
		UpdatedAt:          now,
		AcceptanceCriteria: req.AcceptanceCriteria,
		Constraints:        req.Constraints,
		ContextPointers:    req.ContextPointers,
		ForAgent:           req.ForAgent,
		BlockedBy:          dto.BlockedByOrEmpty(req.BlockedBy),
		Slug:               slug,
		Kind:               req.Kind,
		ParentSlug:         req.ParentSlug,
	}

	if err := s.repo.Create(ctx, task); err != nil {
		return nil, err
	}

	out := dto.ToDevTaskResponse(*task, nil)
	return &out, nil
}

// List 分页列出任务，支持过滤。
// toRepoFilter 把 handler 层的 string-based filter 转换为 repository 层的领域类型 filter。
func toRepoFilter(filter dto.DevTaskFilter) mongodb.ListFilter {
	repoFilter := mongodb.ListFilter{
		IsDeleted: filter.IncludeDeleted,
		ForAgent:  filter.ForAgent,
	}
	if filter.Status != "" {
		st := document.DevTaskStatus(filter.Status)
		repoFilter.Status = &st
	}
	if filter.Priority != "" {
		pri := document.DevTaskPriority(filter.Priority)
		repoFilter.Priority = &pri
	}
	if filter.Type != "" {
		ty := document.DevTaskType(filter.Type)
		repoFilter.Type = &ty
	}
	return repoFilter
}

func (s *DevTaskService) List(
	ctx context.Context,
	filter dto.DevTaskFilter,
	page, perPage int,
) (*dto.DevTaskListResponse, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 10
	}

	tasks, total, err := s.repo.List(ctx, toRepoFilter(filter), page, perPage)
	if err != nil {
		return nil, err
	}

	return &dto.DevTaskListResponse{
		Tasks:      dto.ToDevTaskList(tasks),
		Pagination: pagination(page, perPage, int(total)),
	}, nil
}

// Update 部分更新任务。
func (s *DevTaskService) Update(ctx context.Context, slug string, req dto.DevTaskUpdate) error {
	fields := bson.M{}
	if req.Title != nil {
		fields["title"] = *req.Title
	}
	if req.Description != nil {
		fields["description"] = *req.Description
	}
	if req.Detail != nil {
		fields["detail"] = *req.Detail
	}
	if req.Type != nil {
		fields["type"] = *req.Type
	}
	if req.Priority != nil {
		fields["priority"] = *req.Priority
	}
	if req.Scope != nil {
		fields["scope"] = *req.Scope
	}
	if req.Status != nil {
		fields["status"] = *req.Status
	}
	if req.SortOrder != nil {
		fields["sort_order"] = *req.SortOrder
	}
	if req.DueDate != nil {
		fields["due_date"] = *req.DueDate
	}
	if req.AcceptanceCriteria != nil {
		fields["acceptance_criteria"] = *req.AcceptanceCriteria
	}
	if req.Constraints != nil {
		fields["constraints"] = *req.Constraints
	}
	if req.ContextPointers != nil {
		fields["context_pointers"] = *req.ContextPointers
	}
	if req.ForAgent != nil {
		fields["for_agent"] = *req.ForAgent
	}
	if req.BlockedBy != nil {
		fields["blocked_by"] = dto.BlockedByOrEmpty(*req.BlockedBy)
	}
	if req.Kind != nil {
		fields["kind"] = *req.Kind
	}
	if req.ParentSlug != nil {
		fields["parent_slug"] = *req.ParentSlug
	}

	if len(fields) == 0 {
		return nil
	}

	// updated_at 总由 service 层刷新（与 blog service touch() 一致），
	// 确保"仅仅调了 Update"也能推进时间戳。
	fields["updated_at"] = time.Now().UTC()

	if err := s.repo.Update(ctx, slug, fields); err != nil {
		return err
	}
	return nil
}

// BatchStatusResult 批量状态修改结果 —— service 返回给 handler 的分组。
type BatchStatusResult struct {
	Succeeded []string
	Failed    map[string]string
}

// BatchUpdateStatus 批量按 slug 改状态。
// 先把 caller 传入的 slug 分成两组：DB 中能找到（未软删）的 → 调用 repo 写一次
// UpdateMany；找不到的 → 失败。返回 succeeded 列表 + 失败 map。
func (s *DevTaskService) BatchUpdateStatus(
	ctx context.Context,
	slugs []string,
	status document.DevTaskStatus,
) (*BatchStatusResult, error) {
	result := &BatchStatusResult{
		Succeeded: make([]string, 0, len(slugs)),
		Failed:    make(map[string]string),
	}

	// existence probe —— 确定每个 slug 是否能被更新。
	pending := make([]string, 0, len(slugs))
	for _, slug := range slugs {
		task, err := s.repo.GetBySlug(ctx, slug)
		if err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				result.Failed[slug] = "task not found"
				continue
			}
			return nil, err
		}
		// 已经是目标状态 → 视为成功，无需再写一次（避免无谓 updated_at 推进）。
		if task.Status == status {
			result.Succeeded = append(result.Succeeded, slug)
			continue
		}
		pending = append(pending, slug)
	}

	if len(pending) > 0 {
		_, err := s.repo.BatchUpdateStatus(ctx, pending, status)
		if err != nil {
			return nil, err
		}
		result.Succeeded = append(result.Succeeded, pending...)
	}

	return result, nil
}

// SoftDelete 逻辑删除。
func (s *DevTaskService) SoftDelete(ctx context.Context, slug string) error {
	if err := s.repo.SoftDelete(ctx, slug); err != nil {
		return err
	}
	return nil
}

// HardDelete 物理删除。
func (s *DevTaskService) HardDelete(ctx context.Context, slug string) error {
	if err := s.repo.HardDelete(ctx, slug); err != nil {
		return err
	}
	return nil
}

// ArchiveDoneTasks 将所有"已完成"任务批量归档（逻辑删除）。
// 用于定期清理看板。
func (s *DevTaskService) ArchiveDoneTasks(ctx context.Context) (int64, error) {
	n, err := s.repo.ArchiveDoneTasks(ctx)
	if err != nil {
		return 0, err
	}
	return n, nil
}

// GetBySlug 按 slug 查单条任务（slug 用 task-N 格式）。
// withParent=true 且任务有 parent_slug 时，额外附带父 spec 的 DevTaskOut 到
// Parent 字段，便于前端一次拿到子任务 + spec 上下文；父任务不存在仅 warn
// 不阻塞返回。withParent=false 跳过第二次查询。
func (s *DevTaskService) GetBySlug(ctx context.Context, slug string, withParent bool) (*dto.DevTaskResponse, error) {
	if slug == "" {
		return nil, devtaskerrs.ErrTaskNotFound
	}
	task, err := s.repo.GetBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, devtaskerrs.ErrTaskNotFound
		}
		return nil, err
	}
	out := dto.ToDevTaskResponse(*task, nil)

	if withParent && task.ParentSlug != nil {
		parent, err := s.repo.GetBySlug(ctx, *task.ParentSlug)
		if err != nil {
			slog.WarnContext(ctx, "get parent dev task", "error", err, "slug", *task.ParentSlug)
		} else {
			p := dto.ToDevTaskResponse(*parent, nil)
			out.Parent = &p
		}
	}

	return &out, nil
}

// FindFrontier 返回 agent 当前可认领的任务列表 —— Pocock 的 frontier 概念。
// = for_agent=true + status=待排期 + blocked_by=空 + is_deleted=false，按当前排序规则。
func (s *DevTaskService) FindFrontier(ctx context.Context, limit int) ([]dto.DevTaskResponse, error) {
	if limit < 1 {
		limit = 10
	}
	tasks, err := s.repo.FindFrontier(ctx, limit)
	if err != nil {
		return nil, err
	}
	return dto.ToDevTaskList(tasks), nil
}
