package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/domain/passkey/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/model"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ---------- mock PasskeyService ----------

type mockPasskeyService struct {
	beginRegistrationFn  func(ctx context.Context, userID uint) (map[string]any, error)
	finishRegistrationFn func(ctx context.Context, userID uint, response map[string]any) error
	beginLoginFn         func(ctx context.Context) (map[string]any, error)
	finishLoginFn        func(ctx context.Context, response map[string]any) (*model.User, error)
	deletePasskeyFn      func(ctx context.Context, userID uint) error
	hasPasskeyFn         func(ctx context.Context, userID uint) bool
}

func (m *mockPasskeyService) BeginRegistration(ctx context.Context, userID uint) (map[string]any, error) {
	if m.beginRegistrationFn != nil {
		return m.beginRegistrationFn(ctx, userID)
	}
	return map[string]any{"challenge": "abc"}, nil
}

func (m *mockPasskeyService) FinishRegistration(ctx context.Context, userID uint, response map[string]any) error {
	if m.finishRegistrationFn != nil {
		return m.finishRegistrationFn(ctx, userID, response)
	}
	return nil
}

func (m *mockPasskeyService) BeginLogin(ctx context.Context) (map[string]any, error) {
	if m.beginLoginFn != nil {
		return m.beginLoginFn(ctx)
	}
	return map[string]any{"challenge": "xyz"}, nil
}

func (m *mockPasskeyService) FinishLogin(ctx context.Context, response map[string]any) (*model.User, error) {
	if m.finishLoginFn != nil {
		return m.finishLoginFn(ctx, response)
	}
	return &model.User{Model: passkeyGormModel(1), Username: "alice"}, nil
}

func (m *mockPasskeyService) DeletePasskey(ctx context.Context, userID uint) error {
	if m.deletePasskeyFn != nil {
		return m.deletePasskeyFn(ctx, userID)
	}
	return nil
}

func (m *mockPasskeyService) HasPasskey(ctx context.Context, userID uint) bool {
	if m.hasPasskeyFn != nil {
		return m.hasPasskeyFn(ctx, userID)
	}
	return false
}

// ---------- helpers ----------

func passkeyGormModel(id uint) gorm.Model {
	return gorm.Model{ID: id}
}

func doPasskeyRequest(h gin.HandlerFunc, method, path string, body []byte) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(method, path, bytes.NewReader(body))
	if body != nil {
		c.Request.Header.Set("Content-Type", "application/json")
	}
	h(c)
	return w
}

