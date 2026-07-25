package dto

import "time"

// VisitorTrackRequest 追踪访客请求 —— 前端 /track 上报的访客数据。
type VisitorTrackRequest struct {
	VisitorID        string `json:"visitor_id" binding:"required"`
	PageURL          string `json:"page_url" binding:"required"`
	Referrer         string `json:"referrer"`
	PagePath         string `json:"page_path" binding:"required"`
	Browser          string `json:"browser"`
	ScreenResolution string `json:"screen_resolution"`
	Language         string `json:"language"`
	BrowserVersion   string `json:"browser_version"`
	BrowserName      string `json:"browser_name"`
	OSName           string `json:"os_name"`
	OSVersion        string `json:"os_version"`
	DeviceType       string `json:"device_type"`
	Cpu              string `json:"cpu"`
	IpAddress        string `json:"ip_address"`
	VisitTime        string `json:"visit_time"`
}

// VisitorItem 单条访客记录，字段名与 Python visit 字典对齐。
type VisitorItem struct {
	ID               uint       `json:"id"`
	VisitorID        string     `json:"visitor_id"`
	PageURL          string     `json:"page_url"`
	PagePath         string     `json:"page_path"`
	Referrer         *string    `json:"referrer"`
	Browser          *string    `json:"browser"`
	ScreenResolution *string    `json:"screen_resolution"`
	Language         *string    `json:"language"`
	IPAddress        string     `json:"ip_address"`
	VisitTime        *time.Time `json:"visit_time"`
}

// VisitorListResponse 分页访客列表。
type VisitorListResponse struct {
	List       []VisitorItem `json:"list"`
	Pagination Pagination    `json:"pagination"`
}
