// Package qweather 提供与和风天气 API 交互所需的工具，目前包含 EdDSA
// (Ed25519) JWT 签名器，行为对齐 backend/app/utils/qweather_jwt.py。
//
// 和风天气要求请求头携带 EdDSA 签名 JWT。Signer 内部持有不可变私钥，
// 线程安全，可在多个 goroutine 间共享。
package qweather

import (
	"context"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// qweatherJWTKey 是 JWT 在 redis 中的缓存键，与 Python 端对齐。
const qweatherJWTKey = "qweather:jwt"

// 和风天气 JWT 头与 payload 中的固定字段，对应 Python 端硬编码值。
const (
	defaultSub = "2CTM8FQW28"
	defaultKid = "CKPM9U7FMW"
)

// Signer 持有 Ed25519 私钥，可签名出和风天气所需的 EdDSA JWT。
type Signer struct {
	priv ed25519.PrivateKey
	sub  string
	kid  string
}

// NewSigner 解析 PEM (PKCS#8) 编码的 Ed25519 私钥。
// pemStr 可包含 "\\n" 转义（环境变量常见写法），函数内部会做替换。
// 若私钥是 PKCS#1 格式，可用 `openssl pkcs8 -topk8 -nocrypt` 转换。
func NewSigner(pemStr string) (*Signer, error) {
	if pemStr == "" {
		return nil, errors.New("qweather: empty PEM private key")
	}
	pemStr = strings.ReplaceAll(pemStr, "\\n", "\n")

	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("qweather: invalid PEM block")
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("qweather: parse PKCS#8 private key: %w", err)
	}
	edKey, ok := key.(ed25519.PrivateKey)
	if !ok {
		return nil, errors.New("qweather: PKCS#8 key is not Ed25519")
	}
	return &Signer{priv: edKey, sub: defaultSub, kid: defaultKid}, nil
}

// Sign 签名生成 JWT。iat = now - 10s，exp = now + 86390s，与 Python
// 端保持一致以容忍两端时钟偏差。now 可注入便于测试。
func (s *Signer) Sign(now time.Time) (string, error) {
	iat := now.Unix() - 10
	exp := now.Unix() + 86390
	payload := fmt.Sprintf(`{"iat":%d,"exp":%d,"sub":%q}`, iat, exp, s.sub)
	header := fmt.Sprintf(`{"alg":"EdDSA","kid":%q}`, s.kid)

	signingInput := b64url([]byte(header)) + "." + b64url([]byte(payload))
	sig := ed25519.Sign(s.priv, []byte(signingInput))
	return signingInput + "." + b64url(sig), nil
}

// Cached 返回缓存中的 JWT；未命中则签名一个新 token 并写入 redis。
// r 为 nil 时直接签名（用于测试或禁用缓存场景）。
// ttl 通常设为 24h 但建议略小于 JWT 自身的 exp。
func (s *Signer) Cached(ctx context.Context, r redis.Cmdable, ttl time.Duration, now time.Time) (string, error) {
	if r != nil {
		cached, err := r.Get(ctx, qweatherJWTKey).Result()
		if err == nil && cached != "" {
			return cached, nil
		}
	}
	token, err := s.Sign(now)
	if err != nil {
		return "", err
	}
	if r != nil {
		_ = r.Set(ctx, qweatherJWTKey, token, ttl).Err()
	}
	return token, nil
}

func b64url(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}
