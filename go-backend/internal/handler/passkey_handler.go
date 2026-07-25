package handler

import (
	"context"
	"errors"
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/domain/passkey/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/model"
	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/util"
)

// PasskeyServiceer 定义 handler 依赖的 Passkey 业务接口。
type PasskeyServiceer interface {
	HasPasskey(ctx context.Context, userID uint) bool
	BeginRegistration(ctx context.Context, userID uint) (map[string]any, error)
	FinishRegistration(ctx context.Context, userID uint, response map[string]any) error
	BeginLogin(ctx context.Context) (map[string]any, error)
	FinishLogin(ctx context.Context, response map[string]any) (*model.User, error)
	DeletePasskey(ctx context.Context, userID uint) error
}

// passkeyTokenCreator 是 PasskeyHandler 为签发 token 所需的窄接口。
// handler 自定接口，不直接依赖 service.Userer，便于 mock 测试。
type passkeyTokenCreator interface {
	CreateTokens(ctx context.Context, u *model.User) (*dto.TokensResponse, error)
	UserToDict(u *model.User, p *model.Profile) map[string]any
}

// PasskeyHandler 持有 PasskeyServiceer 和 passkeyTokenCreator（登录后构造 token）。
type PasskeyHandler struct {
	passkeySvc PasskeyServiceer
	userSvc    passkeyTokenCreator
	cfg        *config.Config
}

func NewPasskeyHandler(passkeySvc PasskeyServiceer, userSvc passkeyTokenCreator, cfg *config.Config) *PasskeyHandler {
	return &PasskeyHandler{passkeySvc: passkeySvc, userSvc: userSvc, cfg: cfg}
}

// RegistrationOptions GET /passkey/registration-options (auth required)
func (h *PasskeyHandler) RegistrationOptions(c *gin.Context) {
	userID := c.GetInt("user_id")

	options, err := h.passkeySvc.BeginRegistration(c.Request.Context(), uint(userID))
	if err != nil {
		if errors.Is(err, passkeyerrs.ErrPasskeyExists) {
			slog.WarnContext(c.Request.Context(), "passkey registration begin failed", "reason", "passkey_exists", "user_id", userID)
			response.APIError(c, err.Error(), 400)
			return
		}
		slog.ErrorContext(c.Request.Context(), "passkey registration begin error", "error", err, "user_id", userID)
		response.APIError(c, err.Error(), 500)
		return
	}
	response.Success(c, options, "Passkey 注册选项生成成功")
}

// Register POST /passkey/register (auth required)
func (h *PasskeyHandler) Register(c *gin.Context) {
	userID := c.GetInt("user_id")

	var req dto.PasskeyRegistrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, "invalid request body")
		return
	}

	if err := h.passkeySvc.FinishRegistration(c.Request.Context(), uint(userID), req.Response); err != nil {
		if errors.Is(err, passkeyerrs.ErrInvalidPasskey) {
			slog.WarnContext(c.Request.Context(), "passkey registration finish failed", "reason", "invalid_passkey", "user_id", userID)
			response.APIError(c, err.Error(), 400)
			return
		}
		slog.ErrorContext(c.Request.Context(), "passkey registration finish error", "error", err, "user_id", userID)
		response.APIError(c, err.Error(), 500)
		return
	}
	response.Success(c, nil, "Passkey 注册成功")
}

// AuthenticationOptions GET /passkey/authentication-options (public)
func (h *PasskeyHandler) AuthenticationOptions(c *gin.Context) {
	options, err := h.passkeySvc.BeginLogin(c.Request.Context())
	if err != nil {
		response.APIError(c, err.Error(), 500)
		return
	}
	response.Success(c, options, "Passkey 认证选项生成成功")
}

// Authenticate POST /passkey/authenticate (public → returns tokens)
func (h *PasskeyHandler) Authenticate(c *gin.Context) {
	var req dto.PasskeyAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, "invalid request body")
		return
	}

	user, err := h.passkeySvc.FinishLogin(c.Request.Context(), req.Assertion)
	if err != nil {
		if errors.Is(err, passkeyerrs.ErrInvalidPasskey) || errors.Is(err, passkeyerrs.ErrPasskeyNotFound) {
			slog.WarnContext(c.Request.Context(), "passkey login failed", "reason", "invalid_passkey")
			response.APIError(c, err.Error(), 400)
			return
		}
		slog.ErrorContext(c.Request.Context(), "passkey login error", "error", err)
		response.APIError(c, err.Error(), 500)
		return
	}

	tokens, err := h.userSvc.CreateTokens(c.Request.Context(), user)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "create tokens error", "error", err, "user_id", user.ID)
		response.APIError(c, "server error", 500)
		return
	}

	// 写入 refresh_token cookie（与 Python 端一致）。
	util.SetRefreshCookie(c, h.cfg, tokens.RefreshToken)

	// 用户字段铺平到 data 顶层（与 Python 端 user_to_dict 形状一致）。
	userData := h.userSvc.UserToDict(user, user.Profile)
	userData["access_token"] = tokens.AccessToken
	userData["refresh_token"] = tokens.RefreshToken
	response.Success(c, userData, "Passkey 登录成功")
}

// DeletePasskey DELETE /passkey/delete (auth required)
func (h *PasskeyHandler) DeletePasskey(c *gin.Context) {
	userID := c.GetInt("user_id")

	if err := h.passkeySvc.DeletePasskey(c.Request.Context(), uint(userID)); err != nil {
		if errors.Is(err, passkeyerrs.ErrPasskeyNotFound) {
			slog.WarnContext(c.Request.Context(), "passkey delete failed", "reason", "passkey_not_found", "user_id", userID)
			response.APIError(c, "您的账户尚未绑定Passkey", 400)
			return
		}
		slog.ErrorContext(c.Request.Context(), "passkey delete error", "error", err, "user_id", userID)
		response.APIError(c, err.Error(), 500)
		return
	}
	response.Success(c, nil, "Passkey 删除成功")
}

// RegisterRoutes 把 handler 方法挂到路由组。
func (h *PasskeyHandler) RegisterRoutes(r *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	r.GET("/passkey/registration-options", authMiddleware, h.RegistrationOptions)
	r.POST("/passkey/register", authMiddleware, h.Register)
	r.GET("/passkey/authentication-options", h.AuthenticationOptions)
	r.POST("/passkey/authenticate", h.Authenticate)
	r.DELETE("/passkey/delete", authMiddleware, h.DeletePasskey)
}
