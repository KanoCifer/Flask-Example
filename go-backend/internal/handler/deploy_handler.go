package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"os"
	"os/exec"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/middleware"
	"github.com/KanoCifer/kuroome-blog/internal/response"
)

// DeployHandler 处理部署触发请求。
type DeployHandler struct {
	cfg *config.Config
}

func NewDeployHandler(cfg *config.Config) *DeployHandler {
	return &DeployHandler{cfg: cfg}
}

// WebhookDeploy 处理 POST /deploy —— Gitee / GitHub webhook 触发自动部署。
func (h *DeployHandler) WebhookDeploy(c *gin.Context) {
	secret := h.cfg.Gitee.WebhookSecret
	if secret == nil || *secret == "" {
		response.APIError(c, "Webhook secret not configured", 500)
		return
	}

	giteeToken := c.GetHeader("X-Gitee-Token")
	signatureHeader := c.GetHeader("X-Hub-Signature-256")

	switch {
	case giteeToken != "":
		if giteeToken != *secret {
			response.APIError(c, "Invalid token", 403)
			return
		}
	case signatureHeader != "":
		body, err := c.GetRawData()
		if err != nil {
			response.APIError(c, "Failed to read request body", 400)
			return
		}
		if !hmacEqualBody(body, *secret, signatureHeader) {
			response.APIError(c, "Invalid signature", 403)
			return
		}
	default:
		response.APIError(c, "No authentication provided", 401)
		return
	}

	go runDeployment()

	slog.InfoContext(c.Request.Context(), "Deployment triggered by webhook", "ip", middleware.ClientIP(c))
	response.Success(c, gin.H{"status": "pending"}, "Deployment triggered successfully")
}

func hmacEqualBody(body []byte, secret, signatureHeader string) bool {
	const prefix = "sha256="
	if len(signatureHeader) <= len(prefix) || signatureHeader[:len(prefix)] != prefix {
		return false
	}
	received := signatureHeader[len(prefix):]
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(received), []byte(expected))
}

func runDeployment() {
	scriptPath := os.Getenv("DEPLOY_SCRIPT_PATH")
	if scriptPath == "" {
		scriptPath = "/home/kano/blog/backend/deploy.sh"
	}

	// ctx 提到前面：脚本不存在的 early-return 日志也要走 ctx，
	// 让所有 deploy 相关记录能按 trace_id 串联（虽然这是 fire-and-forget
	// goroutine，没有 request ctx，但保留与后续 exec 共用同一 ctx 句柄）。
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		slog.ErrorContext(ctx, "Deploy script not found", "path", scriptPath)
		return
	}

	cmd := exec.CommandContext(ctx, scriptPath)
	cmd.Dir = "/home/kano/blog/backend"
	output, err := cmd.CombinedOutput()
	if err != nil {
		slog.ErrorContext(ctx, "Deployment failed", "error", err, "output", string(output))
		return
	}
	slog.InfoContext(ctx, "Deployment completed", "output", string(output))
}

// RegisterRoutes 挂载部署路由（公开，无需鉴权）。
func (h *DeployHandler) RegisterRoutes(r *gin.RouterGroup) {
	r.POST("/deploy", h.WebhookDeploy)
}
