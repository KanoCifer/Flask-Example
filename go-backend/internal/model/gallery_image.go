package model

import (
	"time"

	"gorm.io/datatypes"
)

// GalleryImage 画廊图片，字段对齐 Python backend/app/models/models.py GalleryImage。
type GalleryImage struct {
	ID           uint            `gorm:"primaryKey;autoIncrement"`
	URL          string          `gorm:"size:500;not null"`
	ThumbnailURL *string         `gorm:"size:500"` // 缩略图相对路径
	MediumURL    *string         `gorm:"size:500"` // 中等尺寸相对路径
	Width        int             `gorm:"default:0"`
	Height       int             `gorm:"default:0"`
	AspectRatio  float64         `gorm:"default:0"`
	FileSize     int             `gorm:"default:0"`
	MimeType     string          `gorm:"size:50;default:image/jpeg"`
	Description  string          `gorm:"size:500;default:\"\""`
	SortOrder    int             `gorm:"index;default:0"`
	Status       string          `gorm:"size:20;default:uploaded;index"` // uploaded/processing/ready/failed
	Exif         *datatypes.JSON `gorm:"type:jsonb"`                     // 对齐 Python JSONB
	UploadedAt   time.Time       `gorm:"default:current_timestamp"`
	CreatedAt    time.Time       `gorm:"index;default:current_timestamp"`
	UpdatedAt    time.Time
	UserID       *uint `gorm:"index"`
}

func (GalleryImage) TableName() string {
	return "gallery_image"
}
