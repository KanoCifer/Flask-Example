package qweather

import (
	"context"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

// genTestKey 生成一对 Ed25519 密钥并返回 PEM 字符串 + 原始 PrivateKey。
func genTestKey(t *testing.T) (string, ed25519.PrivateKey) {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("MarshalPKCS8PrivateKey: %v", err)
	}
	pemStr := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pkcs8}))
	return pemStr, priv
}

func TestNewSigner_Empty(t *testing.T) {
	if _, err := NewSigner(""); err == nil {
		t.Fatal("expected error for empty PEM")
	}
}

func TestNewSigner_InvalidPEM(t *testing.T) {
	if _, err := NewSigner("not a pem"); err == nil {
		t.Fatal("expected error for invalid PEM")
	}
}

func TestNewSigner_EscapedNewlines(t *testing.T) {
	pemStr, _ := genTestKey(t)
	// 模拟环境变量里 \n 的转义
	escaped := strings.ReplaceAll(pemStr, "\n", "\\n")
	signer, err := NewSigner(escaped)
	if err != nil {
		t.Fatalf("NewSigner with escaped newlines: %v", err)
	}
	if _, err := signer.Sign(time.Now()); err != nil {
		t.Fatalf("Sign: %v", err)
	}
}

func TestSigner_Sign_FormatAndAlg(t *testing.T) {
	pemStr, priv := genTestKey(t)
	signer, err := NewSigner(pemStr)
	if err != nil {
		t.Fatalf("NewSigner: %v", err)
	}
	now := time.Unix(1_700_000_000, 0)
	token, err := signer.Sign(now)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("token should have 3 parts, got %d", len(parts))
	}

	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		t.Fatalf("decode header: %v", err)
	}
	if !strings.Contains(string(headerJSON), `"alg":"EdDSA"`) {
		t.Errorf("header missing EdDSA alg: %s", headerJSON)
	}
	if !strings.Contains(string(headerJSON), `"kid":"`+defaultKid+`"`) {
		t.Errorf("header missing kid: %s", headerJSON)
	}

	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if !strings.Contains(string(payloadJSON), `"sub":"`+defaultSub+`"`) {
		t.Errorf("payload missing sub: %s", payloadJSON)
	}

	// 校验签名
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		t.Fatalf("decode sig: %v", err)
	}
	pub, ok := priv.Public().(ed25519.PublicKey)
	if !ok {
		t.Fatal("priv.Public() not ed25519.PublicKey")
	}
	if !ed25519.Verify(pub, []byte(parts[0]+"."+parts[1]), sig) {
		t.Error("signature verification failed")
	}
}

func TestSigner_Cached_HitMiss(t *testing.T) {
	pemStr, _ := genTestKey(t)
	signer, _ := NewSigner(pemStr)

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run: %v", err)
	}
	defer mr.Close()
	r := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer r.Close()

	now := time.Now()

	// 首次获取 → 未命中，写入
	tok1, err := signer.Cached(context.Background(), r, 24*time.Hour, now)
	if err != nil {
		t.Fatalf("Cached first: %v", err)
	}

	// 第二次 → 应返回相同 token
	tok2, err := signer.Cached(context.Background(), r, 24*time.Hour, now)
	if err != nil {
		t.Fatalf("Cached second: %v", err)
	}
	if tok1 != tok2 {
		t.Errorf("cached token mismatch: %q vs %q", tok1, tok2)
	}

	// 验证 redis 里确实存了
	cached, err := r.Get(context.Background(), qweatherJWTKey).Result()
	if err != nil {
		t.Fatalf("redis get: %v", err)
	}
	if cached != tok1 {
		t.Errorf("redis cached token = %q, want %q", cached, tok1)
	}
}

func TestSigner_Cached_NilRedis(t *testing.T) {
	pemStr, _ := genTestKey(t)
	signer, _ := NewSigner(pemStr)
	tok, err := signer.Cached(context.Background(), nil, 0, time.Now())
	if err != nil {
		t.Fatalf("Cached with nil redis: %v", err)
	}
	if tok == "" {
		t.Error("expected non-empty token")
	}
}