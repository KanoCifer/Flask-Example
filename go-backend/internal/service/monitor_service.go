package service

import (
	"context"
	"math"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/model"
	"github.com/KanoCifer/kuroome-blog/internal/repository/postgres"
)

// Monitorer 定义 monitor handler 依赖的能力集合。
// 由 service.Monitorer 实现；handler 仅依赖此接口，便于测试替换。
type Monitorer interface {
	GetOverview(ctx context.Context, days int) (dto.OverviewResponse, error)
	GetVisitors(ctx context.Context, days, page, pageSize int) (dto.VisitorListResponse, error)
	GetUserLogins(ctx context.Context, days, page, pageSize int) (dto.UserLoginsResponse, error)
	GetServerStatus() (dto.ServerStatusResponse, error)
	StreamServerStatus(ctx context.Context) (<-chan dto.ServerStatusResponse, error)
	TrackVisitor(ctx context.Context, data dto.VisitorTrackRequest) error
	GetStatusDetail(ctx context.Context) (dto.StatusDetailResponse, error)
}

// MonitorService 实现 monitor 端点的业务逻辑（overview / visitors / user-logins
// / status-detail）。
type MonitorService struct {
	visitor   *postgres.VisitorRepo
	user      *postgres.UserRepo
	version   string
	startTime time.Time
}

func NewMonitorService(visitor *postgres.VisitorRepo, user *postgres.UserRepo, version string) *MonitorService {
	return &MonitorService{visitor: visitor, user: user, version: version, startTime: time.Now()}
}

// TrackVisitor 记录访客追踪数据（公开接口）。visit_time 由 PG default current_timestamp 填充。
func (s *MonitorService) TrackVisitor(ctx context.Context, data dto.VisitorTrackRequest) error {
	track := &model.VisitorTrack{
		VisitorID:        data.VisitorID,
		PageURL:          data.PageURL,
		PagePath:         data.PagePath,
		Referrer:         ptrIf(data.Referrer),
		Browser:          ptrIf(data.Browser),
		ScreenResolution: ptrIf(data.ScreenResolution),
		Language:         ptrIf(data.Language),
		IPAddress:        data.IpAddress,
		BrowserName:      ptrIf(data.BrowserName),
		BrowserVersion:   ptrIf(data.BrowserVersion),
		OSName:           ptrIf(data.OSName),
		OSVersion:        ptrIf(data.OSVersion),
		CPU:              ptrIf(data.Cpu),
		DeviceType:       ptrIf(data.DeviceType),
	}
	return s.visitor.Insert(ctx, track)
}

// GetStatusDetail 返回服务器运行时状态概览，对齐 Python
// PublicService.get_status_detail 的 {version, service, system} 三元组。
func (s *MonitorService) GetStatusDetail(ctx context.Context) (dto.StatusDetailResponse, error) {
	// --- system info --------------------------------------------------- //
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	cpuCountL, _ := cpu.Counts(true)
	cpuCountP, _ := cpu.Counts(false)

	cpuPercent := 0.0
	if p, err := cpu.Percent(0, false); err == nil && len(p) > 0 {
		cpuPercent = math.Round(p[0])
	}

	loadAvg := &load.AvgStat{}
	if la, err := load.Avg(); err == nil {
		loadAvg = la
	}

	// 2. 获取CPU信息
	cpuInfo, _ := cpu.Info()

	vm, _ := mem.VirtualMemory()

	sysInfo := dto.SystemInfoResponse{
		SystemTime:       time.Now().Format("2006/01/02 15:04:05"),
		SystemTimezone:   "GMT+8",
		OsName:           runtime.GOOS,
		OsVersion:        runtime.GOARCH,
		KernelVersion:    runtime.GOARCH,
		CpuModel:         cpuInfo[0].ModelName,
		CpuCountPhysical: cpuCountP,
		CpuCountLogical:  cpuCountL,
		LoadAverage: map[string]float64{
			"1m":  math.Round(loadAvg.Load1*100) / 100,
			"5m":  math.Round(loadAvg.Load5*100) / 100,
			"15m": math.Round(loadAvg.Load15*100) / 100,
		},
		CpuPercent:         cpuPercent,
		MemoryUsagePercent: round2(vm.UsedPercent),
		MemoryUsedBytes:    vm.Used,
		MemoryTotalBytes:   vm.Total,
	}

	// --- service info -------------------------------------------------- //
	dbOk := true
	if err := s.visitor.Ping(ctx); err != nil {
		dbOk = false
	}

	svcInfo := dto.ServiceInfoResponse{
		Runtime:          runtime.Version() + " " + runtime.GOOS + "/" + runtime.GOARCH,
		GoVersion:        runtime.Version(),
		Goroutines:       runtime.NumGoroutine(),
		GcCount:          m.NumGC,
		StartTime:        s.startTime.Unix(),
		HeapMemoryBytes:  m.Alloc,
		TotalMemoryBytes: m.TotalAlloc,
		DbOk:             dbOk,
		ApiOk:            true,
	}

	// --- version info -------------------------------------------------- //
	verInfo := dto.VersionInfoResponse{
		RepoURL:        "https://github.com/KanoCifer/kuroome-blog",
		CurrentVersion: s.version,
	}

	return dto.StatusDetailResponse{
		Version: verInfo,
		Service: svcInfo,
		System:  sysInfo,
	}, nil
}

