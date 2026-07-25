package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/logger"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
	"github.com/KanoCifer/kuroome-blog/internal/repository/mongodb"
)

// ---------- mock DevTaskRepository ----------

type mockDevTaskRepo struct {
	createFn       func(ctx context.Context, task *document.DevTask) error
	getBySlugFn    func(ctx context.Context, slug string) (*document.DevTask, error)
	listFn         func(ctx context.Context, filter mongodb.ListFilter, page, perPage int) ([]document.DevTask, int64, error)
	updateFn       func(ctx context.Context, slug string, fields bson.M) error
	softDelFn      func(ctx context.Context, slug string) error
	hardDelFn      func(ctx context.Context, slug string) error
	archiveFn      func(ctx context.Context) (int64, error)
	findFrontierFn func(ctx context.Context, limit int) ([]document.DevTask, error)
	nextSlugSeqFn  func(ctx context.Context) (int, error)
	batchStatusFn  func(ctx context.Context, slugs []string, status document.DevTaskStatus) (int64, error)
}

func (m *mockDevTaskRepo) Create(ctx context.Context, task *document.DevTask) error {
	return m.createFn(ctx, task)
}

func (m *mockDevTaskRepo) GetBySlug(ctx context.Context, slug string) (*document.DevTask, error) {
	if m.getBySlugFn != nil {
		return m.getBySlugFn(ctx, slug)
	}
	return nil, nil
}

func (m *mockDevTaskRepo) List(ctx context.Context, filter mongodb.ListFilter, page, perPage int) ([]document.DevTask, int64, error) {
	return m.listFn(ctx, filter, page, perPage)
}

func (m *mockDevTaskRepo) Update(ctx context.Context, slug string, fields bson.M) error {
	return m.updateFn(ctx, slug, fields)
}

func (m *mockDevTaskRepo) SoftDelete(ctx context.Context, slug string) error {
	return m.softDelFn(ctx, slug)
}

func (m *mockDevTaskRepo) HardDelete(ctx context.Context, slug string) error {
	return m.hardDelFn(ctx, slug)
}

func (m *mockDevTaskRepo) ArchiveDoneTasks(ctx context.Context) (int64, error) {
	return m.archiveFn(ctx)
}

func (m *mockDevTaskRepo) FindFrontier(ctx context.Context, limit int) ([]document.DevTask, error) {
	if m.findFrontierFn != nil {
		return m.findFrontierFn(ctx, limit)
	}
	return nil, nil
}

func (m *mockDevTaskRepo) NextSlugSeq(ctx context.Context) (int, error) {
	if m.nextSlugSeqFn != nil {
		return m.nextSlugSeqFn(ctx)
	}
	return 0, nil
}

func (m *mockDevTaskRepo) BatchUpdateStatus(
	ctx context.Context,
	slugs []string,
	status document.DevTaskStatus,
) (int64, error) {
	if m.batchStatusFn != nil {
		return m.batchStatusFn(ctx, slugs, status)
	}
	return 0, nil
}

// newService 用 mock repo 构造 service。
func newService(repo DevTaskRepositoryer) *DevTaskService {
	return &DevTaskService{repo: repo}
}

const testSlug = "task-1"

// ---------- Create ----------

