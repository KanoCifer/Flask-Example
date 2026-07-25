// Package usererrs 定义 user 域业务错误。
// 跨域使用（如 passkey/upload/github）正常 import 此包。
package usererrs

import "errors"

var (
	ErrInvalidCredentials = errors.New("用户名或密码错误")
	ErrUserExists         = errors.New("用户名已存在")
	ErrEmailExists        = errors.New("邮箱已注册")
	ErrInvalidEmailCode   = errors.New("验证码无效")
	ErrUserNotFound       = errors.New("用户不存在")
	ErrInvalidToken       = errors.New("无效的令牌")
)
