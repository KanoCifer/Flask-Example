package service

import (
	"context"
	"errors"
	"testing"

	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"github.com/KanoCifer/kuroome-blog/internal/domain/user/errs"
	"github.com/KanoCifer/kuroome-blog/internal/model"
)

func TestCheckPassword_Correct(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("secret123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash error: %v", err)
	}
	svc := &userService{}
	u := &model.User{PasswordHash: string(hash)}
	if !svc.CheckPassword(u, "secret123") {
		t.Error("CheckPassword should return true for correct password")
	}
}

func TestCheckPassword_Wrong(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("secret123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash error: %v", err)
	}
	svc := &userService{}
	u := &model.User{PasswordHash: string(hash)}
	if svc.CheckPassword(u, "wrong") {
		t.Error("CheckPassword should return false for wrong password")
	}
}

func TestCheckPassword_EmptyHash(t *testing.T) {
	svc := &userService{}
	u := &model.User{PasswordHash: ""}
	if svc.CheckPassword(u, "anything") {
		t.Error("CheckPassword should return false when hash is empty")
	}
}

func TestBoolToInt_Helper(t *testing.T) {
	// 复用 service.boolToInt 目前在 admin_test.go 未覆盖，此处顺手测。
	// 注意 boolToInt 为包内小写，需在 package service 内测试。
	tests := []struct {
		in   bool
		want int
	}{
		{true, 1},
		{false, 0},
	}
	for _, tt := range tests {
		if got := boolToInt(tt.in); got != tt.want {
			t.Errorf("boolToInt(%v) = %d, want %d", tt.in, got, tt.want)
		}
	}
}

// ---------- IsAdmin ----------

func TestIsAdmin_InList(t *testing.T) {
	svc := &userService{adminUserIDs: []int{1, 42, 99}}
	u := &model.User{Model: gormModel(42)}
	if !svc.IsAdmin(u) {
		t.Error("IsAdmin should return true for user in adminUserIDs")
	}
}

func TestIsAdmin_NotInList(t *testing.T) {
	svc := &userService{adminUserIDs: []int{1, 42, 99}}
	u := &model.User{Model: gormModel(7)}
	if svc.IsAdmin(u) {
		t.Error("IsAdmin should return false for user not in adminUserIDs")
	}
}

func TestIsAdmin_EmptyList(t *testing.T) {
	svc := &userService{adminUserIDs: []int{}}
	u := &model.User{Model: gormModel(1)}
	if svc.IsAdmin(u) {
		t.Error("IsAdmin should return false when adminUserIDs is empty")
	}
}

// ---------- UserToDict ----------

func TestUserToDict_BasicFields(t *testing.T) {
	svc := &userService{adminUserIDs: []int{1}}
	email := "test@example.com"
	profile := &model.Profile{ID: 1, Email: &email}
	u := &model.User{
		Model:             gormModel(1),
		Username:          "alice",
		Name:              "Alice",
		LoginCount:        5,
		Active:            true,
		PasskeyCredential: &model.PasskeyCredential{},
	}

	d := svc.UserToDict(u, profile)

	if d["id"] != uint(1) {
		t.Errorf("id = %v, want 1", d["id"])
	}
	if d["username"] != "alice" {
		t.Errorf("username = %v, want alice", d["username"])
	}
	if d["is_admin"] != true {
		t.Errorf("is_admin = %v, want true", d["is_admin"])
	}
	if d["has_passkey"] != true {
		t.Errorf("has_passkey = %v, want true", d["has_passkey"])
	}
	if d["email"] != "test@example.com" {
		t.Errorf("email = %v, want test@example.com", d["email"])
	}
}

func TestUserToDict_GitHubBound(t *testing.T) {
	svc := &userService{adminUserIDs: []int{}}
	githubID := 12345
	u := &model.User{
		Model:    gormModel(2),
		Username: "bob",
		GithubID: &githubID,
	}

	d := svc.UserToDict(u, nil)

	if d["github_bound"] != true {
		t.Errorf("github_bound = %v, want true", d["github_bound"])
	}
	if d["github_id"] != 12345 {
		t.Errorf("github_id = %v, want 12345", d["github_id"])
	}
}

func TestUserToDict_NilProfileOmitsFields(t *testing.T) {
	svc := &userService{adminUserIDs: []int{}}
	u := &model.User{Model: gormModel(3), Username: "carol"}

	d := svc.UserToDict(u, nil)

	if _, ok := d["email"]; ok {
		t.Error("email should not be present when profile is nil")
	}
	if _, ok := d["photo"]; ok {
		t.Error("photo should not be present when profile is nil")
	}
}

func TestUserToDict_ProfileWithZeroID(t *testing.T) {
	// profile.ID == 0 视为"无有效 profile"，不输出 profile 字段
	svc := &userService{adminUserIDs: []int{}}
	email := "x@test.com"
	u := &model.User{Model: gormModel(4), Username: "dave"}
	p := &model.Profile{ID: 0, Email: &email}

	d := svc.UserToDict(u, p)

	if _, ok := d["email"]; ok {
		t.Error("email should not be present when profile.ID == 0")
	}
}

// ---------- GetByID ----------

// mockUserRepo 为 GetByID / Authenticate 测试提供最小 UserRepositoryer 实现。
type mockUserRepo struct {
	getByIDFn       func(ctx context.Context, id uint) (*model.User, error)
	getByUsernameFn func(ctx context.Context, username string) (*model.User, error)
	usernameExists  bool
	emailExists     bool
}

func (m *mockUserRepo) Create(ctx context.Context, user *model.User, profile *model.Profile) error {
	return nil
}

