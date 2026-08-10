package main

import (
	"fmt"

	"github.com/KanoCifer/kuroome-blog/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Println("LOAD ERR:", err)
		return
	}
	fmt.Printf("Port=%d (期望 5555) | LogLevel=%q (期望 INFO) | ENV=%q (期望 prod) | SaveLogs=%v\n",
		cfg.Server.Port, cfg.Server.LogLevel, cfg.Server.ENV, cfg.Server.SaveLogs)
	fmt.Printf("RedisURL=%q | RedisMaxConnections=%d | RabbitMQURL=%q\n",
		cfg.Database.RedisURL, cfg.Database.RedisMaxConnections, cfg.Database.RabbitMQURL)
	fmt.Printf("Mail.Server=%q | Mail.Port=%d | Mail.FromName=%q\n", cfg.Mail.Server, cfg.Mail.Port, cfg.Mail.FromName)
	fmt.Printf("WebAuthn.RPID=%q | WebAuthn.Origin=%q\n", cfg.WebAuthn.RPID, cfg.WebAuthn.Origin)
	fmt.Printf("Frontend.URL=%q | API.Version=%q | API.Title=%q\n", cfg.Frontend.URL, cfg.API.Version, cfg.API.Title)
	fmt.Printf("Upload.UploadDir=%q | MaxUploadMB=%d\n", cfg.Upload.UploadDir, cfg.Upload.MaxUploadMB)
	fmt.Printf("TrustedProxies=%v (期望 [127.0.0.1 ::1])\n", cfg.Server.TrustedProxies)
	fmt.Printf("Admin.UserIDs=%v | EnableTracking=%v | SendBootEmail=%v\n",
		cfg.Admin.UserIDs, cfg.Admin.EnableTracking, cfg.Admin.SendBootEmail)
	fmt.Printf("Amap.KeyAllowedOrigins 数量=%d (期望 6) | Gitee.WebhookSecret=%v\n",
		len(cfg.Amap.KeyAllowedOrigins), cfg.Gitee.WebhookSecret)
}
