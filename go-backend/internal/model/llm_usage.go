package model

import (
	"time"

	"gorm.io/datatypes"
)

// LlmUsage 承载一次 LLM 调用的 token 消耗记录。
//
// 共享表 + 判别列设计：Source 区分服务（translate / weather / course_gen…），
// 服务专属上下文塞 Meta JSONB 列，避免每服务加类型化列造成稀疏大杂烩。
// 字段与索引对齐 Python backend/app/models/llm_usage.py 的 SQLAlchemy 定义，
// 确保 GORM AutoMigrate 生成的约束/索引名与已有命名一致。
type LlmUsage struct {
	ID           uint           `gorm:"primaryKey;autoIncrement"`
	Source       string         `gorm:"size:50;index"`
	UserID       *uint          `gorm:"index"` // 匿名 = NULL
	Model        string         `gorm:"size:100"`
	InputTokens  int
	OutputTokens int
	TotalTokens  int
	DurationMs   *int
	TraceID      *string        `gorm:"size:64"` // Python 侧可空，指针对齐避免 NOT NULL 冲突
	Meta         datatypes.JSON `gorm:"type:jsonb"`
	CreatedAt    time.Time      `gorm:"index;default:current_timestamp"`
}

// TableName 对齐 Python SQLAlchemy 的 __tablename__ = "llm_usage"。
func (LlmUsage) TableName() string {
	return "llm_usage"
}
