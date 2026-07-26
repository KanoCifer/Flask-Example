// Status 领域类型

export interface VersionInfo {
  repo_url: string;
  current_version: string;
}

export interface ServiceInfo {
  runtime: string;
  go_version: string;
  goroutines: number;
  gc_count: number;
  start_time: number;
  heap_memory_bytes: number;
  total_memory_bytes: number;
  db_ok: boolean;
  api_ok: boolean;
}

export interface SystemInfo {
  system_time: string;
  system_timezone: string;
  os_name: string;
  os_version: string;
  kernel_version: string;
  cpu_model: string;
  cpu_count_physical: number;
  cpu_count_logical: number;
  load_average: {
    '1m': number;
    '5m': number;
    '15m': number;
  };
  cpu_percent: number;
  memory_usage_percent: number;
  memory_used_bytes: number;
  memory_total_bytes: number;
}

export interface StatusDetailData {
  version: VersionInfo;
  service: ServiceInfo;
  system: SystemInfo;
}
