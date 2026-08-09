package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSplitAndTrim(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want []string
	}{
		{"single", "a", []string{"a"}},
		{"multiple", "a,b,c", []string{"a", "b", "c"}},
		{"spaces", " a , b , c ", []string{"a", "b", "c"}},
		{"empty", "", []string{}},
		{"trailing comma", "a,b,", []string{"a", "b"}},
		{"only commas", ",,,", []string{}},
		{"mixed empty", "a,,b, ,c", []string{"a", "b", "c"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := splitAndTrim(tt.in)
			if len(got) != len(tt.want) {
				t.Fatalf("splitAndTrim(%q) = %v, want %v", tt.in, got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("splitAndTrim(%q)[%d] = %q, want %q", tt.in, i, got[i], tt.want[i])
				}
			}
		})
	}
}

// TestLoadAppliesConfigFile 回归测试：Load 必须把 config 文件里的值
// 实际 merge 进 Cfg，否则会出现"文件被静默忽略、只留默认值"的 bug
// （曾导致 DATABASE_URL 为空、DB 连到默认 unix socket）。
func TestLoadAppliesConfigFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	content := `
database:
  DATABASE_URL: "postgres://test:pass@localhost/testdb"
  MONGO_URI: "mongodb://mongo:27017/"
server:
  PORT: 9999
  LOG_LEVEL: "DEBUG"
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := cfg.Database.DatabaseURL, "postgres://test:pass@localhost/testdb"; got != want {
		t.Errorf("DatabaseURL = %q, want %q", got, want)
	}
	if got, want := cfg.Database.MongoURI, "mongodb://mongo:27017/"; got != want {
		t.Errorf("MongoURI = %q, want %q", got, want)
	}
	if got, want := cfg.Server.Port, 9999; got != want {
		t.Errorf("Port = %d, want %d", got, want)
	}
	if got, want := cfg.Server.LogLevel, "DEBUG"; got != want {
		t.Errorf("LogLevel = %q, want %q", got, want)
	}
	// 文件中未出现的字段应保留 defaultConfig() 的默认值。
	if got, want := cfg.Upload.MaxUploadMB, 10; got != want {
		t.Errorf("MaxUploadMB = %d, want default %d", got, want)
	}
}

func TestParseIntList(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want []int
	}{
		{"single", "1", []int{1}},
		{"multiple", "1,2,3", []int{1, 2, 3}},
		{"spaces", " 1 , 2 , 3 ", []int{1, 2, 3}},
		{"empty", "", []int{}},
		{"trailing comma", "1,2,", []int{1, 2}},
		{"invalid mixed", "1,abc,3", []int{1, 3}},
		{"only invalid", "abc,def", []int{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseIntList(tt.in)
			if len(got) != len(tt.want) {
				t.Fatalf("parseIntList(%q) = %v, want %v", tt.in, got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("parseIntList(%q)[%d] = %d, want %d", tt.in, i, got[i], tt.want[i])
				}
			}
		})
	}
}
