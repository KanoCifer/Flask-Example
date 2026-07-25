// Package momenterrs 定义 moment 域业务错误。ErrInvalidObjectID 当前仅服务
// moment 集合（mongodb/moment + helper），后续如多集合需要再抽 common。
package momenterrs

import "errors"

var (
	ErrMomentNotFound  = errors.New("moment not found")
	ErrInvalidObjectID = errors.New("Invalid ObjectID")
)
