package dto

import "github.com/KanoCifer/kuroome-blog/internal/model"

// RegisterRequest 注册请求
type RegisterRequest struct {
	Username  string `json:"username" binding:"required,min=3,max=50"`
	Password  string `json:"password" binding:"required,min=6"`
	Email     string `json:"email" binding:"required,email"`
	EmailCode string `json:"email_code" binding:"required"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// UserResponse 对外暴露的用户结构（不含敏感字段）
type UserResponse struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	IsAdmin  bool   `json:"is_admin"`
}

// TokensResponse access + refresh token 对，由 service 生成、跨层传递。
type TokensResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	UserResponse
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
}

// FromUser 从 model.User 转换为 DTO（isAdmin 由调用方显式传入）。
func FromUser(u *model.User, isAdmin bool) UserResponse {
	return UserResponse{
		ID:       u.ID,
		Username: u.Username,
		IsAdmin:  isAdmin,
	}
}

// PasskeyRegistrationRequest Passkey 注册请求（response 为浏览器返回的 PublicKeyCredential）。
type PasskeyRegistrationRequest struct {
	Response map[string]any `json:"response"`
}

// PasskeyAuthRequest Passkey 认证请求（assertion 为浏览器返回的 AuthenticatorAssertionResponse）。
type PasskeyAuthRequest struct {
	Assertion map[string]any `json:"assertion"`
}
