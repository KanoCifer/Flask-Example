// Package passkeyerrs 定义 Passkey / WebAuthn 域业务错误。
package passkeyerrs

import "errors"

var (
	ErrPasskeyExists   = errors.New("您的账户已经绑定了Passkey")
	ErrPasskeyNotFound = errors.New("Passkey 凭证不存在")
	ErrInvalidPasskey  = errors.New("无效的 Passkey 认证响应")
)