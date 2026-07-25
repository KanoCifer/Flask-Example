package app

import (
	"github.com/go-webauthn/webauthn/webauthn"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"gorm.io/gorm"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/repository/mongodb"
	"github.com/KanoCifer/kuroome-blog/internal/repository/postgres"
	"github.com/KanoCifer/kuroome-blog/internal/service"
	"github.com/redis/go-redis/v9"
)

type AppState struct {
	config      *config.Config
	userSvc     service.Userer
	adminSvc    service.Adminer
	blogSvc     service.Bloger
	devTaskSvc  service.DevTasker
	passkeySvc  service.Passkeyer
	githubOAuth service.GitHubOAuther
	monitorSvc  service.Monitorer
	systemSvc   service.Systemer
	wsSvc       service.WSer
	fishSvc     service.Fisher
	uploadSvc   service.Uploader
	momentSvc   service.Momenter
}

// NewAppState 组装所有 service，作为唯一的组合根入口。
// main.go 仅负责构造基础依赖 (db / mongo / redis / webauthn) 并传入；
// 所有 service 在此统一构造，不再散落 main.go。
func NewAppState(
	cfg *config.Config,
	db *gorm.DB,
	mongoDB *mongo.Database,
	redis *redis.Client,
	wa *webauthn.WebAuthn,
) *AppState {
	// -- repos ------------------------------------------------------- //
	// postgres
	userRepo := postgres.NewUserRepo(db)
	visitorRepo := postgres.NewVisitorRepo(db)
	eventRepo := postgres.NewEventRepo(db)
	passkeyRepo := postgres.NewPasskeyRepo(db)

	// mongodb
	fishRepo := mongodb.NewFishRepo(mongoDB)
	adminRepo := mongodb.NewAdminRepo(mongoDB)
	blogRepo := mongodb.NewBlogRepository(mongoDB)

	// -- services ---------------------------------------------------- //
	userSvc := service.NewUserService(userRepo, redis, cfg.Admin.UserIDs)
	return &AppState{
		config:     cfg,
		userSvc:    userSvc,
		adminSvc:   service.NewAdminService(adminRepo, visitorRepo, redis),
		blogSvc:    service.NewBlogService(blogRepo),
		devTaskSvc: service.NewDevTaskService(mongoDB),
		passkeySvc: service.NewPasskeyService(wa, redis, passkeyRepo, userRepo),
		monitorSvc: service.NewMonitorService(visitorRepo, userRepo, cfg.API.Version),
		systemSvc:  service.NewSystemService(eventRepo),
		wsSvc:      service.NewWSService(redis),
		githubOAuth: service.NewGitHubOAuth(
			redis, userRepo, userSvc,
			cfg.GitHub.ClientID, cfg.GitHub.ClientSecret, cfg.GitHub.RedirectURI,
		),
		fishSvc:   service.NewFishService(fishRepo),
		uploadSvc: service.NewUploadService(userRepo, cfg),
		momentSvc: service.NewMomentService(mongoDB),
	}
}

// Dependency Injection
func (a *AppState) UserSvc() service.Userer            { return a.userSvc }
func (a *AppState) AdminSvc() service.Adminer          { return a.adminSvc }
func (a *AppState) BlogSvc() service.Bloger            { return a.blogSvc }
func (a *AppState) DevTaskSvc() service.DevTasker      { return a.devTaskSvc }
func (a *AppState) PasskeySvc() service.Passkeyer      { return a.passkeySvc }
func (a *AppState) WSSvc() service.WSer                { return a.wsSvc }
func (a *AppState) MonitorSvc() service.Monitorer      { return a.monitorSvc }
func (a *AppState) SystemSvc() service.Systemer        { return a.systemSvc }
func (a *AppState) GitHubOAuth() service.GitHubOAuther { return a.githubOAuth }
func (a *AppState) FishSvc() service.Fisher            { return a.fishSvc }
func (a *AppState) UploadSvc() service.Uploader        { return a.uploadSvc }
func (a *AppState) MomentSvc() service.Momenter        { return a.momentSvc }

func (a *AppState) Cfg() *config.Config { return a.config }
