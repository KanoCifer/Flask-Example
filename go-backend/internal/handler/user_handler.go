package handler

import (
	"context"
	"errors"
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/domain/user/errs"
	"github.com/KanoCifer/kuroome-blog/internal/model"
	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/util"
)

type Userer interface {
	Authenticate(ctx context.Context, username, password string) (*model.User, error)
	CreateTokens(ctx context.Context, u *model.User) (*dto.TokensResponse, error)
	CreateUser(ctx context.Context, username, password, email, emailCode, avatarURL string) (*model.User, *model.Profile, error)
	GetByID(ctx context.Context, userID uint) (*model.User, *model.Profile, error)
	Logout(ctx context.Context, userID uint)
	RefreshTokens(ctx context.Context, refreshToken string) (*dto.TokensResponse, error)
	UserToDict(u *model.User, p *model.Profile) map[string]any
	SendEmailCode(ctx context.Context, email string) bool
}

// UserHandler 持有业务服务，gin 路由方法挂在其上。
type UserHandler struct {
	userSvc Userer
	cfg     *config.Config
}

func NewUserHandler(userSvc Userer, cfg *config.Config) *UserHandler {
	return &UserHandler{userSvc: userSvc, cfg: cfg}
}

func (h *UserHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, "invalid request body")
		return
	}

	user, err := h.userSvc.Authenticate(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		if errors.Is(err, usererrs.ErrInvalidCredentials) {
			slog.WarnContext(c.Request.Context(), "login failed", "reason", "invalid_credentials", "username", req.Username)
			response.APIError(c, err.Error(), 401)
			return
		}
		slog.ErrorContext(c.Request.Context(), "login error", "error", err, "username", req.Username)
		response.APIError(c, "server error", 500)
		return
	}

	tokens, err := h.userSvc.CreateTokens(c.Request.Context(), user)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "create tokens error", "error", err, "user_id", user.ID)
		response.APIError(c, "server error", 500)
		return
	}

	slog.InfoContext(c.Request.Context(), "user login", "user_id", user.ID)

	// 写入 refresh_token cookie（与 Python 端一致），供前端静默刷新。
	util.SetRefreshCookie(c, h.cfg, tokens.RefreshToken)

	// 用户字段铺平到 data 顶层（与 Python 端 user_to_dict 形状一致）。
	userData := h.userSvc.UserToDict(user, user.Profile)
	userData["access_token"] = tokens.AccessToken
	userData["refresh_token"] = tokens.RefreshToken
	response.Success(c, userData, "登录成功")
}

func (h *UserHandler) Register(c *gin.Context) {
	// "/register"
	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, "invalid request body")
		return
	}

	u, _, err := h.userSvc.CreateUser(c.Request.Context(), req.Username, req.Password, req.Email, req.EmailCode, "")
	if err != nil {
		switch {
		case errors.Is(err, usererrs.ErrUserExists):
			slog.WarnContext(c.Request.Context(), "register failed", "reason", "user_exists", "username", req.Username)
			response.APIError(c, err.Error(), 409)
		case errors.Is(err, usererrs.ErrEmailExists):
			slog.WarnContext(c.Request.Context(), "register failed", "reason", "email_exists", "email", req.Email)
			response.APIError(c, err.Error(), 409)
		case errors.Is(err, usererrs.ErrInvalidEmailCode):
			slog.WarnContext(c.Request.Context(), "register failed", "reason", "invalid_email_code", "email", req.Email)
			response.APIError(c, err.Error(), 400)
		default:
			slog.ErrorContext(c.Request.Context(), "register error", "error", err, "username", req.Username)
			response.APIError(c, "server error", 500)
		}
		return
	}

	slog.InfoContext(c.Request.Context(), "user register", "user_id", u.ID, "username", u.Username)
	response.Success(c, dto.FromUser(u, false), "注册成功")
}

func (h *UserHandler) Me(c *gin.Context) {
	// "/me"
	_, ok := c.Get("user_id")
	if !ok {
		response.APIError(c, "未授权", 401)
		return
	}

	u, p, err := h.userSvc.GetByID(c.Request.Context(), uint(c.GetInt("user_id")))
	if err != nil {
		if errors.Is(err, usererrs.ErrUserNotFound) {
			slog.WarnContext(c.Request.Context(), "get user failed", "reason", "user_not_found", "user_id", c.GetInt("user_id"))
			response.APIError(c, "用户不存在", 404)
			return
		}
		slog.ErrorContext(c.Request.Context(), "get user error", "error", err, "user_id", c.GetInt("user_id"))
		response.APIError(c, "server error", 500)
		return
	}

	response.Success(c, h.userSvc.UserToDict(u, p))
}

func (h *UserHandler) Logout(c *gin.Context) {
	_, ok := c.Get("user_id")
	if !ok {
		response.APIError(c, "未授权", 401)
		return
	}

	h.userSvc.Logout(c.Request.Context(), uint(c.GetInt("user_id")))
	// 清除 refresh_token cookie（与 Python 端一致）。
	util.ClearRefreshCookie(c, h.cfg)
	response.Success(c, nil, "已退出登录")
}

func (h *UserHandler) RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.ShouldBindJSON(&req)

	// refresh_token 优先取 body，缺失时回退到 HttpOnly cookie（与 Python 一致）。
	refreshToken := req.RefreshToken
	if refreshToken == "" {
		if cookie, err := c.Cookie("refresh_token"); err == nil {
			refreshToken = cookie
		}
	}
	if refreshToken == "" {
		response.APIError(c, "刷新令牌不存在", 401)
		return
	}

	tokens, err := h.userSvc.RefreshTokens(c.Request.Context(), refreshToken)
	if err != nil {
		slog.WarnContext(c.Request.Context(), "refresh token failed", "reason", "invalid_token")
		response.APIError(c, err.Error(), 401)
		return
	}

	// 轮换 refresh cookie（与 Python 端一致）。
	util.SetRefreshCookie(c, h.cfg, tokens.RefreshToken)

	response.Success(c, gin.H{
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
	}, "访问令牌已刷新")
}

func (h *UserHandler) EmailCode(c *gin.Context) {
	var req struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, err.Error(), 400)
		return
	}
	if req.Email == "" {
		response.APIError(c, "邮箱不能为空", 400)
		return
	}
	go h.userSvc.SendEmailCode(c.Request.Context(), req.Email)
	response.Success(c, nil, "验证码已发送")
}

// RegisterRoutes 把 handler 方法挂到路由组。
// publicMWs 是应用于 login/register 等公开接口的限流中间件(可变参数)。
// authMiddleware 是认证中间件, 用于 logout/me 等需登录接口。
func (h *UserHandler) RegisterRoutes(r *gin.RouterGroup, authMiddleware gin.HandlerFunc, publicMWs ...gin.HandlerFunc) {
	r.POST("/login", append(publicMWs, h.Login)...)
	r.POST("/register", append(publicMWs, h.Register)...)
	r.POST("/refresh-token", h.RefreshToken)
	r.POST("/logout", authMiddleware, h.Logout)
	r.GET("/me", authMiddleware, h.Me)
	r.POST("/email/code", h.EmailCode)
}
