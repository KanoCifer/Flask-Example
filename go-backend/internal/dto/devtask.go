package dto

import (
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
)

// DevTaskCreate 创建任务请求
type DevTaskCreate struct {
	Title       string                   `json:"title" binding:"required"`
	Description *string                  `json:"description"`
	Detail      *string                  `json:"detail"`
	Type        document.DevTaskType     `json:"type" binding:"required"`
	Priority    document.DevTaskPriority `json:"priority" binding:"required"`
	Scope       document.DevTaskScope    `json:"scope" binding:"required"`
	DueDate     *time.Time               `json:"due_date"`
	// Slug 由后端自增生成的 task-N，客户端无需传。
	// 如需支持自定义 slug 可开放字段。
	// Spec
	AcceptanceCriteria *string `json:"acceptance_criteria"`
	Constraints        *string `json:"constraints"`
	ContextPointers    *string `json:"context_pointers"`
	// Who: true = agent 可认领；false = 人做（默认）。
	ForAgent bool `json:"for_agent"`
	// Dependencies: 必须在哪些任务完成后才能开始。
	BlockedBy []string `json:"blocked_by"`
	// Kind: spec（默认）或 subtask。零值 = spec。
	Kind document.TaskKind `json:"kind"`
	// ParentSlug: 子任务归属的 spec slug。nil = 无归属。
	ParentSlug *string `json:"parent_slug"`
	Slug *string `json:"slug"`
}

// DevTaskUpdate 更新任务请求（全字段可选，有值才更新）
type DevTaskUpdate struct {
	Title       *string                   `json:"title"`
	Description *string                   `json:"description"`
	Detail      *string                   `json:"detail"`
	Type        *document.DevTaskType     `json:"type"`
	Priority    *document.DevTaskPriority `json:"priority"`
	Scope       *document.DevTaskScope    `json:"scope"`
	Status      *document.DevTaskStatus   `json:"status"`
	SortOrder   *int                      `json:"sort_order"`
	DueDate     *time.Time                `json:"due_date"`
	// Spec
	AcceptanceCriteria *string `json:"acceptance_criteria"`
	Constraints        *string `json:"constraints"`
	ContextPointers    *string `json:"context_pointers"`
	// Who
	ForAgent *bool `json:"for_agent"`
	// Dependencies: 传了覆盖，不传不动。
	BlockedBy *[]string `json:"blocked_by"`
	// Kind: 传了覆盖，不传不动。spec / subtask。
	Kind *document.TaskKind `json:"kind"`
	// ParentSlug: 传了覆盖，不传不动。子任务归属的 spec slug。
	ParentSlug *string `json:"parent_slug"`
}

// DevTaskResponse 任务输出
type DevTaskResponse struct {
	ID          string                   `json:"id"`
	UserID      int                      `json:"user_id"`
	Title       string                   `json:"title"`
	Description *string                  `json:"description"`
	Detail      *string                  `json:"detail"`
	Type        document.DevTaskType     `json:"type"`
	Priority    document.DevTaskPriority `json:"priority"`
	Scope       document.DevTaskScope    `json:"scope"`
	Status      document.DevTaskStatus   `json:"status"`
	SortOrder   int                      `json:"sort_order"`
	DueDate     *time.Time               `json:"due_date"`
	IsDeleted   bool                     `json:"is_deleted"`
	CreatedAt   time.Time                `json:"created_at"`
	UpdatedAt   time.Time                `json:"updated_at"`
	Slug        string                   `json:"slug"`
	// Spec
	AcceptanceCriteria *string `json:"acceptance_criteria,omitempty"`
	Constraints        *string `json:"constraints,omitempty"`
	ContextPointers    *string `json:"context_pointers,omitempty"`
	// Who
	ForAgent bool `json:"for_agent"`
	// Dependencies
	BlockedBy []string `json:"blocked_by"`
	// Kind: spec / subtask。omitempty 让老文档（空串）不序列化。
	Kind document.TaskKind `json:"kind,omitempty"`
	// ParentSlug: 子任务归属的 spec slug。omitempty = 无归属。
	ParentSlug *string `json:"parent_slug,omitempty"`
	// Parent: 当 ParentSlug 存在时，附带父 spec 的数据。omitempty = 子任务/
	//         无父任务时无该字段。自引用结构，便于前端一次拿到上下文。
	Parent *DevTaskResponse `json:"parent,omitempty"`
}

// BatchStatusRequest 批量修改任务状态请求
type BatchStatusRequest struct {
	// Slugs 要修改状态的任务 slug 列表（1..20）。
	Slugs []string `json:"slugs" binding:"required,min=1,max=20"`
	// Status 目标状态（"待评估" / "待排期" / "进行中" / "已搁置" / "已完成"）。
	Status document.DevTaskStatus `json:"status" binding:"required"`
}

// BatchStatusResponse 批量修改任务状态响应
type BatchStatusResponse struct {
	// Succeeded 已更新状态的任务 slug 列表。
	Succeeded []string `json:"succeeded"`
	// Failed 失败的任务 slug → 原因。
	Failed map[string]string `json:"failed"`
}

// DevTaskFilter 任务列表筛选条件（handler→service 的 string-based DTO，
// handler 不感知领域类型，由 service 层做 string→domain 映射）。
type DevTaskFilter struct {
	Status         string `json:"status,omitempty"`
	Priority       string `json:"priority,omitempty"`
	Type           string `json:"type,omitempty"`
	IncludeDeleted *bool  `json:"include_deleted,omitempty"`
	ForAgent       *bool  `json:"for_agent,omitempty"`
}

// DevTaskListResponse 任务列表响应
type DevTaskListResponse struct {
	Tasks      []DevTaskResponse `json:"tasks"`
	Pagination Pagination        `json:"pagination"`
}

// ToDevTaskResponse 从 document.DevTask 转换为 DTO。
// withParent 非空时填充 Parent 字段（用于 GetBySlug 单次查询）。
func ToDevTaskResponse(t document.DevTask, parent *DevTaskResponse) DevTaskResponse {
	out := DevTaskResponse{
		ID:                 t.ID,
		UserID:             t.UserID,
		Title:              t.Title,
		Description:        t.Description,
		Detail:             t.Detail,
		Type:               t.Type,
		Priority:           t.Priority,
		Scope:              t.Scope,
		Status:             t.Status,
		SortOrder:          t.SortOrder,
		DueDate:            t.DueDate,
		IsDeleted:          t.IsDeleted,
		CreatedAt:          t.CreatedAt,
		UpdatedAt:          t.UpdatedAt,
		AcceptanceCriteria: t.AcceptanceCriteria,
		Constraints:        t.Constraints,
		ContextPointers:    t.ContextPointers,
		ForAgent:           t.ForAgent,
		BlockedBy:          t.BlockedBy,
		Slug:               t.Slug,
		Kind:               t.Kind,
		ParentSlug:         t.ParentSlug,
	}
	if parent != nil {
		out.Parent = parent
	}
	return out
}

// ToDevTaskList 批量转换，nil/空切片统一返回空数组。
func ToDevTaskList(tasks []document.DevTask) []DevTaskResponse {
	if len(tasks) == 0 {
		return []DevTaskResponse{}
	}
	out := make([]DevTaskResponse, 0, len(tasks))
	for _, t := range tasks {
		out = append(out, ToDevTaskResponse(t, nil))
	}
	return out
}

// blockedByOrEmpty 把 nil slice 归一化为空数组。
func blockedByOrEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// BlockedByOrEmpty 导出别名，供 service/handler 层调用。
var BlockedByOrEmpty = blockedByOrEmpty
