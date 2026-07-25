package handler

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/domain/upload/errs"
	"github.com/KanoCifer/kuroome-blog/internal/model"
	"github.com/KanoCifer/kuroome-blog/internal/service"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// 1x1 红色 PNG，作为合法图片 fixture。
func mustPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{255, 0, 0, 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}

// ---------- mocks ----------

type mockUpload struct {
	fileFn    func(ctx context.Context, userID uint, filename string, src io.Reader) (string, error)
	blogFn    func(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error)
	galleryFn func(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error)
	avatarFn  func(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error)
}

func (m *mockUpload) UploadFile(ctx context.Context, userID uint, filename string, src io.Reader) (string, error) {
	return m.fileFn(ctx, userID, filename, src)
}

func (m *mockUpload) UploadBlogImage(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error) {
	return m.blogFn(ctx, userID, filename, contentType, src)
}

func (m *mockUpload) UploadGalleryImage(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error) {
	return m.galleryFn(ctx, userID, filename, contentType, src)
}

func (m *mockUpload) UploadAvatar(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error) {
	return m.avatarFn(ctx, userID, filename, contentType, src)
}

type mockAvatarView struct {
	photo string
}

func (m *mockAvatarView) GetByID(ctx context.Context, userID uint) (*model.User, *model.Profile, error) {
	return &model.User{}, &model.Profile{Photo: m.photo}, nil
}

func (m *mockAvatarView) UserToDict(u *model.User, p *model.Profile) map[string]any {
	return map[string]any{"photo": m.photo}
}

// ---------- helpers ----------

func setupUpload(t *testing.T, up service.Uploader, view avatarViewer) *gin.Engine {
	t.Helper()
	h := NewUploadHandler(up, view)
	r := gin.New()
	g := r.Group("/v3")
	noopAuth := func(c *gin.Context) { c.Set("user_id", 1); c.Next() }
	h.RegisterRoutes(g, noopAuth)
	return r
}

// buildMultipart 构造 multipart/form-data 请求体，携带单个文件字段和可选的额外表单字段。
func buildMultipart(t *testing.T, field, filename, contentType string, body []byte, extra ...map[string]string) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	boundary := "BOUNDARY"

	// 额外表单字段（如 type），放在文件字段之前。
	if len(extra) > 0 {
		for k, v := range extra[0] {
			buf.WriteString("--" + boundary + "\r\n")
			buf.WriteString("Content-Disposition: form-data; name=\"" + k + "\"\r\n\r\n")
			buf.WriteString(v + "\r\n")
		}
	}

	buf.WriteString("--" + boundary + "\r\n")
	buf.WriteString("Content-Disposition: form-data; name=\"" + field + "\"; filename=\"" + filename + "\"\r\n")
	buf.WriteString("Content-Type: " + contentType + "\r\n\r\n")
	buf.Write(body)
	buf.WriteString("\r\n--" + boundary + "--\r\n")
	return &buf, "multipart/form-data; boundary=" + boundary
}

func requestUpload(t *testing.T, r *gin.Engine, path, field, filename, contentType string, body []byte, extra ...map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	buf, ct := buildMultipart(t, field, filename, contentType, body, extra...)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, path, buf)
	req.Header.Set("Content-Type", ct)
	r.ServeHTTP(w, req)
	return w
}

// ---------- Upload ----------

func TestUpload_Success(t *testing.T) {
	up := &mockUpload{
		fileFn: func(ctx context.Context, userID uint, filename string, src io.Reader) (string, error) {
			return "uploads/1/abc.png", nil
		},
	}
	r := setupUpload(t, up, nil)

	w := requestUpload(t, r, "/v3/upload", "file", "test.png", "image/png", mustPNG(t))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"url":"/v3/media/uploads/1/abc.png"`) {
		t.Fatalf("unexpected url in body: %s", w.Body.String())
	}
}

func TestUpload_NoFile(t *testing.T) {
	up := &mockUpload{fileFn: func(ctx context.Context, userID uint, filename string, src io.Reader) (string, error) {
		return "", nil
	}}
	r := setupUpload(t, up, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v3/upload", nil)
	req.Header.Set("Content-Type", "multipart/form-data; boundary=BOUNDARY")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing file, got %d", w.Code)
	}
}

func TestUpload_SvcError(t *testing.T) {
	up := &mockUpload{
		fileFn: func(ctx context.Context, userID uint, filename string, src io.Reader) (string, error) {
			return "", errors.New("disk full")
		},
	}
	r := setupUpload(t, up, nil)
	w := requestUpload(t, r, "/v3/upload", "file", "a.png", "image/png", mustPNG(t))
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// type=blog 分发到 UploadBlogImage，校验类型失败应返回 400。
func TestUpload_BlogType(t *testing.T) {
	up := &mockUpload{
		blogFn: func(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error) {
			return "", uploaderrs.ErrUnsupportedImageType
		},
	}
	r := setupUpload(t, up, nil)
	w := requestUpload(t, r, "/v3/upload", "file", "a.bmp", "image/bmp", mustPNG(t), map[string]string{"type": "blog"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unsupported blog image type, got %d: %s", w.Code, w.Body.String())
	}
}

// type=gallery 分发到 UploadGalleryImage，成功应返回 URL。
func TestUpload_GalleryType(t *testing.T) {
	up := &mockUpload{
		galleryFn: func(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error) {
			return "gallery/1/xyz.png", nil
		},
	}
	r := setupUpload(t, up, nil)
	w := requestUpload(t, r, "/v3/upload", "file", "g.png", "image/png", mustPNG(t), map[string]string{"type": "gallery"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"url":"/v3/media/gallery/1/xyz.png"`) {
		t.Fatalf("unexpected url in body: %s", w.Body.String())
	}
}

// type 为空（或未知）走 generic UploadFile 路径，不限类型。
func TestUpload_GenericFallback(t *testing.T) {
	up := &mockUpload{
		fileFn: func(ctx context.Context, userID uint, filename string, src io.Reader) (string, error) {
			return "uploads/1/data.bin", nil
		},
	}
	r := setupUpload(t, up, nil)

	// 无 type 字段 → generic
	w := requestUpload(t, r, "/v3/upload", "file", "data.bin", "application/octet-stream", []byte("binary"))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for generic upload, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"url":"/v3/media/uploads/1/data.bin"`) {
		t.Fatalf("unexpected url in body: %s", w.Body.String())
	}
}

// ---------- UploadPic ----------

func TestUploadPic_Success(t *testing.T) {
	up := &mockUpload{
		avatarFn: func(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error) {
			return "pics/1/abc-256.jpg", nil
		},
	}
	r := setupUpload(t, up, &mockAvatarView{photo: "pics/1/abc-256.jpg"})

	w := requestUpload(t, r, "/v3/upload-pic", "image", "avatar.png", "image/png", mustPNG(t))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"photo":"pics/1/abc-256.jpg"`) {
		t.Fatalf("expected photo in user dict, got: %s", w.Body.String())
	}
}

func TestUploadPic_SvcBadRequest(t *testing.T) {
	up := &mockUpload{
		avatarFn: func(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error) {
			return "", uploaderrs.ErrImageTooLarge
		},
	}
	r := setupUpload(t, up, nil)
	w := requestUpload(t, r, "/v3/upload-pic", "image", "big.png", "image/png", mustPNG(t))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for image-too-large, got %d", w.Code)
	}
}
