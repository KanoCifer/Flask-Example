package model

import (
	"database/sql/driver"
	"errors"
	"time"

	"gorm.io/datatypes"
)

type DeviceStatus string

const (
	DeviceActive  DeviceStatus = "active"
	DeviceRetired DeviceStatus = "retired"
)

func (ds DeviceStatus) Value() (driver.Value, error) {
	return string(ds), nil
}

func (ds *DeviceStatus) Scan(value any) error {
	s, ok := value.(string)
	if !ok {
		return errors.New("invalid device_status value")
	}
	*ds = DeviceStatus(s)
	return nil
}

type DeviceTrack struct {
	ID             uint   `gorm:"primaryKey;autoIncrement"`
	UserID         uint   `gorm:"index"`
	Name           string `gorm:"size:100"`
	PurchaseDate   time.Time
	Price          float64
	Currency       string    `gorm:"size:10;not null"`
	Notes          *string   `gorm:"type:text"`
	CreatedAt      time.Time `gorm:"index;default:current_timestamp"`
	UpdatedAt      time.Time
	Status         DeviceStatus    `gorm:"type:device_status_enum;not null"`
	ReminderConfig *datatypes.JSON `gorm:"type:jsonb"`
}

// TableName 对齐 Python SQLAlchemy 的 __tablename__ = "device_track"。
func (DeviceTrack) TableName() string {
	return "device_track"
}
