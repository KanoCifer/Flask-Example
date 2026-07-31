package model

import (
	"time"

	"gorm.io/datatypes"
)

type Log struct {
	ID        uint            `gorm:"primaryKey;index"`
	Timestamp time.Time       `gorm:"index;default:current_timestamp"`
	Level     string          `gorm:"size:50;index"`
	Message   string          `gorm:"type:text"`
	Extra     *datatypes.JSON `gorm:"type:jsonb"`
}

// TableName 对齐 Python SQLAlchemy 的 __tablename__ = "log"。
func (Log) TableName() string {
	return "log"
}
