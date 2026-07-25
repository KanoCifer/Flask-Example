// Package util —— 跨层共享的纯函数工具集。
//
// 收纳不属于任何单一业务层、但被多个包复用的底层辅助函数
// （图片处理、cookie 等）。所有函数均为无副作用的纯函数，
// 不依赖全局状态。
package util

import (
	"bytes"
	"fmt"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"os"
	"path/filepath"

	"golang.org/x/image/draw"

	"github.com/KanoCifer/kuroome-blog/internal/domain/upload/errs"
)

// ThumbSize 缩略图目标边长（与 Python compress_avatar (256,256) 一致）。
const ThumbSize = 256

// DecodeImage 解码上传流为 image.Image，同时执行大小限制与格式校验。
// format 返回 "jpeg"/"png"/"gif"/"webp"，作为落盘扩展名与编码依据。
func DecodeImage(src io.Reader, maxBytes int64) (image.Image, string, error) {
	limited := io.LimitReader(src, maxBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, "", fmt.Errorf("读取上传文件失败: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return nil, "", uploaderrs.ErrImageTooLarge
	}

	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", uploaderrs.ErrInvalidImageData, err)
	}
	return img, format, nil
}

// ResizeThumb 按 ThumbSize 等比缩放（保持宽高比），与 Python PIL thumbnail 行为一致。
func ResizeThumb(img image.Image) image.Image {
	w, h := img.Bounds().Dx(), img.Bounds().Dy()
	if w <= ThumbSize && h <= ThumbSize {
		return img
	}
	// 计算等比目标尺寸。
	var tw, th int
	if w >= h {
		tw = ThumbSize
		th = h * ThumbSize / w
	} else {
		th = ThumbSize
		tw = w * ThumbSize / h
	}
	dst := image.NewRGBA(image.Rect(0, 0, tw, th))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)
	return dst
}

// EncodeImage 按 format 把 image 写入 path。
func EncodeImage(path string, img image.Image, format string) error {
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer f.Close()

	switch format {
	case "jpeg", "jpg":
		return jpeg.Encode(f, img, &jpeg.Options{Quality: 85})
	case "png":
		return png.Encode(f, img)
	case "gif":
		return gif.Encode(f, img, nil)
	default:
		// webp 编码在标准库/x/image 中暂不支持，回退为 PNG。
		return png.Encode(f, img)
	}
}

// EnsureDir 确保 path 的父目录存在。
func EnsureDir(path string) error {
	return os.MkdirAll(filepath.Dir(path), 0o755)
}

// WriteFile 把 src 写入 path（自动建父目录），带大小限制的拷贝。
func WriteFile(path string, src io.Reader, maxBytes int64) error {
	if err := EnsureDir(path); err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer f.Close()

	written, err := io.Copy(f, io.LimitReader(src, maxBytes+1))
	if err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}
	if written > maxBytes {
		return uploaderrs.ErrImageTooLarge
	}
	return nil
}
