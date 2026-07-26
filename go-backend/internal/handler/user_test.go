package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/domain/user/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/logger"
	"github.com/KanoCifer/kuroome-blog/internal/middleware"
	"github.com/KanoCifer/kuroome-blog/internal/model"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ---------- mock UserService ----------

type mockUserService struct {
	authenticateFn  func(ctx context.Context, username, password string) (*model.User, error)
	createTokensFn  func(ctx context.Context, u *model.User) (*dto.TokensResponse, error)
	createUserFn    func(ctx context.Context, username, password, email, emailCode, avatarURL string) (*model.User, *model.Profile, error)
	getByIDFn       func(ctx context.Context, userID uint) (*model.User, *model.Profile, error)
	getByUsernameFn func(ctx context.Context, username string) (*model.User, *model.Profile, error)
	logoutFn        func(ctx context.Context, userID uint)
	refreshFn       func(ctx context.Context, refreshToken string) (*dto.TokensResponse, error)
	sendEmailCodeFn func(ctx context.Context, email string) bool
	userToDictFn    func(u *model.User, p *model.Profile) map[string]any
}

func (m *mockUserService) Authenticate(ctx context.Context, username, password string) (*model.User, error) {
	return m.authenticateFn(ctx, username, password)
}

func (m *mockUserService) CreateTokens(ctx context.Context, u *model.User) (*dto.TokensResponse, error) {
	if m.createTokensFn != nil {
		return m.createTokensFn(ctx, u)
	}
	return &dto.TokensResponse{AccessToken: "access", RefreshToken: "refresh"}, nil
}

func (m *mockUserService) CreateUser(ctx context.Context, username, password, email, emailCode, avatarURL string) (*model.User, *model.Profile, error) {
	return m.createUserFn(ctx, username, password, email, emailCode, avatarURL)
}

func (m *mockUserService) GetByID(ctx context.Context, userID uint) (*model.User, *model.Profile, error) {
	return m.getByIDFn(ctx, userID)
}

func (m *mockUserService) GetByUsername(ctx context.Context, username string) (*model.User, *model.Profile, error) {
	if m.getByUsernameFn != nil {
		return m.getByUsernameFn(ctx, username)
	}
	return nil, nil, nil
}

func (m *mockUserService) Logout(ctx context.Context, userID uint) {
	if m.logoutFn != nil {
		m.logoutFn(ctx, userID)
	}
}

func (m *mockUserService) RefreshTokens(ctx context.Context, refreshToken string) (*dto.TokensResponse, error) {
	return m.refreshFn(ctx, refreshToken)
}

func (m *mockUserService) SendEmailCode(ctx context.Context, email string) bool {
	if m.sendEmailCodeFn != nil {
		return m.sendEmailCodeFn(ctx, email)
	}
	return true
}

func (m *mockUserService) UserToDict(u *model.User, p *model.Profile) map[string]any {
	if m.userToDictFn != nil {
		return m.userToDictFn(u, p)
	}
	return map[string]any{
		"id":           u.ID,
		"username":     u.Username,
		"has_passkey":  u.PasskeyCredential != nil,
		"github_bound": u.GithubID != nil,
	}
}

// ---------- helpers ----------

func doRequest(h gin.HandlerFunc, method, path string, body []byte) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(method, path, bytes.NewReader(body))
	if body != nil {
		c.Request.Header.Set("Content-Type", "application/json")
	}
	h(c)
	return w
}

func jsonBody(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}
	return b
}

