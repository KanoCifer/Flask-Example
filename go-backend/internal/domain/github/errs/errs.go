// Package githuberrs 定义 GitHub OAuth 域业务错误。
package githuberrs

import "errors"

var (
	ErrGitHubNotConfigured = errors.New("GitHub OAuth 未配置")
	ErrInvalidOAuthState   = errors.New("state 无效或已过期")
	ErrGitHubAlreadyBound  = errors.New("该 GitHub 账户已被绑定")
)