package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
)

func TestGetSecurityKey_AllowedOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	cfg := &config.Config{}
	cfg.Amap.SecurityCode = "test-secret"
	cfg.Amap.KeyAllowedOrigins = []string{"https://kanocifer.chat"}

	h := NewAmapHandler(cfg)
	h.RegisterRoutes(r.Group("/"))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/amap/security-key", nil)
	req.Header.Set("Origin", "https://kanocifer.chat")
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("status = %d, want 200", w.Code)
	}

	var resp struct {
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Data["securityJsCode"] == nil {
		t.Error("expected securityJsCode in response")
	}
}

func TestGetSecurityKey_ForbiddenOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	cfg := &config.Config{}
	cfg.Amap.SecurityCode = "test-secret"
	cfg.Amap.KeyAllowedOrigins = []string{"https://kanocifer.chat"}

	h := NewAmapHandler(cfg)
	h.RegisterRoutes(r.Group("/"))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/amap/security-key", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	r.ServeHTTP(w, req)

	if w.Code != 403 {
		t.Errorf("status = %d, want 403", w.Code)
	}
}

func TestGetSecurityKey_NoOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	cfg := &config.Config{}
	cfg.Amap.SecurityCode = "test-secret"
	cfg.Amap.KeyAllowedOrigins = []string{"https://kanocifer.chat"}

	h := NewAmapHandler(cfg)
	h.RegisterRoutes(r.Group("/"))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/amap/security-key", nil)
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("status = %d, want 200", w.Code)
	}
}
