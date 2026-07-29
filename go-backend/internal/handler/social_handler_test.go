package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAddLike_InvalidBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewSocialHandler(nil)
	h.RegisterRoutes(r.Group("/"))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/likes", strings.NewReader(`invalid`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != 400 {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestAddLike_ZeroCount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewSocialHandler(nil)
	h.RegisterRoutes(r.Group("/"))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/likes", strings.NewReader(`{"likes_count": 0}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != 400 {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestGetLikes_RouteRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewSocialHandler(nil)
	h.RegisterRoutes(r.Group("/"))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/likes", nil)
	r.ServeHTTP(w, req)

	// nil redis → 500, but route is registered and handler executes
	if w.Code != 500 {
		t.Errorf("status = %d, want 500 (nil redis)", w.Code)
	}
}

func TestAddLike_ResponseShape(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewSocialHandler(nil)
	h.RegisterRoutes(r.Group("/"))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/likes", strings.NewReader(`{"likes_count": 1}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	var resp struct {
		Data    map[string]any `json:"data"`
		Message string         `json:"message"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Message == "" {
		t.Error("expected non-empty message")
	}
}
