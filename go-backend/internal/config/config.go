// Package config 提供应用配置加载：环境变量 > 配置文件 > 缺省值。
//
// Config 按域拆分子配置，便于各模块只注入自己需要的部分。字段名与 Python
// 后端 Settings 类 1:1 对齐，mapstructure tag 对应环境变量名（大写）。
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
	// LogDir 日志目录。空字符串=用默认 ./logs/，文件名 app.log / app_error.log。
	// 与 Python 端 Settings.LOG_DIR 字段对齐。
	LogDir string `mapstructure:"LOG_DIR"`
}

// SecurityConfig 安全相关密钥与 Cookie。
type SecurityConfig struct {
	SecretKey     string `mapstructure:"SECRET_KEY"`
	JWTPrivateKey string `mapstructure:"JWT_PRIVATE_KEY"`
	CookieDomain  string `mapstructure:"COOKIE_DOMAIN"`
	APIKey        string `mapstructure:"API_KEY"`
	// DevTaskSecret —— 服务级 JWT 签名密钥（devtask / MCP 专用）。
	// 独立于 SecretKey（用户 JWT），避免 service token 被当作用户 token 接受。
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
	UserIDs        []int  `mapstructure:"-"` // derived from ADMIN_USER_IDS
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
	KeyAllowedOrigins []string `mapstructure:"-"` // derived from AMAP_KEY_ALLOWED_ORIGINS
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

// 缺省值映射；viper 按 key 查找，嵌套 struct 的 key 与根级一致（viper 不自动
// 加前缀），所以这里仍然用扁平 key。
var defaults = map[string]any{
	"PORT":                     5555,
	"LOG_LEVEL":                "INFO",
	"DB_LOG_LEVEL":             "WARNING",
	"ENV":                      "prod",
	"SAVE_LOGS":                true,
	"LOG_DIR":                  "./logs",
	"SECRET_KEY":               "",
	"JWT_PRIVATE_KEY":          "",
	"COOKIE_DOMAIN":            "",
	"API_KEY":                  "",
	"DATABASE_URL":             "",
	"MONGO_URI":                "",
	"REDIS_URL":                "redis://localhost:6379/0",
	"REDIS_MAX_CONNECTIONS":    50,
	"RABBITMQ_URL":             "amqp://guest:guest@localhost:5672/",
	"MAIL_USERNAME":            "",
	"MAIL_PASSWORD":            "",
	"MAIL_SERVER":              "smtp.qq.com",
	"MAIL_PORT":                587,
	"MAIL_FROM_NAME":           "Kuroome's Mail Service",
	"GITHUB_CLIENT_ID":         "",
	"GITHUB_CLIENT_SECRET":     "",
	"GITHUB_REDIRECT_URI":      "",
	"WEBAUTHN_RP_ID":           "kanocifer.chat",
	"WEBAUTHN_ORIGIN":          "https://kanocifer.chat",
	"FRONTEND_URL":             "https://kanocifer.chat",
	"VITE_JS_API_TOKEN":        "",
	"ADMIN_USER_IDS":           "1,2",
	"ENABLE_TRACKING":          true,
	"ADMIN_EMAIL":              "",
	"SEND_BOOT_EMAIL":          true,
	"FEISHU_WEBHOOK_URL":       "",
	"GITEE_WEBHOOK_SECRET":     nil,
	"AMAP_SECURITY_CODE":       "",
	"AMAP_WEB_KEY":             "",
	"AMAP_KEY_ALLOWED_ORIGINS": "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,https://kanocifer.chat,https://m.kanocifer.chat",
	"API_VERSION":              "4.0.0",
	"API_TITLE":                "Reading List API",
	"API_DESCRIPTION":          "API文档。Personal reading tracker API built with FastAPI, PostgreSQL, and MongoDB.",
	"QWEATHER_BASE_URL":        "",
	"MEDIA_PATH":               "./media",
	"MAX_UPLOAD_MB":            10,
}

var Cfg *Config

// Load 读取配置：环境变量 > 配置文件 > 缺省值。
//
// cfgFile 非空时作为显式路径；否则查找 ./configs/config.yaml。配置文件缺失
// 不是 fatal（仅解析错误会返回错误），缺失字段回退到 defaults。
func Load(cfgFile ...string) (*Config, error) {
	for k, v := range defaults {
		viper.SetDefault(k, v)
	}

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

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	// 逗号分隔的字符串 → slice；viper 的 mapstructure 不会自动 split。
	if origins := viper.GetString("AMAP_KEY_ALLOWED_ORIGINS"); origins != "" {
		cfg.Amap.KeyAllowedOrigins = splitAndTrim(origins)
	}
	if ids := viper.GetString("ADMIN_USER_IDS"); ids != "" {
		cfg.Admin.UserIDs = parseIntList(ids)
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
