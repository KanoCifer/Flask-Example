// Package service —— 上传业务逻辑。
//
// Uploader 负责把客户端上传的表单文件落盘：
//   - UploadFile：通用文件，保存到 uploads/{userID}/ 并返回相对路径。
//   - UploadBlogImage：博客图片，校验类型后保存到 posts/{userID}/ 并返回相对路径。
//   - UploadGalleryImage：图片墙图片，校验类型后保存到 gallery/{userID}/ 并返回相对路径。
//   - UploadAvatar：图片校验 + 原图保存 + 256px 缩略图 + 回写 profile.photo。
//
// 与 Python 端的差异：缩略图输出为 JPEG（Go 零依赖，x/image/draw 缩放）；
// Python 端输出为 WebP。HEIF/HEIC 因需 cgo libheif 暂不支持，会返回"不支持的类型"。
package service

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/domain/upload/errs"
	"github.com/KanoCifer/kuroome-blog/internal/domain/user/errs"
	"github.com/KanoCifer/kuroome-blog/internal/model"
	"github.com/KanoCifer/kuroome-blog/internal/util"
)

// thumbSize 缩略图目标边长（与 Python compress_avatar (256,256) 一致）。
const thumbSize = util.ThumbSize

// 允许的图片 Content-Type（对齐 Python ALLOWED_IMAGE_TYPES）。
var allowedImageTypes = []string{
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/exif",
}

// mimeToExt 把已校验的 Content-Type 映射为安全后缀。
// 用服务端派生后缀替代用户文件名中的 filepath.Ext(filename)，
// 防止伪造后缀（如 .php）绕过静态服务的内容处理。
var mimeToExt = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
	"image/exif": ".jpg",
}

// Uploader 定义 handler 依赖的上传能力集合。
type Uploader interface {
	// UploadFile 保存通用文件，返回相对存储根的路径（如 uploads/1/xxx.png）。
	UploadFile(ctx context.Context, userID uint, filename string, src io.Reader) (string, error)

	// UploadBlogImage 保存博客文章图片，校验类型后保存到 posts/{userID}/ 并返回相对路径。
	UploadBlogImage(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error)

	// UploadGalleryImage 保存图片墙图片，校验类型后保存到 gallery/{userID}/ 并返回相对路径。
	UploadGalleryImage(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error)

	// UploadAvatar 保存头像图片，回写 profile.photo 后返回相对路径。
	UploadAvatar(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error)
}

// profileStorage 是 UploadAvatar 需要的持久层能力。
// *postgres.UserRepo 通过 GetByID / GetProfile / CreateProfile / UpdateProfile 满足。
type profileStorage interface {
	GetByID(ctx context.Context, id uint) (*model.User, error)
	GetProfile(ctx context.Context, userID uint) (*model.Profile, error)
	CreateProfile(ctx context.Context, userID uint) (*model.Profile, error)
	UpdateProfile(ctx context.Context, profile *model.Profile) error
}

type uploadService struct {
	profiles profileStorage
	cfg      *config.UploadConfig
}

// NewUploadService 构造 *uploadService。
func NewUploadService(profiles profileStorage, cfg *config.Config) *uploadService {
	return &uploadService{profiles: profiles, cfg: &cfg.Upload}
}

// UploadFile 把通用文件保存到 {UploadDir}/uploads/{userID}/{uuid}{ext}。
// 不校验类型，仅限制大小（MaxUploadMB）。
func (s *uploadService) UploadFile(ctx context.Context, userID uint, filename string, src io.Reader) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	name := uuid.New().String() + ext
	rel := filepath.Join("uploads", fmt.Sprint(userID), name)

	full := filepath.Join(s.cfg.UploadDir, rel)
	if err := util.WriteFile(full, src, s.maxBytes()); err != nil {
		return "", err
	}
	return rel, nil
}

