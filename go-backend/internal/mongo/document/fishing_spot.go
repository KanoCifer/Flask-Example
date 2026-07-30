package document

import "time"

// 钓点水体类型 —— 与前端 @readinglist/types:FishingSpotKind 字面量保持一致：
// 新增类型须同步更新 Go 的 IsValidKind / 前端枚举 / 一次性回填 migration。
const (
	KindLake      = "lake"
	KindRiver     = "river"
	KindReservoir = "reservoir"
)

// IsValidKind 判断字符串是否为合法的钓点 kind。
// 跟随文档 Kind 在 bson 中的实际存储形态（string）—— 未来若改成 enum，
// 这里要一起调整。
func IsValidKind(k string) bool {
	switch k {
	case KindLake, KindRiver, KindReservoir:
		return true
	default:
		return false
	}
}

type FishingSpot struct {
	ID          string    `bson:"_id,omitempty" json:"id"`
	Location    []float64 `bson:"location"`
	Name        string    `bson:"name"`
	Description string    `bson:"description"`
	Tags        []string  `bson:"tags"`

	// Kind 水体类型 —— 写入时由 dto.FishingSpotRequest 的 binding tag 强校验；
	// 读侧允许遗留行无值（老文档/未匹配启发式的），用 omitempty 避免响应里给前端
	// 序列化出空串而不是 null，前端 nullable 处理分支会按 null 走 muted 灰渲染。
	Kind      string     `bson:"kind,omitempty" json:"kind"`
	CreatedAt time.Time  `bson:"createdAt"`
	UpdatedAt time.Time  `bson:"updatedAt"`
	DeletedAt *time.Time `bson:"deletedAt"`

	// 1-5 Star rating
	Rating float64 `bson:"rating"`
	// 钓点图片
	Images []string `bson:"images"`
}