// GetOverview 返回 days 天内的访客总览统计，对齐 Python MonitorService.get_overview。
func (s *MonitorService) GetOverview(ctx context.Context, days int) (dto.OverviewResponse, error) {
	endTime := time.Now().UTC()
	startTime := endTime.AddDate(0, 0, -days)

	totalVisits, err := s.visitor.CountVisitsSince(ctx, startTime)
	if err != nil {
		return dto.OverviewResponse{}, err
	}
	uniqueVisitors, err := s.visitor.CountUniqueVisitorsSince(ctx, startTime)
	if err != nil {
		return dto.OverviewResponse{}, err
	}
	uniqueVisitorIDs, err := s.visitor.CountUniqueVisitorIDsSince(ctx, startTime)
	if err != nil {
		return dto.OverviewResponse{}, err
	}
	topPages, err := s.visitor.GetTopPagesSince(ctx, startTime, 10)
	if err != nil {
		return dto.OverviewResponse{}, err
	}
	browserStats, err := s.visitor.GetBrowserStatsSince(ctx, startTime)
	if err != nil {
		return dto.OverviewResponse{}, err
	}
	osStats, err := s.visitor.GetOSSStatsSince(ctx, startTime)
	if err != nil {
		return dto.OverviewResponse{}, err
	}
	dailyTrend, err := s.visitor.GetDailyTrendSince(ctx, startTime)
	if err != nil {
		return dto.OverviewResponse{}, err
	}

	return dto.OverviewResponse{
		TotalVisits:      totalVisits,
		UniqueVisitors:   uniqueVisitors,
		UniqueVisitorIDs: uniqueVisitorIDs,
		TopPages:         topPages,
		BrowserStats:     browserStats,
		OSSStats:         osStats,
		DailyTrend:       dailyTrend,
		PeriodDays:       days,
	}, nil
}

// GetVisitors 返回 days 天内的访客分页列表，对齐 Python MonitorService.get_visitors。
func (s *MonitorService) GetVisitors(ctx context.Context, days, page, pageSize int) (dto.VisitorListResponse, error) {
	endTime := time.Now().UTC()
	startTime := endTime.AddDate(0, 0, -days)

	total, err := s.visitor.CountVisitsSince(ctx, startTime)
	if err != nil {
		return dto.VisitorListResponse{}, err
	}

	offset := (page - 1) * pageSize
	tracks, err := s.visitor.ListVisitorsSince(ctx, startTime, offset, pageSize)
	if err != nil {
		return dto.VisitorListResponse{}, err
	}

	list := make([]dto.VisitorItem, 0, len(tracks))
	for _, v := range tracks {
		list = append(list, dto.VisitorItem{
			ID:               v.ID,
			VisitorID:        v.VisitorID,
			PageURL:          v.PageURL,
			PagePath:         v.PagePath,
			Referrer:         v.Referrer,
			Browser:          v.Browser,
			ScreenResolution: v.ScreenResolution,
			Language:         v.Language,
			IPAddress:        v.IPAddress,
			VisitTime:        &v.VisitTime,
		})
	}

	pages := (total + pageSize - 1) / pageSize
	prev, next := (*int)(nil), (*int)(nil)
	if page > 1 {
		v := page - 1
		prev = &v
	}
	if page < pages {
		v := page + 1
		next = &v
	}

	return dto.VisitorListResponse{
		List: list,
		Pagination: dto.Pagination{
			Page:    page,
			PerPage: pageSize,
			Total:   total,
			Pages:   pages,
			HasPrev: page > 1,
			HasNext: page < pages,
			PrevNum: prev,
			NextNum: next,
		},
	}, nil
}

