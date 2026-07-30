package document

import "testing"

// TestIsValidKind 表驱动：覆盖三个合法字面量 + 多种非法形态（空串、随机串、
// 拼写错误、错大小写），与前端 @readinglist/types:FishingSpotKind 强一致性。
func TestIsValidKind(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want bool
	}{
		{"lake canonical", "lake", true},
		{"river canonical", "river", true},
		{"reservoir canonical", "reservoir", true},

		{"empty string", "", false},
		{"unknown", "pond", false},
		{"typo", "reseervoir", false},
		{"uppercase", "LAKE", false},
		{"with prefix", "xlake", false},
		{"with suffix", "lake_", false},
		{"numeric", "1", false},
		{"unicode", "湖", false},
		{"whitespace", " lake", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := IsValidKind(tc.in)
			if got != tc.want {
				t.Errorf("IsValidKind(%q) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}