func parsePasskeyResp(t *testing.T, body []byte) (data map[string]any, message string) {
	t.Helper()
	var resp struct {
		Data    map[string]any `json:"data"`
		Message string         `json:"message"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	return resp.Data, message
}

func parsePasskeyMessage(t *testing.T, body []byte) string {
	t.Helper()
	var resp struct {
		Message string `json:"message"`
	}
	_ = json.Unmarshal(body, &resp)
	return resp.Message
}

// ---------- RegistrationOptions ----------

func TestRegistrationOptions_Success(t *testing.T) {
	svc := &mockPasskeyService{
		beginRegistrationFn: func(ctx context.Context, userID uint) (map[string]any, error) {
			return map[string]any{"challenge": "abc", "rp": "test"}, nil
		},
	}
	h := NewPasskeyHandler(svc, nil, config.Cfg)

	w := doPasskeyRequest(h.RegistrationOptions, http.MethodGet, "/passkey/registration-options", nil)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	data, _ := parsePasskeyResp(t, w.Body.Bytes())
	if data["challenge"] != "abc" {
		t.Errorf("challenge = %v, want abc", data["challenge"])
	}
}

func TestRegistrationOptions_AlreadyExists(t *testing.T) {
	svc := &mockPasskeyService{
		beginRegistrationFn: func(ctx context.Context, userID uint) (map[string]any, error) {
			return nil, passkeyerrs.ErrPasskeyExists
		},
	}
	h := NewPasskeyHandler(svc, nil, config.Cfg)

	w := doPasskeyRequest(h.RegistrationOptions, http.MethodGet, "/passkey/registration-options", nil)
	if w.Code != 400 {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

// ---------- Register ----------

func TestPasskeyRegister_Success(t *testing.T) {
	svc := &mockPasskeyService{
		finishRegistrationFn: func(ctx context.Context, userID uint, response map[string]any) error {
			return nil
		},
	}
	h := NewPasskeyHandler(svc, nil, config.Cfg)

	body, _ := json.Marshal(dto.PasskeyRegistrationRequest{
		Response: map[string]any{"id": "cred123"},
	})
	w := doPasskeyRequest(h.Register, http.MethodPost, "/passkey/register", body)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestPasskeyRegister_InvalidResponse(t *testing.T) {
	svc := &mockPasskeyService{
		finishRegistrationFn: func(ctx context.Context, userID uint, response map[string]any) error {
			return passkeyerrs.ErrInvalidPasskey
		},
	}
	h := NewPasskeyHandler(svc, nil, config.Cfg)

	body, _ := json.Marshal(dto.PasskeyRegistrationRequest{
		Response: map[string]any{"id": "bad"},
	})
	w := doPasskeyRequest(h.Register, http.MethodPost, "/passkey/register", body)
	if w.Code != 400 {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

// ---------- AuthenticationOptions ----------

func TestAuthenticationOptions_Success(t *testing.T) {
	svc := &mockPasskeyService{
		beginLoginFn: func(ctx context.Context) (map[string]any, error) {
			return map[string]any{"challenge": "xyz"}, nil
		},
	}
	h := NewPasskeyHandler(svc, nil, config.Cfg)

	w := doPasskeyRequest(h.AuthenticationOptions, http.MethodGet, "/passkey/authentication-options", nil)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	data, _ := parsePasskeyResp(t, w.Body.Bytes())
	if data["challenge"] != "xyz" {
		t.Errorf("challenge = %v, want xyz", data["challenge"])
	}
}

// ---------- Authenticate ----------

func TestAuthenticate_Success(t *testing.T) {
	svc := &mockPasskeyService{
		finishLoginFn: func(ctx context.Context, response map[string]any) (*model.User, error) {
			// 与 GetByCredentialID 预加载行为一致:返回含 PasskeyCredential 的用户
			return &model.User{Model: passkeyGormModel(1), Username: "alice", PasskeyCredential: &model.PasskeyCredential{}}, nil
		},
	}
	mockUserSvc := &mockUserService{
		createTokensFn: func(ctx context.Context, u *model.User) (*dto.TokensResponse, error) {
			return &dto.TokensResponse{AccessToken: "access", RefreshToken: "refresh"}, nil
		},
	}
	h := NewPasskeyHandler(svc, mockUserSvc, config.Cfg)

	body, _ := json.Marshal(dto.PasskeyAuthRequest{
		Assertion: map[string]any{"id": "cred123"},
	})
	w := doPasskeyRequest(h.Authenticate, http.MethodPost, "/passkey/authenticate", body)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	data, _ := parsePasskeyResp(t, w.Body.Bytes())
	if data["access_token"] != "access" {
		t.Errorf("access_token = %v, want access", data["access_token"])
	}
	if v, ok := data["has_passkey"].(bool); !ok || !v {
		t.Error("expected has_passkey=true in user data")
	}
	if _, ok := data["github_bound"].(bool); !ok {
		t.Error("expected github_bound field present in user data")
	}
}

func TestAuthenticate_InvalidPasskey(t *testing.T) {
	svc := &mockPasskeyService{
		finishLoginFn: func(ctx context.Context, response map[string]any) (*model.User, error) {
			return nil, passkeyerrs.ErrInvalidPasskey
		},
	}
	h := NewPasskeyHandler(svc, nil, config.Cfg)

	body, _ := json.Marshal(dto.PasskeyAuthRequest{
		Assertion: map[string]any{"id": "bad"},
	})
	w := doPasskeyRequest(h.Authenticate, http.MethodPost, "/passkey/authenticate", body)
	if w.Code != 400 {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

// ---------- DeletePasskey ----------

func TestDeletePasskey_Success(t *testing.T) {
	svc := &mockPasskeyService{
		deletePasskeyFn: func(ctx context.Context, userID uint) error {
			return nil
		},
	}
	h := NewPasskeyHandler(svc, nil, config.Cfg)

	w := doPasskeyRequest(h.DeletePasskey, http.MethodDelete, "/passkey/delete", nil)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestDeletePasskey_NotFound(t *testing.T) {
	svc := &mockPasskeyService{
		deletePasskeyFn: func(ctx context.Context, userID uint) error {
			return passkeyerrs.ErrPasskeyNotFound
		},
	}
	h := NewPasskeyHandler(svc, nil, config.Cfg)

	w := doPasskeyRequest(h.DeletePasskey, http.MethodDelete, "/passkey/delete", nil)
	if w.Code != 400 {
		t.Errorf("status = %d, want 400", w.Code)
	}
}
