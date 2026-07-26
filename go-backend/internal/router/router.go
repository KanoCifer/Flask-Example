// Package router 集中注册所有业务路由。
//
// handler 各自通过 RegisterRoutes 挂载到传入的 *gin.RouterGroup，
// 便于按版本分组（当前统一前缀 /api/v3）。
package router

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"github.com/KanoCifer/kuroome-blog/internal/app"
	"github.com/KanoCifer/kuroome-blog/internal/handler"
	"github.com/KanoCifer/kuroome-blog/internal/middleware"
)

// Setup 装配 gin 引擎：全局中间件 + 路由注册 + 限流。
func Setup(r *gin.Engine, state *app.AppState, redis *redis.Client) {
	r.Use(middleware.Duration())
	r.Use(middleware.Trace())
	r.Use(middleware.SlogMiddleware(slog.Default()))
	r.Use(middleware.CORS())

	v3 := r.Group("/v3")

	// 限流
	loginLimiter := middleware.NewRateLimiter(redis, "login", 5, 60*time.Second)
	registerLimiter := middleware.NewRateLimiter(redis, "register", 5, 60*time.Second)

	userH := handler.NewUserHandler(state.UserSvc(), state.Cfg())
	userH.RegisterRoutes(v3, middleware.AuthMiddleware(), loginLimiter.Middleware(), registerLimiter.Middleware())

	adminH := handler.NewAdminHandler(state.AdminSvc(), state.Cfg())
	adminH.RegisterRoutes(v3, middleware.AuthMiddleware(), middleware.AdminMiddleware(state.Cfg().Admin.UserIDs))

	passkeyH := handler.NewPasskeyHandler(state.PasskeySvc(), state.UserSvc(), state.Cfg())
	passkeyH.RegisterRoutes(v3, middleware.AuthMiddleware())

	githubH := handler.NewGitHubHandler(state.GitHubOAuth(), state.Cfg())
	githubH.RegisterRoutes(v3, middleware.AuthMiddleware())

	blogH := handler.NewBlogHandler(state.BlogSvc())
	blogH.RegisterRoutes(v3)

	deployH := handler.NewDeployHandler(state.Cfg())
	deployH.RegisterRoutes(v3)

	devTaskH := handler.NewDevTaskHandler(state.DevTaskSvc(), state.Cfg())
	devTaskH.RegisterRoutes(v3, middleware.DevTaskMiddleware(), middleware.AuthMiddleware(), middleware.AdminMiddleware(state.Cfg().Admin.UserIDs))

	monitorH := handler.NewMonitorHandler(state.MonitorSvc(), state.Cfg())
	monitorH.RegisterRoutes(v3, middleware.AuthMiddleware(), middleware.AdminMiddleware(state.Cfg().Admin.UserIDs))

	// 向后兼容：旧版 /track → 新的 /status/track
	v3.POST("/track", monitorH.TrackVisitor)

	systemH := handler.NewSystemHandler(state.SystemSvc())
	systemH.RegisterRoutes(v3)

	wsH := handler.NewWSHandler(state.WSSvc())
	wsH.RegisterRoutes(v3)

	fishH := handler.NewFishHandler(state.FishSvc())
	// fish：GET 列表/详情公开；POST / PATCH / DELETE 需 admin 中间件。
	fishH.RegisterRoutes(v3, middleware.AuthMiddleware(), middleware.AdminMiddleware(state.Cfg().Admin.UserIDs))

	weatherH := handler.NewWeatherHandler(state.WeatherSvc())
	// weather：公开访问，对齐 Python 端 /api/v2/weather/*。
	weatherH.RegisterRoutes(v3)

	uploadH := handler.NewUploadHandler(state.UploadSvc(), state.UserSvc())
	uploadH.RegisterRoutes(v3, middleware.AuthMiddleware())

	momentH := handler.NewMomentHandler(state.MomentSvc())
	momentH.RegisterRoutes(v3, middleware.AuthMiddleware(), middleware.AdminMiddleware(state.Cfg().Admin.UserIDs))

	// 媒体静态服务：把上传的文件以 /api/v3/media/* 暴露，对齐 handler 返回的 url。
	// 挂在 Static 前，给响应打上公共缓存头，让 CDN 缓存命中（7d，uuid 命名不可变）。
	r.Use(middleware.MediaCacheMiddleware())
	r.Static("/v3/media", state.Cfg().Upload.UploadDir)
}