// GetUserLogins 返回 days 天内有登录记录的用户分页列表，对齐 Python MonitorService.get_user_logins。
func (s *MonitorService) GetUserLogins(ctx context.Context, days, page, pageSize int) (dto.UserLoginsResponse, error) {
	endTime := time.Now().UTC()
	startTime := endTime.AddDate(0, 0, -days)

	users, err := s.user.ListUsersWithLoginRecords(ctx)
	if err != nil {
		return dto.UserLoginsResponse{}, err
	}

	logins := make([]dto.UserLoginItem, 0, len(users))
	for _, u := range users {
		if !hasRecentLogin(u, startTime) {
			continue
		}
		logins = append(logins, dto.UserLoginItem{
			UserID:         int(u.ID),
			Username:       u.Username,
			Name:           u.Name,
			LoginCount:     u.LoginCount,
			LastLoginAt:    isoPtr(u.LastLoginAt),
			CurrentLoginAt: isoPtr(u.CurrentLoginAt),
			LastLoginIP:    u.LastLoginIP,
			CurrentLoginIP: u.CurrentLoginIP,
			Active:         u.Active,
		})
	}

	total := len(logins)
	offset := (page - 1) * pageSize
	end := offset + pageSize
	if end > total {
		end = total
	}
	if offset > total {
		offset = total
	}
	paginated := logins[offset:end]

	pages := 0
	if pageSize > 0 {
		pages = (total + pageSize - 1) / pageSize
	}
	prev, next := (*int)(nil), (*int)(nil)
	if page > 1 {
		v := page - 1
		prev = &v
	}
	if page < pages {
		v := page + 1
		next = &v
	}

	return dto.UserLoginsResponse{
		List: paginated,
		Pagination: dto.Pagination{
			Page:    page,
			PerPage: pageSize,
			Total:   total,
			Pages:   pages,
			HasPrev: page > 1,
			HasNext: page < pages,
			PrevNum: prev,
			NextNum: next,
		},
	}, nil
}

// hasRecentLogin 判断用户是否在时间窗内有登录记录（对齐 Python 同级逻辑）。
func hasRecentLogin(u model.User, start time.Time) bool {
	if u.CurrentLoginAt != nil && !u.CurrentLoginAt.Before(start) {
		return true
	}
	if u.LastLoginAt != nil && !u.LastLoginAt.Before(start) {
		return true
	}
	return false
}

// isoPtr 将 time.Time 转为 ISO 字符串指针，nil 则返回 nil（对齐 Python .isoformat() 语义）。
func isoPtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.UTC().Format(time.RFC3339)
	return &s
}

// GetServerStatus 返回当前服务器 CPU/内存/磁盘指标，对齐 Python
// _get_server_status_payload 的字段名、单位与舍入规则。
//
// cpu.Percent 用 1s 间隔（与 Python psutil.cpu_percent(interval=1) 一致），
// 会阻塞约 1s 换取更准的 CPU 利用率。
func (s *MonitorService) GetServerStatus() (dto.ServerStatusResponse, error) {
	cpuPercents, err := cpu.Percent(time.Second, false)
	if err != nil {
		return dto.ServerStatusResponse{}, err
	}
	var cpuPercent float64
	if len(cpuPercents) > 0 {
		cpuPercent = cpuPercents[0]
	}

	cpuCores, err := cpu.Counts(true)
	if err != nil {
		return dto.ServerStatusResponse{}, err
	}

	vm, err := mem.VirtualMemory()
	if err != nil {
		return dto.ServerStatusResponse{}, err
	}

	du, err := disk.Usage("/")
	if err != nil {
		return dto.ServerStatusResponse{}, err
	}

	return dto.ServerStatusResponse{
		CPUPercent: math.Round(cpuPercent),
		CPUCores:   cpuCores,
		MemTotal:   int(math.Round(float64(vm.Total) / 1024 / 1024)),
		MemUsed:    int(math.Round(float64(vm.Used) / 1024 / 1024)),
		MemUsage:   round2(vm.UsedPercent),
		DiskTotal:  round2(float64(du.Total) / 1024 / 1024 / 1024),
		DiskUsed:   round2(float64(du.Used) / 1024 / 1024 / 1024),
		DiskUsage:  round2(du.UsedPercent),
	}, nil
}

// StreamServerStatus 每 5s 推送一帧 server status，直到 ctx 取消。
// 对齐 Python stream_server_status：一个无限循环，每 5s yield 一次 payload。
func (s *MonitorService) StreamServerStatus(ctx context.Context) (<-chan dto.ServerStatusResponse, error) {
	ch := make(chan dto.ServerStatusResponse)
	go func() {
		defer close(ch)
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				status, err := s.GetServerStatus()
				if err != nil {
					continue
				}
				select {
				case ch <- status:
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return ch, nil
}

// round2 保留两位小数（对齐 Python round(x, 2) 语义）。
func round2(x float64) float64 {
	return math.Round(x*100) / 100
}