// UploadBlogImage 校验图片类型后保存到 {UploadDir}/posts/{userID}/{uuid}{ext}。
// 与 Python 端 save_upload_image 行为一致：校验 content-type + 大小限制，不缩略。
func (s *uploadService) UploadBlogImage(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error) {
	if !slices.Contains(allowedImageTypes, contentType) {
		return "", uploaderrs.ErrUnsupportedImageType
	}

	// 从已校验的 Content-Type 派生安全后缀，不信任用户文件名。
	ext := mimeToExt[contentType]
	name := uuid.New().String() + ext
	rel := filepath.Join("posts", fmt.Sprint(userID), name)

	full := filepath.Join(s.cfg.UploadDir, rel)
	if err := util.WriteFile(full, src, s.maxBytes()); err != nil {
		return "", err
	}
	return rel, nil
}

// UploadGalleryImage 校验图片类型后保存到 {UploadDir}/gallery/{userID}/{uuid}{ext}。
// 与 Python 端 save_upload_image 行为一致：校验 content-type + 大小限制，不缩略。
func (s *uploadService) UploadGalleryImage(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error) {
	if !slices.Contains(allowedImageTypes, contentType) {
		return "", uploaderrs.ErrUnsupportedImageType
	}

	// 从已校验的 Content-Type 派生安全后缀，不信任用户文件名。
	ext := mimeToExt[contentType]
	name := uuid.New().String() + ext
	rel := filepath.Join("gallery", fmt.Sprint(userID), name)

	full := filepath.Join(s.cfg.UploadDir, rel)
	if err := util.WriteFile(full, src, s.maxBytes()); err != nil {
		return "", err
	}
	return rel, nil
}

// UploadAvatar 校验图片 -> 保存原图 -> 生成 256px 缩略图 -> 回写 profile.photo。
// 返回缩略图相对路径（如 pics/1/xxx-256.jpg）。
func (s *uploadService) UploadAvatar(ctx context.Context, userID uint, filename, contentType string, src io.Reader) (string, error) {
	if !slices.Contains(allowedImageTypes, contentType) {
		return "", uploaderrs.ErrUnsupportedImageType
	}

	img, format, err := util.DecodeImage(src, s.maxBytes())
	if err != nil {
		return "", err
	}

	ext := "." + format
	origName := uuid.New().String() + ext
	thumbName := strings.TrimSuffix(origName, ext) + "-256.jpg"
	userDir := filepath.Join("pics", fmt.Sprint(userID))

	origFull := filepath.Join(s.cfg.UploadDir, userDir, origName)
	if err := util.EnsureDir(origFull); err != nil {
		return "", err
	}
	if err := util.EncodeImage(origFull, img, format); err != nil {
		return "", err
	}

	thumb := util.ResizeThumb(img)
	thumbFull := filepath.Join(s.cfg.UploadDir, userDir, thumbName)
	if err := util.EncodeImage(thumbFull, thumb, "jpeg"); err != nil {
		return "", err
	}

	// 回写 profile.photo = 缩略图相对路径（与 Python 行为一致）。
	photoRel := filepath.Join(userDir, thumbName)
	if err := s.updatePhoto(ctx, userID, filepath.ToSlash(photoRel)); err != nil {
		return "", err
	}
	return photoRel, nil
}

// updatePhoto 把 profile.photo 设为 photoRel，不存在则先建 profile。
func (s *uploadService) updatePhoto(ctx context.Context, userID uint, photoRel string) error {
	u, err := s.profiles.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if u == nil {
		return usererrs.ErrUserNotFound
	}

	p := u.Profile
	if p == nil {
		p, err = s.profiles.GetProfile(ctx, userID)
		if err != nil {
			return err
		}
	}
	if p == nil {
		p, err = s.profiles.CreateProfile(ctx, userID)
		if err != nil {
			return err
		}
	}
	p.Photo = photoRel
	return s.profiles.UpdateProfile(ctx, p)
}

func (s *uploadService) maxBytes() int64 {
	return int64(s.cfg.MaxUploadMB) * 1024 * 1024
}
