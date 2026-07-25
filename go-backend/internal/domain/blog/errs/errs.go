// Package blogerrs 定义 blog(post) 域业务错误。
package blogerrs

import "errors"

var (
	ErrPostNotFound  = errors.New("blog post not found")
	ErrInvalidPostID = errors.New("invalid post id")
)
