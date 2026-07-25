package dto

// OverviewResponse 对齐 Python monitor_service.get_overview 的返回结构。
type OverviewResponse struct {
	TotalVisits      int              `json:"total_visits"`
	UniqueVisitors   int              `json:"unique_visitors"`
	UniqueVisitorIDs int              `json:"unique_visitor_ids"`
	TopPages         []map[string]any `json:"top_pages"`
	BrowserStats     []map[string]any `json:"browser_stats"`
	OSSStats         []map[string]any `json:"os_stats"`
	DailyTrend       []map[string]any `json:"daily_trend"`
	PeriodDays       int              `json:"period_days"`
}

// UserLoginItem 单条用户登录记录，字段名与 Python login_logs 对齐。
type UserLoginItem struct {
	UserID         int     `json:"user_id"`
	Username       string  `json:"username"`
	Name           string  `json:"name"`
	LoginCount     int     `json:"login_count"`
	LastLoginAt    *string `json:"last_login_at"`
	CurrentLoginAt *string `json:"current_login_at"`
	LastLoginIP    *string `json:"last_login_ip"`
	CurrentLoginIP *string `json:"current_login_ip"`
	Active         bool    `json:"active"`
}

// UserLoginsResponse 分页用户登录记录。
type UserLoginsResponse struct {
	List       []UserLoginItem `json:"list"`
	Pagination Pagination      `json:"pagination"`
}

// ServerStatusResponse 对齐 Python _get_server_status_payload 字段名。
type ServerStatusResponse struct {
	CPUPercent float64 `json:"cpu_percent"`
	CPUCores   int     `json:"cpu_cores"`
	MemTotal   int     `json:"mem_total"`
	MemUsed    int     `json:"mem_used"`
	MemUsage   float64 `json:"mem_usage"`
	DiskTotal  float64 `json:"disk_total"`
	DiskUsed   float64 `json:"disk_used"`
	DiskUsage  float64 `json:"disk_usage"`
}

type StatusDetailResponse struct {
	Version VersionInfoResponse `json:"version"`
	Service ServiceInfoResponse `json:"service"`
	System  SystemInfoResponse  `json:"system"`
}

type VersionInfoResponse struct {
	RepoURL        string `json:"repo_url"`
	CurrentVersion string `json:"current_version"`
}

type ServiceInfoResponse struct {
	Runtime          string `json:"runtime"`
	GoVersion        string `json:"go_version"`
	Goroutines       int    `json:"goroutines"`
	GcCount          uint32 `json:"gc_count"`
	StartTime        int64  `json:"start_time"`
	HeapMemoryBytes  uint64 `json:"heap_memory_bytes"`
	TotalMemoryBytes uint64 `json:"total_memory_bytes"`
	DbOk             bool   `json:"db_ok"`
	ApiOk            bool   `json:"api_ok"`
}

type SystemInfoResponse struct {
	SystemTime         string             `json:"system_time"`
	SystemTimezone     string             `json:"system_timezone"`
	OsName             string             `json:"os_name"`
	OsVersion          string             `json:"os_version"`
	KernelVersion      string             `json:"kernel_version"`
	CpuModel           string             `json:"cpu_model"`
	CpuCountPhysical   int                `json:"cpu_count_physical"`
	CpuCountLogical    int                `json:"cpu_count_logical"`
	LoadAverage        map[string]float64 `json:"load_average"`
	CpuPercent         float64            `json:"cpu_percent"`
	MemoryUsagePercent float64            `json:"memory_usage_percent"`
	MemoryUsedBytes    uint64             `json:"memory_used_bytes"`
	MemoryTotalBytes   uint64             `json:"memory_total_bytes"`
}
