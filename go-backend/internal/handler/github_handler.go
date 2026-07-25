package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/domain/github/errs"
	"github.com/KanoCifer/kuroome-blog/internal/domain/user/errs"
	"github.com/KanoCifer/kuroome-blog/internal/model"
	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/util"
)

// GitHubOAuthServiceer 定义 handler 依赖的 GitHub OAuth 业务接口。
type GitHubOAuthServiceer interface {
	// AuthURL 构造 GitHub 授权地址。 mode="login" | "bind"。
	AuthURL(ctx context.Context, mode string, userID uint) (string, error)

	// HandleCallback 处理 GitHub 回调。
	// login 模式返回 (user, tokens, nil); bind 模式返回 (user, nil, nil)。
	HandleCallback(ctx context.Context, state, code string) (*model.User, *dto.TokensResponse, error)

	// UnbindGitHub 解除用户与 GitHub 的绑定。
	UnbindGitHub(ctx context.Context, userID uint) error
}

// GitHubHandler 持有 GitHub OAuth 服务。
type GitHubHandler struct {
	githubSvc GitHubOAuthServiceer
	cfg       *config.Config
}

// NewGitHubHandler 构造一个 GitHubHandler。
func NewGitHubHandler(githubSvc GitHubOAuthServiceer, cfg *config.Config) *GitHubHandler {
	return &GitHubHandler{githubSvc: githubSvc, cfg: cfg}
}

// Login GET /auth/github — 重定向到 GitHub 授权页(公开)。
func (h *GitHubHandler) Login(c *gin.Context) {
	url, err := h.githubSvc.AuthURL(c.Request.Context(), "login", 0)
	if err != nil {
		redirectWithError(c, h.cfg, "github_not_configured")
		return
	}
	c.Redirect(http.StatusFound, url)
}

// Bind GET /github/bind — 已登录用户发起绑定, 重定向到 GitHub(需 Auth)。
func (h *GitHubHandler) Bind(c *gin.Context) {
	userID := c.GetInt("user_id")
	if userID == 0 {
		response.APIError(c, "未授权", 401)
		return
	}
	url, err := h.githubSvc.AuthURL(c.Request.Context(), "bind", uint(userID))
	if err != nil {
		redirectWithError(c, h.cfg, "github_not_configured")
		return
	}
	c.Redirect(http.StatusFound, url)
}

// Callback GET /auth/github/callback — GitHub 回调(公开)。
func (h *GitHubHandler) Callback(c *gin.Context) {
	state := c.Query("state")
	code := c.Query("code")

	_, tokens, err := h.githubSvc.HandleCallback(c.Request.Context(), state, code)
	if err != nil {
		switch {
		case errors.Is(err, githuberrs.ErrInvalidOAuthState):
			slog.WarnContext(c.Request.Context(), "github callback failed", "reason", "invalid_oauth_state")
			redirectWithError(c, h.cfg, "invalid_oauth_state")
		case errors.Is(err, usererrs.ErrUserNotFound):
			slog.WarnContext(c.Request.Context(), "github callback failed", "reason", "user_not_found")
			redirectWithError(c, h.cfg, "user_not_found")
		case errors.Is(err, githuberrs.ErrGitHubAlreadyBound):
			slog.WarnContext(c.Request.Context(), "github callback failed", "reason", "github_already_bound")
			redirectWithError(c, h.cfg, "github_already_bound")
		default:
			slog.ErrorContext(c.Request.Context(), "github callback error", "error", err)
			redirectWithError(c, h.cfg, "github_auth_failed")
		}
		return
	}

	// login 模式: 签发 token + 设置 refresh cookie, 然后重定向到 frontend
	if tokens != nil {
		c.SetCookie(
			"refresh_token",
			tokens.RefreshToken,
			7*24*3600,
			"/",
			util.CookieDomain(h.cfg),
			true, // secure
			true, // httponly
		)
		// 把 access_token 作为 query param 传给前端, 前端存入 localStorage
		target := h.cfg.Frontend.URL + "/login/github?access_token=" + tokens.AccessToken
		c.Redirect(http.StatusFound, target)
		return
	}

	// bind 模式: user != nil, tokens == nil → 重定向回设置页
	c.Redirect(http.StatusFound, h.cfg.Frontend.URL+"/settings?success=github_bound")
}

// Unbind POST /github/unbind — 解除绑定(需 Auth)。
func (h *GitHubHandler) Unbind(c *gin.Context) {
	userID := c.GetInt("user_id")
	if userID == 0 {
		response.APIError(c, "未授权", 401)
		return
	}
	if err := h.githubSvc.UnbindGitHub(c.Request.Context(), uint(userID)); err != nil {
		response.APIError(c, "server error", 500)
		return
	}
	response.Success(c, nil, "GitHub 绑定已解除")
}

// RegisterRoutes 把 GitHub OAuth 路由挂到路由组。
func (h *GitHubHandler) RegisterRoutes(r *gin.RouterGroup, authMW gin.HandlerFunc) {
	r.GET("/auth/github", h.Login)
	r.GET("/auth/github/callback", h.Callback)
	r.GET("/github/bind", authMW, h.Bind)
	r.POST("/github/unbind", authMW, h.Unbind)
}

// redirectWithError 带 error 参数重定向到前端登录/设置页。
func redirectWithError(c *gin.Context, cfg *config.Config, errorCode string) {
	base := cfg.Frontend.URL
	target := base + "/login?error=" + errorCode
	c.Redirect(http.StatusFound, target)
}
