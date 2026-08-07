// ─── Auth ───────────────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
}
export interface RegisterRequest {
  name: string
  email: string
  password: string
  role?: 'admin' | 'operator'
}
export interface Token {
  token: string
  expires_at: string
}
export interface UserResponse {
  id: string
  name: string
  email: string
  role: 'admin' | 'operator'
  created_at: string
  updated_at: string
}
export interface LoginResponse {
  authorization: Token
  user: UserResponse
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface DashboardSummary {
  active_workers: number
  running_jobs: number
  failed_jobs: number
  successful_jobs: number
  queue: number
  worker_cpu: number
  last_execution: string | null
  next_execution: string | null
}

// ─── Configs ─────────────────────────────────────────────────────────────────
export interface ConfigParameter {
  id: number
  parameter_name: string
  parameter_value: unknown
}
export interface ScrapingConfig {
  id: string
  name: string
  description?: string
  method_code: string
  created_by?: string
  status: 'active' | 'inactive'
  schedule_enabled: boolean
  created_at: string
  parameters?: ConfigParameter[]
}
export interface CreateConfigRequest {
  name: string
  description?: string
  method_code: string
  status?: 'active' | 'inactive'
  schedule_enabled?: boolean
  parameters: { parameter_name: string; parameter_value: unknown }[]
}
export interface UpdateConfigRequest {
  name?: string
  description?: string
  method_code?: string
  status?: 'active' | 'inactive'
  schedule_enabled?: boolean
  parameters?: { parameter_name: string; parameter_value: unknown }[]
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export type JobStatus = 'pending' | 'running' | 'success' | 'failed'
export interface ScrapingLog {
  id: number
  job_id: string
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
  created_at: string
}
export interface ScrapingResult {
  id: number
  job_id: string
  result_json: unknown
  created_at: string
}
export interface ScrapingJob {
  id: string
  config_id: string
  status: JobStatus
  started_at?: string
  finished_at?: string
  worker_name?: string
  logs?: ScrapingLog[]
  results?: ScrapingResult[]
}
export interface PaginatedJobs {
  data: ScrapingJob[]
  total?: number
  page?: number
  limit?: number
}

// ─── Schedules ───────────────────────────────────────────────────────────────
export interface Schedule {
  id: number
  config_id: string
  cron_expression: string
  timezone: string
  enabled: boolean
  next_run?: string
}
export interface CreateScheduleRequest {
  config_id: string
  cron_expression: string
  timezone?: string
  enabled?: boolean
}
export interface UpdateScheduleRequest {
  cron_expression?: string
  timezone?: string
  enabled?: boolean
}

// ─── Secrets ─────────────────────────────────────────────────────────────────
export type SecretType = 'api_key' | 'bearer_token' | 'basic_auth' | 'cookie'
export interface Secret {
  id: string
  name: string
  description?: string
  secret_type: SecretType
  created_by: string
  created_at: string
  updated_at: string
}
export interface CreateSecretRequest {
  name: string
  description?: string
  secret_type: SecretType
  secret_value: string
}

// ─── Methods (Registry) ───────────────────────────────────────────────────────
export interface MethodParam {
  name: string
  type: string
  required: boolean
  description?: string
}
export interface Method {
  code: string
  name: string
  description?: string
  parameters: MethodParam[]
}

// ─── Generic API response ────────────────────────────────────────────────────
export interface ApiError {
  error: string
}
export interface ApiMessage {
  message: string
  status: number
}
