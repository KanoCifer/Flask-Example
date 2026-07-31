// Package devtaskerrs 定义 devtask 看板域业务错误。
package devtaskerrs

import "errors"

var ErrTaskNotFound = errors.New("task not found")

var (
	ErrSlugInvalidFormat    = errors.New("invalid slug format, expected task-N where N is a positive integer")
	ErrSlugConflict         = errors.New("slug already exists")
	ErrSlugSequenceTooSmall = errors.New("custom slug number must be >= current sequence")
)
