// Package devtaskerrs 定义 devtask 看板域业务错误。
package devtaskerrs

import "errors"

var ErrTaskNotFound = errors.New("task not found")