func parseResp(t *testing.T, body []byte) (data map[string]any, message string) {
	t.Helper()
	var resp struct {
		Data    map[string]any `json:"data"`
		Message string         `json:"message"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	return resp.Data, resp.Message
}

// findCookie 从响应中按名查找 Set-Cookie。
func findCookie(w *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range w.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// ---------- Login ----------

func TestLogin_Success(t *testing.T) {
	svc := &mockUserService{
		authenticateFn: func(ctx context.Context, username, password string) (*model.User, error) {
			return &model.User{Model: gormModel(1), Username: "alice"}, nil
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := doRequest(h.Login, http.MethodPost, "/login", jsonBody(t, dto.LoginRequest{
		Username: "alice",
		Password: "secret",
	}))

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	data, _ := parseResp(t, w.Body.Bytes())
	if data["access_token"] == nil {
		t.Error("expected access_token in response")
	}
	if cookie := findCookie(w, "refresh_token"); cookie == nil || cookie.Value != "refresh" {
		t.Error("expected refresh_token cookie to be set on login")
	}
	if _, ok := data["has_passkey"].(bool); !ok {
		t.Error("expected has_passkey field present in user data")
	}
	if _, ok := data["github_bound"].(bool); !ok {
		t.Error("expected github_bound field present in user data")
	}
}

func TestLogin_InvalidCredentials(t *testing.T) {
	svc := &mockUserService{
		authenticateFn: func(ctx context.Context, username, password string) (*model.User, error) {
			return nil, usererrs.ErrInvalidCredentials
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := doRequest(h.Login, http.MethodPost, "/login", jsonBody(t, dto.LoginRequest{
		Username: "alice",
		Password: "wrong",
	}))

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestLogin_InvalidBody(t *testing.T) {
	svc := &mockUserService{
		authenticateFn: func(ctx context.Context, username, password string) (*model.User, error) {
			return &model.User{}, nil
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := doRequest(h.Login, http.MethodPost, "/login", []byte("not json"))

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestLogin_TokenError(t *testing.T) {
	svc := &mockUserService{
		authenticateFn: func(ctx context.Context, username, password string) (*model.User, error) {
			return &model.User{Model: gormModel(1)}, nil
		},
		createTokensFn: func(ctx context.Context, u *model.User) (*dto.TokensResponse, error) {
			return nil, errors.New("jwt error")
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := doRequest(h.Login, http.MethodPost, "/login", jsonBody(t, dto.LoginRequest{
		Username: "alice",
		Password: "secret",
	}))

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}

// ---------- Register ----------

func TestRegister_Success(t *testing.T) {
	svc := &mockUserService{
		createUserFn: func(ctx context.Context, username, password, email, emailCode, avatarURL string) (*model.User, *model.Profile, error) {
			return &model.User{Model: gormModel(5), Username: username}, nil, nil
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := doRequest(h.Register, http.MethodPost, "/register", jsonBody(t, dto.RegisterRequest{
		Username:  "bob",
		Password:  "secret123",
		Email:     "bob@example.com",
		EmailCode: "123456",
	}))

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	_, msg := parseResp(t, w.Body.Bytes())
	if msg != "注册成功" {
		t.Errorf("message = %q, want %q", msg, "注册成功")
	}
}

func TestRegister_UserExists(t *testing.T) {
	svc := &mockUserService{
		createUserFn: func(ctx context.Context, username, password, email, emailCode, avatarURL string) (*model.User, *model.Profile, error) {
			return nil, nil, usererrs.ErrUserExists
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := doRequest(h.Register, http.MethodPost, "/register", jsonBody(t, dto.RegisterRequest{
		Username:  "bob",
		Password:  "secret123",
		Email:     "bob@example.com",
		EmailCode: "123456",
	}))

	if w.Code != http.StatusConflict {
		t.Errorf("status = %d, want %d", w.Code, http.StatusConflict)
	}
}

func TestRegister_EmailExists(t *testing.T) {
	svc := &mockUserService{
		createUserFn: func(ctx context.Context, username, password, email, emailCode, avatarURL string) (*model.User, *model.Profile, error) {
			return nil, nil, usererrs.ErrEmailExists
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := doRequest(h.Register, http.MethodPost, "/register", jsonBody(t, dto.RegisterRequest{
		Username:  "bob",
		Password:  "secret123",
		Email:     "bob@example.com",
		EmailCode: "123456",
	}))

	if w.Code != http.StatusConflict {
		t.Errorf("status = %d, want %d", w.Code, http.StatusConflict)
	}
}

func TestRegister_InvalidEmailCode(t *testing.T) {
	svc := &mockUserService{
		createUserFn: func(ctx context.Context, username, password, email, emailCode, avatarURL string) (*model.User, *model.Profile, error) {
			return nil, nil, usererrs.ErrInvalidEmailCode
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := doRequest(h.Register, http.MethodPost, "/register", jsonBody(t, dto.RegisterRequest{
		Username:  "bob",
		Password:  "secret123",
		Email:     "bob@example.com",
		EmailCode: "wrong",
	}))

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestRegister_InvalidBody(t *testing.T) {
	svc := &mockUserService{
		createUserFn: func(ctx context.Context, username, password, email, emailCode, avatarURL string) (*model.User, *model.Profile, error) {
			return &model.User{}, nil, nil
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := doRequest(h.Register, http.MethodPost, "/register", []byte("not json"))

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ---------- Me ----------

func TestMe_Success(t *testing.T) {
	svc := &mockUserService{
		getByIDFn: func(ctx context.Context, userID uint) (*model.User, *model.Profile, error) {
			return &model.User{Model: gormModel(7), Username: "alice"}, nil, nil
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/me", nil)
	c.Set("user_id", 7)
	h.Me(c)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestMe_UserNotFound(t *testing.T) {
	svc := &mockUserService{
		getByIDFn: func(ctx context.Context, userID uint) (*model.User, *model.Profile, error) {
			return nil, nil, usererrs.ErrUserNotFound
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/me", nil)
	c.Set("user_id", 99)
	h.Me(c)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

// ---------- Logout ----------

func TestLogout_CallsService(t *testing.T) {
	var calledWith uint
	svc := &mockUserService{
		logoutFn: func(ctx context.Context, userID uint) { calledWith = userID },
	}
	h := NewUserHandler(svc, config.Cfg)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/logout", nil)
	c.Set("user_id", 42)
	h.Logout(c)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	if calledWith != 42 {
		t.Errorf("Logout called with %d, want 42", calledWith)
	}
}

// ---------- RefreshToken ----------

func TestRefreshToken_Success(t *testing.T) {
	svc := &mockUserService{
		refreshFn: func(ctx context.Context, refreshToken string) (*dto.TokensResponse, error) {
			return &dto.TokensResponse{AccessToken: "new-access", RefreshToken: "new-refresh"}, nil
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	body, _ := json.Marshal(map[string]string{"refresh_token": "old-refresh"})
	w := doRequest(h.RefreshToken, http.MethodPost, "/refresh-token", body)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	data, _ := parseResp(t, w.Body.Bytes())
	if data["access_token"] != "new-access" {
		t.Errorf("access_token = %v, want new-access", data["access_token"])
	}
}

func TestRefreshToken_InvalidToken(t *testing.T) {
	svc := &mockUserService{
		refreshFn: func(ctx context.Context, refreshToken string) (*dto.TokensResponse, error) {
			return nil, usererrs.ErrInvalidToken
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	body, _ := json.Marshal(map[string]string{"refresh_token": "bad"})
	w := doRequest(h.RefreshToken, http.MethodPost, "/refresh-token", body)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestRefreshToken_MissingField(t *testing.T) {
	svc := &mockUserService{
		refreshFn: func(ctx context.Context, refreshToken string) (*dto.TokensResponse, error) {
			t.Errorf("refreshFn should not be called when no token present")
			return &dto.TokensResponse{}, nil
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	// 缺少 refresh_token 字段且 cookie 中也没有 → 401（与 Python 行为一致）
	body, _ := json.Marshal(map[string]string{})
	w := doRequest(h.RefreshToken, http.MethodPost, "/refresh-token", body)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestRefreshToken_FromCookie(t *testing.T) {
	svc := &mockUserService{
		refreshFn: func(ctx context.Context, refreshToken string) (*dto.TokensResponse, error) {
			if refreshToken != "cookie-refresh" {
				t.Errorf("refreshToken = %q, want cookie-refresh", refreshToken)
			}
			return &dto.TokensResponse{AccessToken: "new-access", RefreshToken: "new-refresh"}, nil
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	req, _ := http.NewRequest(http.MethodPost, "/refresh-token", nil)
	req.AddCookie(&http.Cookie{Name: "refresh_token", Value: "cookie-refresh"})
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	h.RefreshToken(c)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	data, _ := parseResp(t, w.Body.Bytes())
	if data["access_token"] != "new-access" {
		t.Errorf("access_token = %v, want new-access", data["access_token"])
	}
}

// ---------- 辅助 ----------

func gormModel(id uint) gorm.Model {
	return gorm.Model{ID: id}
}

// ---------- 模板：日志 trace_id 断言 ----------
//
// TestLogin_LogPropagatesTraceID 演示如何在 handler 测试里捕获 slog 输
// 出并断言 trace_id 已注入。其它 handler 想加同类测试时复制本用例即可。
//
// 关键三步：
//  1. 用 logger.NewTestHandler 把全局 slog default 替换成 buffer +
//     trace_id 提取的 handler（与生产 routerHandler 等价，但不写文件）。
//  2. 用真 router + Trace() 中间件（不是 doRequest helper）跑请求，
//     让 X-Trace-Id 头经过 Trace() 写进 ctx。
//  3. 解析 buffer 末行 JSON，断言 trace_id == 期望值。
func TestLogin_LogPropagatesTraceID(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(logger.NewTestHandler(&buf, slog.LevelDebug))
	t.Cleanup(func() { slog.SetDefault(prev) })

	svc := &mockUserService{
		authenticateFn: func(_ context.Context, _, _ string) (*model.User, error) {
			return nil, usererrs.ErrInvalidCredentials
		},
	}
	h := NewUserHandler(svc, config.Cfg)

	r := gin.New()
	r.Use(middleware.Trace())
	r.POST("/login", h.Login)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/login",
		bytes.NewReader(jsonBody(t, dto.LoginRequest{Username: "alice", Password: "wrong"})))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Trace-Id", "abc-trace")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}

	lines := bytes.Split(bytes.TrimSpace(buf.Bytes()), []byte("\n"))
	if len(lines) == 0 || len(bytes.TrimSpace(lines[len(lines)-1])) == 0 {
		t.Fatalf("no log record captured; buf = %q", buf.String())
	}
	rec := map[string]any{}
	if err := json.Unmarshal(bytes.TrimSpace(lines[len(lines)-1]), &rec); err != nil {
		t.Fatalf("unmarshal last record: %v\nraw: %s", err, buf.String())
	}
	if rec["trace_id"] != "abc-trace" {
		t.Errorf("trace_id = %v, want abc-trace; record: %v", rec["trace_id"], rec)
	}
	if rec["level"] != "WARN" {
		t.Errorf("level = %v, want WARN", rec["level"])
	}
	if rec["reason"] != "invalid_credentials" {
		t.Errorf("reason = %v, want invalid_credentials", rec["reason"])
	}
}
