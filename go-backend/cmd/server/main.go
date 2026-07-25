package main

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/app"
	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/db"
	"github.com/KanoCifer/kuroome-blog/internal/logger"
	"github.com/KanoCifer/kuroome-blog/internal/router"
	"github.com/KanoCifer/kuroome-blog/internal/service"
	"github.com/KanoCifer/kuroome-blog/pkg/notification"
)

func init() {
	config.Load()
}

func sendBootNotification() {
	if !config.Cfg.Admin.SendBootEmail || config.Cfg.Feishu.WebhookURL == "" {
		// 启动期 happy path 默认 INFO 噪音过大；降为 Debug，需要时再
		// 通过 LOG_LEVEL=DEBUG 打开排查。记录 reason 便于确认是哪条分支
		// 关掉了通知（admin 标志 vs feishu webhook 未配）。
		reason := "send_boot_email_disabled"
		if config.Cfg.Feishu.WebhookURL == "" {
			reason = "feishu_webhook_unset"
		}
		slog.Debug("boot notification disabled", "reason", reason)
		return
	}
	nc := notification.NewFeishuChannel()
	var msg notification.Message = notification.Message{
		Title: "Go Backend Booted",
		Body:  "Go Backend Booted successfully",
		Color: "green",
	}
	if !nc.Send(context.Background(), msg, notification.NotificationContext{}) {
		// notification.Channel.Send 仅返回 bool，底层 err 已被 channel 吞掉；
		// 至少把"为什么算失败"留痕：send_returned_false，便于排查时区分
		// webhook 不可达 vs 序列化错误。
		slog.Error("send boot notification", "reason", "send_returned_false")
	}
}

func main() {
	logger.Init(config.Cfg)

	if err := db.InitDB(); err != nil {
		slog.Error("init db", "error", err)
	}
	if err := db.InitMongo(); err != nil {
		slog.Error("init mongo", "error", err)
	}
	if err := db.InitRedis(); err != nil {
		slog.Error("init redis", "error", err)
	}
	defer db.Close()

	// 收口 gin 内部日志到 slog。访问日志由 SlogMiddleware 单行结构化输出，
	// 不再经过 gin 默认的 plaintext Logger。
	gin.DefaultWriter = logger.GinLogWriter{}
	gin.DefaultErrorWriter = logger.GinLogWriter{}

	// gin.New() 而非 gin.Default()：收口 gin 内部日志到 slog（见 GinLogWriter）后，
	// 显式挂载 Recovery + SlogMiddleware，替代默认的 plaintext Logger。
	r := gin.New()
	r.Use(gin.Recovery())

	wa, err := service.NewWebAuthn(config.Cfg.WebAuthn.RPID, config.Cfg.WebAuthn.Origin)
	if err != nil {
		slog.Error("init webauthn", "error", err)
	}

	state := app.NewAppState(
		config.Cfg,
		db.GetDB(),
		db.GetMongoDB(),
		db.GetRedis(),
		wa,
	)

	router.Setup(r, state, db.GetRedis())

	sendBootNotification()

	addr := fmt.Sprintf("127.0.0.1:%d", config.Cfg.Server.Port)
	r.Run(addr)
}
