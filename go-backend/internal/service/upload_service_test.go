package service

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"io"
	"strings"
	"testing"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/domain/upload/errs"
	"github.com/KanoCifer/kuroome-blog/internal/model"
)

// 1x1 红色 PNG fixture。
func pngBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 8, 8))
	img.Set(0, 0, color.RGBA{255, 0, 0, 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}

func reader(b []byte) io.Reader { return bytes.NewReader(b) }

// ---------- mock profileStorage ----------

type mockProfileStorage struct {
	profile *model.Profile
	user    *model.User
}

func (m *mockProfileStorage) GetByID(ctx context.Context, id uint) (*model.User, error) {
	return m.user, nil
}

func (m *mockProfileStorage) GetProfile(ctx context.Context, userID uint) (*model.Profile, error) {
	return m.profile, nil
}

func (m *mockProfileStorage) CreateProfile(ctx context.Context, userID uint) (*model.Profile, error) {
	p := &model.Profile{UserID: userID}
	m.profile = p
	return p, nil
}

func (m *mockProfileStorage) UpdateProfile(ctx context.Context, profile *model.Profile) error {
	m.profile = profile
	return nil
}

func newUploadSvc(t *testing.T, st *mockProfileStorage) *uploadService {
	t.Helper()
	return NewUploadService(st, &config.Config{Upload: config.UploadConfig{
		UploadDir:   t.TempDir(),
		MaxUploadMB: 10,
	}})
}

// ---------- UploadFile ----------

func TestUploadFile_Success(t *testing.T) {
	st := &mockProfileStorage{}
	svc := newUploadSvc(t, st)

	rel, err := svc.UploadFile(context.Background(), 1, "doc.png", reader(pngBytes(t)))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(rel, "uploads/1/") {
		t.Fatalf("expected uploads/1/ prefix, got %s", rel)
	}
	if !strings.HasSuffix(rel, ".png") {
		t.Fatalf("expected .png suffix, got %s", rel)
	}
}

// ---------- UploadAvatar ----------

func TestUploadAvatar_UnsupportedType(t *testing.T) {
	st := &mockProfileStorage{user: &model.User{}}
	svc := newUploadSvc(t, st)

	_, err := svc.UploadAvatar(context.Background(), 1, "a.txt", "text/plain", reader([]byte("hi")))
	if !errEqual(err, uploaderrs.ErrUnsupportedImageType) {
		t.Fatalf("expected ErrUnsupportedImageType, got %v", err)
	}
}

func TestUploadAvatar_InvalidImageData(t *testing.T) {
	st := &mockProfileStorage{user: &model.User{}}
	svc := newUploadSvc(t, st)

	_, err := svc.UploadAvatar(context.Background(), 1, "a.png", "image/png", reader([]byte("not an image")))
	if !errEqual(err, uploaderrs.ErrInvalidImageData) {
		t.Fatalf("expected ErrInvalidImageData, got %v", err)
	}
}

func TestUploadAvatar_TooLarge(t *testing.T) {
	st := &mockProfileStorage{user: &model.User{}}
	svc := newUploadSvc(t, st)
	// 构造略大于 10MB 的数据（Content-Type 合法、数据超限，在 util.DecodeImage 被截断检测）。
	big := make([]byte, svc.maxBytes()+1)
	_, err := svc.UploadAvatar(context.Background(), 1, "a.png", "image/png", reader(big))
	if !errEqual(err, uploaderrs.ErrImageTooLarge) {
		t.Fatalf("expected ErrImageTooLarge, got %v", err)
	}
}

func TestUploadAvatar_Success_CreatesProfileWhenMissing(t *testing.T) {
	st := &mockProfileStorage{user: &model.User{}} // user 存在但 profile 为 nil
	svc := newUploadSvc(t, st)

	rel, err := svc.UploadAvatar(context.Background(), 1, "a.png", "image/png", reader(pngBytes(t)))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(rel, "pics/1/") || !strings.HasSuffix(rel, "-256.jpg") {
		t.Fatalf("expected pics/1/*-256.jpg, got %s", rel)
	}
	// 回写的 profile.photo 应为缩略图相对路径。
	if st.profile == nil || st.profile.Photo != rel {
		t.Fatalf("profile.photo not updated, got %+v", st.profile)
	}
}

func TestUploadAvatar_Success_ExistingProfile(t *testing.T) {
	existing := &model.Profile{UserID: 1, Photo: "old.png"}
	st := &mockProfileStorage{user: &model.User{}, profile: existing}
	svc := newUploadSvc(t, st)

	rel, err := svc.UploadAvatar(context.Background(), 1, "a.png", "image/png", reader(pngBytes(t)))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if existing.Photo != rel {
		t.Fatalf("expected updated photo %s, got %s", rel, existing.Photo)
	}
}

// errEqual 判断 err 底层是否等于 target（兼容 Is 与 errors.Is 两种语义）。
func errEqual(err, target error) bool {
	return err == target || isErr(err, target)
}

func isErr(err, target error) bool {
	for err != nil {
		if err == target {
			return true
		}
		type unwrapper interface{ Unwrap() error }
		if u, ok := err.(unwrapper); ok {
			err = u.Unwrap()
		} else {
			return false
		}
	}
	return false
}

// 提示 import 使用。
var _ = io.Discard
