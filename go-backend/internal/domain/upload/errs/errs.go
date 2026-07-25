// Package uploaderrs 定义上传/媒体域业务错误。ErrInvalidImageData/ErrImageTooLarge
// 也被 internal/util/image.go 引用（util 服务于 upload）。
package uploaderrs

import "errors"

var (
	ErrInvalidUploadType    = errors.New("未知的上传类型")
	ErrUnsupportedImageType = errors.New("不支持的图片类型")
	ErrImageTooLarge        = errors.New("图片过大")
	ErrInvalidImageData     = errors.New("无效的图片数据")
)
