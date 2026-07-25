package errs

import "errors"

// 业务错误，跨 service / handler / 测试统一引用，避免各层直接依赖 service 包。

var (
	// user
	ErrInvalidCredentials = errors.New("用户名或密码错误")
	ErrUserExists         = errors.New("用户名已存在")
	ErrEmailExists        = errors.New("邮箱已注册")
	ErrInvalidEmailCode   = errors.New("验证码无效")
	ErrUserNotFound       = errors.New("用户不存在")
	ErrInvalidToken       = errors.New("无效的令牌")

	// mongodb
	ErrPostNotFound  = errors.New("blog post not found")
	ErrInvalidPostID = errors.New("invalid post id")

	ErrInvalidObjectID = errors.New("Invalid ObjectID")

	// Moment
	ErrMomentNotFound = errors.New("moment not found")

	// Passkey / WebAuthn 错误
	ErrPasskeyExists   = errors.New("您的账户已经绑定了Passkey")
	ErrPasskeyNotFound = errors.New("Passkey 凭证不存在")
	ErrInvalidPasskey  = errors.New("无效的 Passkey 认证响应")

	// DevTask 错误
	ErrTaskNotFound = errors.New("task not found")

	// GitHub OAuth 错误
	ErrGitHubNotConfigured = errors.New("GitHub OAuth 未配置")
	ErrInvalidOAuthState   = errors.New("state 无效或已过期")
	ErrGitHubAlreadyBound  = errors.New("该 GitHub 账户已被绑定")

	// 上传 / 媒体错误
	ErrInvalidUploadType    = errors.New("未知的上传类型")
	ErrUnsupportedImageType = errors.New("不支持的图片类型")
	ErrImageTooLarge        = errors.New("图片过大")
	ErrInvalidImageData     = errors.New("无效的图片数据")
)
