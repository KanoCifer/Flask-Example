package weread

import "encoding/json"

// strField 从 map 中取字符串字段，缺失返回空串。
func strField(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

// intField 从 map 中取整数字段，缺失/类型不符返回 0。
func intField(m map[string]any, key string) int {
	switch v := m[key].(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case json.Number:
		n, _ := v.Int64()
		return int(n)
	default:
		return 0
	}
}

// optStrPtr 将空串转为 nil 指针，非空返回指针（用于 omitempty 字段）。
func optStrPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
