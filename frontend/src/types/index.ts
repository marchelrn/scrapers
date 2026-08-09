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

// ─── Error Logs ──────────────────────────────────────────────────────────────
export type ErrorType = 'NETWORK' | 'PARSE' | 'TIMEOUT' | 'AUTH' | 'RATE_LIMIT' | 'VALIDATION'
export type SeverityType = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ErrorLog {
  id: string
  jobId: string
  configId: string
  configName?: string
  errorType: ErrorType
  severity: SeverityType
  message: string
  timestamp: string | Date
  isResolved: boolean
  stackTrace?: string
  details?: Record<string, unknown>
}

export interface ErrorLogQueryParams {
  limit?: number
  offset?: number
  errorType?: string
  severity?: SeverityType[] | string
  dateFrom?: string
  dateTo?: string
  isResolved?: boolean
  search?: string
}

export interface PaginatedErrorLogs {
  data: ErrorLog[]
  total: number
  limit: number
  offset: number
}

// ─── Alert Rules ─────────────────────────────────────────────────────────────
export type AlertTriggerType =
  | 'JOB_FAILED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'HIGH_ERROR_RATE'
  | 'NO_DATA_EXTRACTED'

export type AlertActionType = 'EMAIL' | 'SLACK' | 'WEBHOOK'

export interface AlertAction {
  type: AlertActionType
  target: string
}

export interface AlertRule {
  id: string
  name: string
  description?: string
  trigger: AlertTriggerType
  threshold?: number
  actions: AlertAction[]
  enabled: boolean
  createdAt: string | Date
  lastTriggeredAt?: string | Date
}

export interface CreateAlertRuleRequest {
  name: string
  description?: string
  trigger: AlertTriggerType
  threshold?: number
  actions: AlertAction[]
  enabled?: boolean
}

// ─── Data Preview & Validation ───────────────────────────────────────────────
export interface ValidationErrorItem {
  rowIndex: number
  field: string
  rule: string
  error: string
}

export interface PreviewResult {
  success: boolean
  totalExtracted: number
  validationPassed: number
  validationFailed: number
  data: Record<string, any>[]
  transformedData?: Record<string, any>[]
  rawHtml?: string
  validationErrors: ValidationErrorItem[]
  executionTimeMs: number
}

export type RuleType = 'REQUIRED' | 'TYPE' | 'PATTERN' | 'RANGE'

export interface ValidationRule {
  fieldName: string
  ruleType: RuleType
  value?: string | number
  errorMessage: string
}

// ─── Test Runner ─────────────────────────────────────────────────────────────
export type ParserMethodType = 'CSS Selector' | 'XPath' | 'Regex' | 'API'

export interface TestRun {
  id: string
  configId?: string
  testUrl: string
  parserMethod: ParserMethodType
  selectorString: string
  results: Record<string, any>[]
  executionTimeMs: number
  status: 'SUCCESS' | 'FAILED'
  errorMessage?: string
  rawHtml?: string
  createdAt: string | Date
}
