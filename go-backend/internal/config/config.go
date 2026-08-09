package config

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/spf13/viper"
)

// Config 是应用配置的根结构。
type Config struct {
	Server   ServerConfig
	Security SecurityConfig
	Database DatabaseConfig
	Mail     MailConfig
	GitHub   GitHubConfig
	WebAuthn WebAuthnConfig
	Frontend FrontendConfig
	Admin    AdminConfig
	Feishu   FeishuConfig
	Gitee    GiteeConfig
	Amap     AmapConfig
	API      APIConfig
	Weather  WeatherConfig
	Upload   UploadConfig
}

// ServerConfig 服务运行与日志。
type ServerConfig struct {
	Port       int    `mapstructure:"PORT"`
	LogLevel   string `mapstructure:"LOG_LEVEL"`
	DbLogLevel string `mapstructure:"DB_LOG_LEVEL"`
	SaveLogs   bool   `mapstructure:"SAVE_LOGS"`
	ENV        string `mapstructure:"ENV"`
	LogDir string `mapstructure:"LOG_DIR"`
	TrustedProxies []string `mapstructure:"TRUSTED_PROXIES"`
}

// SecurityConfig 安全相关密钥与 Cookie。
type SecurityConfig struct {
	SecretKey     string `mapstructure:"SECRET_KEY"`
	JWTPrivateKey string `mapstructure:"JWT_PRIVATE_KEY"`
	CookieDomain  string `mapstructure:"COOKIE_DOMAIN"`
	APIKey        string `mapstructure:"API_KEY"`

	DevTaskSecret string `mapstructure:"DEV_TASK_SECRET"`
}

// DatabaseConfig 数据库连接。
type DatabaseConfig struct {
	DatabaseURL         string `mapstructure:"DATABASE_URL"`
	MongoURI            string `mapstructure:"MONGO_URI"`
	RedisURL            string `mapstructure:"REDIS_URL"`
	RedisMaxConnections int    `mapstructure:"REDIS_MAX_CONNECTIONS"`
	RabbitMQURL         string `mapstructure:"RABBITMQ_URL"`
}

// MailConfig SMTP 邮件服务。
type MailConfig struct {
	Username string `mapstructure:"MAIL_USERNAME"`
	Password string `mapstructure:"MAIL_PASSWORD"`
	Server   string `mapstructure:"MAIL_SERVER"`
	Port     int    `mapstructure:"MAIL_PORT"`
	FromName string `mapstructure:"MAIL_FROM_NAME"`
}

// GitHubConfig GitHub OAuth。
type GitHubConfig struct {
	ClientID     string `mapstructure:"GITHUB_CLIENT_ID"`
	ClientSecret string `mapstructure:"GITHUB_CLIENT_SECRET"`
	RedirectURI  string `mapstructure:"GITHUB_REDIRECT_URI"`
}

// WebAuthnConfig Passkey / WebAuthn。
type WebAuthnConfig struct {
	RPID   string `mapstructure:"WEBAUTHN_RP_ID"`
	Origin string `mapstructure:"WEBAUTHN_ORIGIN"`
}

// FrontendConfig 前端相关。
type FrontendConfig struct {
	URL            string `mapstructure:"FRONTEND_URL"`
	ViteJSAPIToken string `mapstructure:"VITE_JS_API_TOKEN"`
}

// AdminConfig 管理员与运维。
type AdminConfig struct {
	UserIDs        []int  `mapstructure:"-"`
	EnableTracking bool   `mapstructure:"ENABLE_TRACKING"`
	Email          string `mapstructure:"ADMIN_EMAIL"`
	SendBootEmail  bool   `mapstructure:"SEND_BOOT_EMAIL"`
}

// FeishuConfig 飞书通知。
type FeishuConfig struct {
	WebhookURL string `mapstructure:"FEISHU_WEBHOOK_URL"`
}

// GiteeConfig Gitee webhook。
type GiteeConfig struct {
	WebhookSecret *string `mapstructure:"GITEE_WEBHOOK_SECRET"`
}

// AmapConfig 高德地图。
type AmapConfig struct {
	SecurityCode      string   `mapstructure:"AMAP_SECURITY_CODE"`
	WebKey            string   `mapstructure:"AMAP_WEB_KEY"`
	KeyAllowedOrigins []string `mapstructure:"-"`
}

// APIConfig API 元数据。
type APIConfig struct {
	Version     string `mapstructure:"API_VERSION"`
	Title       string `mapstructure:"API_TITLE"`
	Description string `mapstructure:"API_DESCRIPTION"`
}