func TestDevTaskService_Create_Success(t *testing.T) {
	var captured *document.DevTask
	repo := &mockDevTaskRepo{
		nextSlugSeqFn: func(ctx context.Context) (int, error) { return 1, nil },
		createFn: func(ctx context.Context, task *document.DevTask) error {
			captured = task
			return nil
		},
	}
	svc := newService(repo)

	out, err := svc.Create(context.Background(), 42, dto.DevTaskCreate{
		Title: "Write tests", Type: document.TaskTypeFeature, Priority: document.PriorityP1, Scope: document.ScopeGo,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if out.Slug != testSlug {
		t.Errorf("out.Slug = %q, want %s", out.Slug, testSlug)
	}
	if out.Status != document.StatusTriage {
		t.Errorf("out.Status = %q, want %q (default)", out.Status, document.StatusTriage)
	}
	if captured == nil || captured.UserID != 42 {
		t.Errorf("captured.UserID = %v, want 42", captured)
	}
	if captured.CreatedAt.IsZero() || captured.UpdatedAt.IsZero() {
		t.Errorf("timestamps not set: created=%v updated=%v", captured.CreatedAt, captured.UpdatedAt)
	}
}

func TestDevTaskService_Create_RepoError(t *testing.T) {
	repo := &mockDevTaskRepo{
		createFn: func(ctx context.Context, task *document.DevTask) error {
			return errors.New("mongo timeout")
		},
	}
	svc := newService(repo)

	_, err := svc.Create(context.Background(), 1, dto.DevTaskCreate{
		Title: "x", Type: document.TaskTypeBug, Priority: document.PriorityP0, Scope: document.ScopeGeneral,
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// ---------- List ----------

func TestDevTaskService_List_Pagination(t *testing.T) {
	repo := &mockDevTaskRepo{
		listFn: func(ctx context.Context, filter mongodb.ListFilter, page, perPage int) ([]document.DevTask, int64, error) {
			return []document.DevTask{
				{ID: "1", Title: "a"},
				{ID: "2", Title: "b"},
			}, 20, nil
		},
	}
	svc := newService(repo)

	out, err := svc.List(context.Background(), dto.DevTaskFilter{}, 2, 10)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(out.Tasks) != 2 {
		t.Errorf("len(tasks) = %d, want 2", len(out.Tasks))
	}
	if out.Pagination.Total != 20 {
		t.Errorf("pagination.Total = %d, want 20", out.Pagination.Total)
	}
	if out.Pagination.Page != 2 {
		t.Errorf("pagination.Page = %d, want 2", out.Pagination.Page)
	}
}

func TestDevTaskService_List_Defaults(t *testing.T) {
	var gotPage, gotPerPage int
	repo := &mockDevTaskRepo{
		listFn: func(ctx context.Context, filter mongodb.ListFilter, page, perPage int) ([]document.DevTask, int64, error) {
			gotPage, gotPerPage = page, perPage
			return []document.DevTask{}, 0, nil
		},
	}
	svc := newService(repo)

	_, err := svc.List(context.Background(), dto.DevTaskFilter{}, 0, 0)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if gotPage != 1 {
		t.Errorf("page = %d, want 1 (default)", gotPage)
	}
	if gotPerPage != 10 {
		t.Errorf("perPage = %d, want 10 (default)", gotPerPage)
	}
}

func TestDevTaskService_List_EmptyReturnsArray(t *testing.T) {
	repo := &mockDevTaskRepo{
		listFn: func(ctx context.Context, filter mongodb.ListFilter, page, perPage int) ([]document.DevTask, int64, error) {
			return nil, 0, nil
		},
	}
	svc := newService(repo)

	out, err := svc.List(context.Background(), dto.DevTaskFilter{}, 1, 10)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if out.Tasks == nil {
		t.Errorf("Tasks = nil, want empty array")
	}
	if len(out.Tasks) != 0 {
		t.Errorf("len(Tasks) = %d, want 0", len(out.Tasks))
	}
}

// ---------- Update ----------

func TestDevTaskService_Update_OnlySetFields(t *testing.T) {
	var gotFields bson.M
	repo := &mockDevTaskRepo{
		updateFn: func(ctx context.Context, slug string, fields bson.M) error {
			gotFields = fields
			return nil
		},
	}
	svc := newService(repo)

	status := document.StatusDone
	err := svc.Update(context.Background(), testSlug, dto.DevTaskUpdate{Status: &status})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if gotFields["status"] != document.StatusDone {
		t.Errorf("fields[status] = %v, want %s", gotFields["status"], document.StatusDone)
	}
	if _, ok := gotFields["title"]; ok {
		t.Errorf("fields[title] should not be set")
	}
	if _, ok := gotFields["updated_at"]; !ok {
		t.Errorf("fields[updated_at] should be auto-set")
	}
}

func TestDevTaskService_Update_NoOp(t *testing.T) {
	called := false
	repo := &mockDevTaskRepo{
		updateFn: func(ctx context.Context, slug string, fields bson.M) error {
			called = true
			return nil
		},
	}
	svc := newService(repo)

	err := svc.Update(context.Background(), testSlug, dto.DevTaskUpdate{})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if called {
		t.Error("repo.Update should not be called for empty update")
	}
}

// ---------- Delete ----------

func TestDevTaskService_SoftDelete_Success(t *testing.T) {
	repo := &mockDevTaskRepo{
		softDelFn: func(ctx context.Context, slug string) error { return nil },
	}
	svc := newService(repo)

	err := svc.SoftDelete(context.Background(), testSlug)
	if err != nil {
		t.Fatalf("SoftDelete: %v", err)
	}
}

func TestDevTaskService_HardDelete_Success(t *testing.T) {
	repo := &mockDevTaskRepo{
		hardDelFn: func(ctx context.Context, slug string) error { return nil },
	}
	svc := newService(repo)

	err := svc.HardDelete(context.Background(), testSlug)
	if err != nil {
		t.Fatalf("HardDelete: %v", err)
	}
}

// ---------- ArchiveDoneTasks ----------

func TestDevTaskService_ArchiveDoneTasks(t *testing.T) {
	repo := &mockDevTaskRepo{
		archiveFn: func(ctx context.Context) (int64, error) { return 5, nil },
	}
	svc := newService(repo)

	n, err := svc.ArchiveDoneTasks(context.Background())
	if err != nil {
		t.Fatalf("ArchiveDoneTasks: %v", err)
	}
	if n != 5 {
		t.Errorf("n = %d, want 5", n)
	}
}

// ---------- GetBySlug ----------

func TestDevTaskService_GetBySlug_NoParent(t *testing.T) {
	repo := &mockDevTaskRepo{
		getBySlugFn: func(ctx context.Context, slug string) (*document.DevTask, error) {
			return &document.DevTask{Slug: slug, Title: "spec task"}, nil
		},
	}
	svc := newService(repo)

	out, err := svc.GetBySlug(context.Background(), testSlug, false)
	if err != nil {
		t.Fatalf("GetBySlug: %v", err)
	}
	if out.Parent != nil {
		t.Errorf("Parent = %+v, want nil (no parent_slug)", out.Parent)
	}
}

func TestDevTaskService_GetBySlug_WithParent(t *testing.T) {
	repo := &mockDevTaskRepo{
		getBySlugFn: func(ctx context.Context, slug string) (*document.DevTask, error) {
			switch slug {
			case "child-1":
				parent := "task-1"
				return &document.DevTask{
					Slug: "child-1", Title: "subtask", Kind: document.TaskKindSubTask, ParentSlug: &parent,
				}, nil
			case "task-1":
				return &document.DevTask{Slug: "task-1", Title: "parent spec", Kind: document.TaskKindSpec}, nil
			default:
				return nil, errors.New("not found")
			}
		},
	}
	svc := newService(repo)

	out, err := svc.GetBySlug(context.Background(), "child-1", true)
	if err != nil {
		t.Fatalf("GetBySlug: %v", err)
	}
	if out.Parent == nil {
		t.Fatal("Parent = nil, want parent spec data")
	}
	if out.Parent.Slug != "task-1" || out.Parent.Title != "parent spec" {
		t.Errorf("Parent = %+v, want slug=task-1 title=parent spec", out.Parent)
	}
}

func TestDevTaskService_GetBySlug_TrueButNoParentSlug(t *testing.T) {
	// withParent=true 但任务本身没有 parent_slug 时，只查一次 DB，Parent=nil。
	queryCount := 0
	repo := &mockDevTaskRepo{
		getBySlugFn: func(ctx context.Context, slug string) (*document.DevTask, error) {
			queryCount++
			return &document.DevTask{Slug: slug, Title: "plain spec", Kind: document.TaskKindSpec}, nil
		},
	}
	svc := newService(repo)

	out, err := svc.GetBySlug(context.Background(), testSlug, true)
	if err != nil {
		t.Fatalf("GetBySlug: %v", err)
	}
	if queryCount != 1 {
		t.Errorf("repo.GetBySlug called %d times, want 1 (no parent_slug should skip second query)", queryCount)
	}
	if out.Parent != nil {
		t.Errorf("Parent = %+v, want nil", out.Parent)
	}
}

func TestDevTaskService_GetBySlug_SkipWhenFalse(t *testing.T) {
	// withParent=false 即使有 parent_slug 也不触发第二次查询。
	queryCount := 0
	parent := "task-1"
	repo := &mockDevTaskRepo{
		getBySlugFn: func(ctx context.Context, slug string) (*document.DevTask, error) {
			queryCount++
			return &document.DevTask{Slug: slug, ParentSlug: &parent}, nil
		},
	}
	svc := newService(repo)

	out, err := svc.GetBySlug(context.Background(), "child-1", false)
	if err != nil {
		t.Fatalf("GetBySlug: %v", err)
	}
	if queryCount != 1 {
		t.Errorf("repo.GetBySlug called %d times, want 1 (withParent=false skips parent lookup)", queryCount)
	}
	if out.Parent != nil {
		t.Errorf("Parent = %+v, want nil", out.Parent)
	}
}

func TestDevTaskService_GetBySlug_ParentNotFound(t *testing.T) {
	// 父任务不存在时仍然返回子任务，Parent 为 nil（不阻塞主流程）。
	repo := &mockDevTaskRepo{
		getBySlugFn: func(ctx context.Context, slug string) (*document.DevTask, error) {
			switch slug {
			case "child-99":
				parent := "ghost"
				return &document.DevTask{Slug: "child-99", ParentSlug: &parent}, nil
			default:
				return nil, mongo.ErrNoDocuments
			}
		},
	}
	svc := newService(repo)

	out, err := svc.GetBySlug(context.Background(), "child-99", true)
	if err != nil {
		t.Fatalf("GetBySlug: %v", err)
	}
	if out.Parent != nil {
		t.Errorf("Parent = %+v, want nil (parent doc not found)", out.Parent)
	}
}

// ---------- BatchUpdateStatus ----------

func TestDevTaskService_BatchStatus_AllFound(t *testing.T) {
	repo := &mockDevTaskRepo{
		getBySlugFn: func(ctx context.Context, slug string) (*document.DevTask, error) {
			return &document.DevTask{Slug: slug, Status: document.StatusTriage}, nil
		},
		batchStatusFn: func(ctx context.Context, slugs []string, status document.DevTaskStatus) (int64, error) {
			return int64(len(slugs)), nil
		},
	}
	svc := newService(repo)

	result, err := svc.BatchUpdateStatus(context.Background(), []string{"task-5", "task-6"}, document.StatusBacklog)
	if err != nil {
		t.Fatalf("BatchUpdateStatus: %v", err)
	}
	if len(result.Succeeded) != 2 || len(result.Failed) != 0 {
		t.Errorf("result = %+v, want 2 succeeded + 0 failed", result)
	}
}

func TestDevTaskService_BatchStatus_SomeMissing(t *testing.T) {
	repo := &mockDevTaskRepo{
		getBySlugFn: func(ctx context.Context, slug string) (*document.DevTask, error) {
			if slug == "ghost" {
				return nil, mongo.ErrNoDocuments
			}
			return &document.DevTask{Slug: slug, Status: document.StatusTriage}, nil
		},
		batchStatusFn: func(ctx context.Context, slugs []string, status document.DevTaskStatus) (int64, error) {
			return int64(len(slugs)), nil
		},
	}
	svc := newService(repo)

	result, err := svc.BatchUpdateStatus(context.Background(), []string{"task-5", "ghost", "task-6"}, "待排期")
	if err != nil {
		t.Fatalf("BatchUpdateStatus: %v", err)
	}
	if len(result.Succeeded) != 2 {
		t.Errorf("succeeded = %v, want 2", result.Succeeded)
	}
	if result.Failed["ghost"] == "" {
		t.Errorf("ghost should be in failed, got %v", result.Failed)
	}
}

func TestDevTaskService_BatchStatus_AlreadyTarget(t *testing.T) {
	// 已经是目标状态 → 不进 pending，不写 DB，仍视为 succeeded。
	repoCalls := 0
	repo := &mockDevTaskRepo{
		getBySlugFn: func(ctx context.Context, slug string) (*document.DevTask, error) {
			repoCalls++
			return &document.DevTask{Slug: slug, Status: document.StatusBacklog}, nil
		},
		batchStatusFn: func(ctx context.Context, slugs []string, status document.DevTaskStatus) (int64, error) {
			repoCalls++
			return 0, nil
		},
	}
	svc := newService(repo)

	result, err := svc.BatchUpdateStatus(context.Background(), []string{"task-5"}, document.StatusBacklog)
	if err != nil {
		t.Fatalf("BatchUpdateStatus: %v", err)
	}
	if len(result.Succeeded) != 1 {
		t.Errorf("succeeded = %v, want [task-5]", result.Succeeded)
	}
	if repoCalls != 1 {
		t.Errorf("repo called %d times, want 1 (no-op for already-target)", repoCalls)
	}
}

func TestDevTaskService_BatchStatus_RepoError(t *testing.T) {
	repo := &mockDevTaskRepo{
		getBySlugFn: func(ctx context.Context, slug string) (*document.DevTask, error) {
			return &document.DevTask{Slug: slug, Status: document.StatusTriage}, nil
		},
		batchStatusFn: func(ctx context.Context, slugs []string, status document.DevTaskStatus) (int64, error) {
			return 0, errors.New("mongo down")
		},
	}
	svc := newService(repo)

	_, err := svc.BatchUpdateStatus(context.Background(), []string{"task-5"}, document.StatusBacklog)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// ---------- serializeTask ----------

func TestSerializeTask(t *testing.T) {
	due := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	desc := "desc"
	doc := document.DevTask{
		ID:          "507f1f77bcf86cd799439011",
		Slug:        testSlug,
		UserID:      7,
		Title:       "test",
		Description: &desc,
		Type:        document.TaskTypeBug,
		Priority:    document.PriorityP0,
		Scope:       document.ScopeGo,
		Status:      document.StatusInProgress,
		SortOrder:   3,
		DueDate:     &due,
		IsDeleted:   false,
		CreatedAt:   time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		UpdatedAt:   time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC),
	}

	out := serializeTask(doc)
	if out.Slug != testSlug || out.Title != "test" || *out.Description != "desc" {
		t.Errorf("serializeTask basic fields wrong: %+v", out)
	}
	if out.DueDate == nil || !out.DueDate.Equal(due) {
		t.Errorf("DueDate = %v, want %v", out.DueDate, due)
	}
}

func TestSerializeTasks_Empty(t *testing.T) {
	out := serializeTasks(nil)
	if out == nil || len(out) != 0 {
		t.Errorf("serializeTasks(nil) = %v, want empty non-nil slice", out)
	}
}

// ---------- logging ----------

// TestDevTaskService_LogPropagatesTraceID 验证 service 层错误日志会把 ctx
// 中的 trace_id 透传到 slog 记录。回归 #17 commit 2 —— 之前所有 slog.Error
// 都是裸调用，trace_id 拿不到，handler 跟 service 两条日志无法用同一
// trace_id 串起来。
func TestDevTaskService_LogPropagatesTraceID(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(logger.NewTestHandler(&buf, slog.LevelDebug))
	t.Cleanup(func() { slog.SetDefault(prev) })

	repo := &mockDevTaskRepo{
		getBySlugFn: func(_ context.Context, _ string) (*document.DevTask, error) {
			return nil, errors.New("mongo boom")
		},
	}
	svc := newService(repo)

	ctx := logger.WithTraceID(context.Background(), "deadbeef")
	if _, err := svc.GetBySlug(ctx, "task-7", false); err == nil {
		t.Fatal("expected error from service, got nil")
	}

	rec := map[string]any{}
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &rec); err != nil {
		t.Fatalf("unmarshal slog record: %v\nraw: %s", err, buf.String())
	}
	if rec["trace_id"] != "deadbeef" {
		t.Errorf("trace_id = %v, want deadbeef; full record: %v", rec["trace_id"], rec)
	}
	if rec["level"] != "ERROR" {
		t.Errorf("level = %v, want ERROR", rec["level"])
	}
	if rec["msg"] != "get dev task by slug" {
		t.Errorf("msg = %v, want 'get dev task by slug'", rec["msg"])
	}
}
