package model

import (
	"database/sql/driver"
	"errors"
	"time"

	"gorm.io/datatypes"
)

type BillingCycle string

const (
	BillingMonthly   BillingCycle = "monthly"
	BillingQuarterly BillingCycle = "quarterly"
	BillingYearly    BillingCycle = "yearly"
)

func (bc BillingCycle) Value() (driver.Value, error) {
	return string(bc), nil
}

func (bc *BillingCycle) Scan(value any) error {
	s, ok := value.(string)
	if !ok {
		return errors.New("invalid billing_cycle value")
	}
	*bc = BillingCycle(s)
	return nil
}

type SubscriptionStatus string

const (
	SubActive   SubscriptionStatus = "active"
	SubCanceled SubscriptionStatus = "canceled"
	SubPaused   SubscriptionStatus = "paused"
	SubExpired  SubscriptionStatus = "expired"
)

func (ss SubscriptionStatus) Value() (driver.Value, error) {
	return string(ss), nil
}

func (ss *SubscriptionStatus) Scan(value any) error {
	s, ok := value.(string)
	if !ok {
		return errors.New("invalid subscription_status value")
	}
	*ss = SubscriptionStatus(s)
	return nil
}

type Subscription struct {
	ID              uint               `gorm:"primaryKey;autoIncrement"`
	Name            string             `gorm:"size:100;not null"`
	Provider        string             `gorm:"size:100;not null"`
	Price           float64            `gorm:"not null"`
	Currency        string             `gorm:"size:10;not null"`
	BillingCycle    BillingCycle       `gorm:"type:billing_cycle_enum;not null"`
	NextBillingDate time.Time          `gorm:"not null"`
	Status          SubscriptionStatus `gorm:"type:subscription_status_enum;not null"`
	ReminderConfig  *datatypes.JSON    `gorm:"type:jsonb"`
	Notes           *string            `gorm:"type:text"`
	CreatedAt       time.Time          `gorm:"index;default:current_timestamp"`
	UpdatedAt       time.Time
	UserID          uint `gorm:"index"`
}

// TableName 对齐 Python SQLAlchemy 的 __tablename__ = "subscription"。
func (Subscription) TableName() string {
	return "subscription"
}