func (m *mockUserRepo) GetByID(ctx context.Context, id uint) (*model.User, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *mockUserRepo) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	if m.getByUsernameFn != nil {
		return m.getByUsernameFn(ctx, username)
	}
	return nil, nil
}

func (m *mockUserRepo) GetByEmail(ctx context.Context, email string) (*model.User, *model.Profile, error) {
	return nil, nil, nil
}

func (m *mockUserRepo) GetByGithubID(ctx context.Context, githubID int) (*model.User, error) {
	return nil, nil
}

func (m *mockUserRepo) SetGithubID(ctx context.Context, userID uint, githubID int) error {
	return nil
}

func (m *mockUserRepo) ClearGithubID(ctx context.Context, userID uint) error {
	return nil
}

func (m *mockUserRepo) UsernameExists(ctx context.Context, username string) bool {
	return m.usernameExists
}

func (m *mockUserRepo) EmailExists(ctx context.Context, email string) bool {
	return m.emailExists
}

func (m *mockUserRepo) ListUsersWithLoginRecords(ctx context.Context) ([]model.User, error) {
	return nil, nil
}

func (m *mockUserRepo) Update(ctx context.Context, user *model.User) error {
	return nil
}

func (m *mockUserRepo) UpdateProfile(ctx context.Context, profile *model.Profile) error {
	return nil
}

func (m *mockUserRepo) GetProfile(ctx context.Context, userID uint) (*model.Profile, error) {
	return nil, nil
}

func (m *mockUserRepo) CreateProfile(ctx context.Context, userID uint) (*model.Profile, error) {
	return &model.Profile{UserID: userID}, nil
}

func (m *mockUserRepo) Delete(ctx context.Context, user *model.User) error {
	return nil
}

func TestGetByID_NotFound(t *testing.T) {
	repo := &mockUserRepo{
		getByIDFn: func(ctx context.Context, id uint) (*model.User, error) { return nil, nil },
	}
	svc := NewUserService(repo, nil, nil)

	_, _, err := svc.GetByID(context.Background(), 999)
	if !errors.Is(err, usererrs.ErrUserNotFound) {
		t.Errorf("err = %v, want ErrUserNotFound", err)
	}
}

func TestGetByID_RepoError(t *testing.T) {
	repo := &mockUserRepo{
		getByIDFn: func(ctx context.Context, id uint) (*model.User, error) {
			return nil, errors.New("db error")
		},
	}
	svc := NewUserService(repo, nil, nil)

	_, _, err := svc.GetByID(context.Background(), 1)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestGetByID_Success(t *testing.T) {
	repo := &mockUserRepo{
		getByIDFn: func(ctx context.Context, id uint) (*model.User, error) {
			return &model.User{Model: gormModel(id), Username: "alice"}, nil
		},
	}
	svc := NewUserService(repo, nil, nil)

	u, p, err := svc.GetByID(context.Background(), uint(1))
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if u.Username != "alice" {
		t.Errorf("username = %q, want alice", u.Username)
	}
	if p != nil {
		t.Errorf("profile = %v, want nil (no preloaded profile)", p)
	}
}

// ---------- Authenticate ----------

func TestAuthenticate_UserNotFound(t *testing.T) {
	repo := &mockUserRepo{
		getByUsernameFn: func(ctx context.Context, username string) (*model.User, error) {
			return nil, nil
		},
	}
	svc := NewUserService(repo, nil, nil)

	_, err := svc.Authenticate(context.Background(), "ghost", "pass")
	if !errors.Is(err, usererrs.ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestAuthenticate_WrongPassword(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("correct"), bcrypt.DefaultCost)
	repo := &mockUserRepo{
		getByUsernameFn: func(ctx context.Context, username string) (*model.User, error) {
			return &model.User{Model: gormModel(1), PasswordHash: string(hash)}, nil
		},
	}
	svc := NewUserService(repo, nil, nil)

	_, err := svc.Authenticate(context.Background(), "alice", "wrong")
	if !errors.Is(err, usererrs.ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestAuthenticate_Success(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("secret"), bcrypt.DefaultCost)
	repo := &mockUserRepo{
		getByUsernameFn: func(ctx context.Context, username string) (*model.User, error) {
			return &model.User{Model: gormModel(1), Username: "alice", PasswordHash: string(hash)}, nil
		},
	}
	svc := NewUserService(repo, nil, nil)

	u, err := svc.Authenticate(context.Background(), "alice", "secret")
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if u.Username != "alice" {
		t.Errorf("username = %q, want alice", u.Username)
	}
}

// ---------- Logout ----------

func TestLogout_NilRedis(t *testing.T) {
	// redis 为 nil 时不应 panic
	svc := &userService{redis: nil}
	svc.Logout(context.Background(), 1) // should not panic
}

func TestLogout_WithRedis(t *testing.T) {
	// 用真实 redis 客户端验证 Logout 调用 Del（需要 redis 可用，这里仅验证不 panic）
	// 完整集成测试留到 e2e；此处验证 nil 安全与接口签名
	var r *redis.Client
	svc := &userService{redis: r}
	svc.Logout(context.Background(), 1)
}

// ---------- VerifyEmailCode ----------

func TestVerifyEmailCode_NilRedis(t *testing.T) {
	svc := &userService{redis: nil}
	if svc.verifyEmailCode(context.Background(), "a@b.com", "123456") {
		t.Error("verifyEmailCode should return false when redis is nil")
	}
}

func TestVerifyEmailCode_EmptyEmail(t *testing.T) {
	svc := &userService{redis: nil}
	if svc.verifyEmailCode(context.Background(), "", "123456") {
		t.Error("verifyEmailCode should return false when email is empty")
	}
}