// WeatherConfig 天气服务。
type WeatherConfig struct {
	// QweatherBaseURL 和风天气 API 根地址，例如 "https://api.qweather.com"。
	QweatherBaseURL string `mapstructure:"QWEATHER_BASE_URL"`
	// JWTPrivateKey Ed25519 私钥 (PKCS#8 PEM)，用于签发和风天气所需的
	// EdDSA JWT。可包含 "\\n" 转义（环境变量常见写法），
	// 由 qweather.NewSigner 内部处理。
	JWTPrivateKey string `mapstructure:"QWEATHER_JWT_PRIVATE_KEY"`
}

// UploadConfig 上传 / 媒体存储相关。
type UploadConfig struct {
	// UploadDir 文件存储根目录，默认 ./media（与 Python 端 MEDIA_PATH 对齐）。
	UploadDir string `mapstructure:"MEDIA_PATH"`
	// MaxUploadMB 单文件上限（MB），默认 10。
	MaxUploadMB int `mapstructure:"MAX_UPLOAD_MB"`
}

func defaultConfig() Config {
	return Config{
		Server: ServerConfig{
			Port:           5555,
			LogLevel:       "INFO",
			DbLogLevel:     "WARNING",
			SaveLogs:       true,
			ENV:            "prod",
			LogDir:         "./logs",
			TrustedProxies: []string{"127.0.0.1", "::1"},
		},
		Database: DatabaseConfig{
			RedisURL:            "redis://localhost:6379/0",
			RedisMaxConnections: 50,
			RabbitMQURL:         "amqp://guest:guest@localhost:5672/",
		},
		Mail: MailConfig{
			Server:   "smtp.qq.com",
			Port:     587,
			FromName: "Kuroome's Mail Service",
		},
		WebAuthn: WebAuthnConfig{
			RPID:   "kanocifer.chat",
			Origin: "https://kanocifer.chat",
		},
		Frontend: FrontendConfig{
			URL: "https://kanocifer.chat",
		},
		Admin: AdminConfig{
			UserIDs:        []int{1, 2},
			EnableTracking: true,
			SendBootEmail:  true,
		},
		Amap: AmapConfig{
			KeyAllowedOrigins: []string{
				"http://localhost:5173",
				"http://localhost:5174",
				"http://127.0.0.1:5173",
				"http://127.0.0.1:5174",
				"https://kanocifer.chat",
				"https://m.kanocifer.chat",
			},
		},
		API: APIConfig{
			Version:     "5.0.0",
			Title:       "Kuroome API",
			Description: "Kuroome API built with Gin, PostgreSQL, and MongoDB.",
		},
		Upload: UploadConfig{
			UploadDir:   "./media",
			MaxUploadMB: 10,
		},
	}
}

var Cfg *Config

func Load(cfgFile ...string) (*Config, error) {
	cfg := defaultConfig()

	if len(cfgFile) > 0 && cfgFile[0] != "" {
		viper.SetConfigFile(cfgFile[0])
	} else {
		viper.SetConfigName("config")
		viper.SetConfigType("yaml")
		viper.AddConfigPath("./configs")
		viper.AddConfigPath(".")
	}

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("read config file: %w", err)
		}
	}

	viper.AutomaticEnv()

	// 必须在 ReadInConfig + AutomaticEnv 之后再 Unmarshal：否则 viper 的 key
	// store 为空，文件与环境变量全部被忽略，只留下 defaultConfig() 默认值。
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	// 逗号分隔的字符串 → slice；viper 的 mapstructure 不会自动 split。
	// 文件/环境变量未设置对应 key 时 GetString 返回 ""，跳过即保留
	// defaultConfig() 里的默认 slice。
	if origins := viper.GetString("AMAP_KEY_ALLOWED_ORIGINS"); origins != "" {
		cfg.Amap.KeyAllowedOrigins = splitAndTrim(origins)
	}
	if ids := viper.GetString("ADMIN_USER_IDS"); ids != "" {
		cfg.Admin.UserIDs = parseIntList(ids)
	}
	if proxies := viper.GetString("TRUSTED_PROXIES"); proxies != "" {
		cfg.Server.TrustedProxies = splitAndTrim(proxies)
	}

	Cfg = &cfg
	return Cfg, nil
}

// splitAndTrim 按逗号 split 并剔除空白元素。
func splitAndTrim(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// parseIntList 按逗号 split 整数列表。
func parseIntList(s string) []int {
	parts := strings.Split(s, ",")
	out := make([]int, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			if n, err := strconv.Atoi(t); err == nil {
				out = append(out, n)
			}
		}
	}
	return out
}
