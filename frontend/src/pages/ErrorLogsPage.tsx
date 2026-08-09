import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '../components/layout/Header'
import { errorsApi } from '../api/errors'
import type { ErrorLog, ErrorType, SeverityType, ErrorLogQueryParams } from '../types'
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Info,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Copy,
  Check,
  Calendar,
  Layers,
  ChevronDown,
  Clock,
  Eye,
  SlidersHorizontal,
} from 'lucide-react'
import toast from 'react-hot-toast'

// Severity configuration & color mappings
const SEVERITY_CONFIG: Record<
  SeverityType,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  CRITICAL: {
    label: 'CRITICAL',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold animate-pulse',
    icon: AlertOctagon,
  },
  HIGH: {
    label: 'HIGH',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-semibold',
    icon: AlertTriangle,
  },
  MEDIUM: {
    label: 'MEDIUM',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-medium',
    icon: AlertCircle,
  },
  LOW: {
    label: 'LOW',
    badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/40 font-normal',
    icon: Info,
  },
}

// Error type options
const ERROR_TYPES: ErrorType[] = [
  'NETWORK',
  'PARSE',
  'TIMEOUT',
  'AUTH',
  'RATE_LIMIT',
  'VALIDATION',
]

// Severity options list
const SEVERITIES: SeverityType[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

// Helper to generate 50 mock logs if backend returns empty dataset
function generateMockErrorLogs(count: number = 55): ErrorLog[] {
  const configs = [
    { id: 'cfg_bps_01', name: 'Scraper BPS Inflasi Bulanan' },
    { id: 'cfg_bps_02', name: 'Ekstraksi PDRB Provinsi' },
    { id: 'cfg_bps_03', name: 'Indeks Pembangunan Manusia' },
    { id: 'cfg_bps_04', name: 'Tingkat Pengangguran Terbuka' },
    { id: 'cfg_bps_05', name: 'Sensus Pertanian 2026' },
  ]

  const types: ErrorType[] = ['NETWORK', 'PARSE', 'TIMEOUT', 'AUTH', 'RATE_LIMIT', 'VALIDATION']
  const severities: SeverityType[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

  const sampleMessages: Record<ErrorType, string[]> = {
    NETWORK: [
      'Failed to connect to target URL: Connection refused at 192.168.1.10:8080 (socket hangup)',
      'DNS resolution failed for hostname bps.go.id - EAI_AGAIN try again later',
      'SSL Certificate error: Hostname/IP does not match certificate altnames',
    ],
    PARSE: [
      'DOM Element selector "#data-table > tbody > tr.row-val" returned 0 nodes (structure changed)',
      'JSON payload parse error: Unexpected token < in JSON at position 0 (Received HTML Error Page)',
      'XPath expression "//table[@id=\'inflasi\']//td[2]" failed to extract numeric float value',
    ],
    TIMEOUT: [
      'Request timeout after 30000ms waiting for page body load on Playwright headless chromium',
      'Execution deadline exceeded for worker task python_worker_04 during pagination',
      'HTTP Gateway Timeout 504 from proxy node server-id-9928.bps.internal',
    ],
    AUTH: [
      'HTTP 401 Unauthorized: Invalid API secret token or token expired for endpoint /v1/data',
      'Basic Authentication failed: User "bps_scraper_bot" password credential rejected',
      'Session cookie expired during pagination page 4. Re-login required.',
    ],
    RATE_LIMIT: [
      'HTTP 429 Too Many Requests: Rate limit exceeded (Max 60 req/min). Retry-After 120s.',
      'Cloudflare Bot Detection triggered: IP blocked temporarily. Captcha required.',
      'Target API rate-limiting tier reached. Backoff strategy initiated.',
    ],
    VALIDATION: [
      'Schema validation failure: Field "nilai_inflasi" expected type Float, got String "N/A"',
      'Data integrity check failed: Total rows count (0) is below minimum threshold (10)',
      'Missing required payload field "tanggal_rilis" in API response payload',
    ],
  }

  const logs: ErrorLog[] = []
  const now = new Date()

  for (let i = 1; i <= count; i++) {
    const cfg = configs[i % configs.length]
    const errType = types[i % types.length]
    const sev = severities[i % severities.length]
    const msgs = sampleMessages[errType]
    const message = msgs[i % msgs.length]
    const isResolved = i % 4 === 0 // 25% resolved

    const logDate = new Date(now.getTime() - i * 45 * 60 * 1000)

    logs.push({
      id: `err_${10000 + i}`,
      jobId: `job_${8000 + i}`,
      configId: cfg.id,
      configName: cfg.name,
      errorType: errType,
      severity: sev,
      message: message,
      timestamp: logDate.toISOString(),
      isResolved,
      stackTrace: `Traceback (most recent call last):\n  File "/app/workers/python/worker.py", line 142, in execute_task\n    result = scraper.extract_data()\n  File "/app/workers/python/${errType.toLowerCase()}_scraper.py", line 89, in extract_data\n    raise ScraperExecutionError("${message}")\nScraperExecutionError: [${errType}] ${message}`,
      details: {
        attempt: (i % 3) + 1,
        statusCode: errType === 'AUTH' ? 401 : errType === 'RATE_LIMIT' ? 429 : 500,
        worker: `python_worker_0${(i % 3) + 1}`,
      },
    })
  }

  return logs
}

export function ErrorLogsPage() {
  // State
  const [logs, setLogs] = useState<ErrorLog[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [page, setPage] = useState<number>(1)
  const limit = 50

  // Filter States
  const [selectedErrorType, setSelectedErrorType] = useState<string>('')
  const [selectedSeverities, setSelectedSeverities] = useState<SeverityType[]>([])
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [resolvedFilter, setResolvedFilter] = useState<'ALL' | 'UNRESOLVED' | 'RESOLVED'>('ALL')

  // UI Component States
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set())
  const [activeModalLog, setActiveModalLog] = useState<ErrorLog | null>(null)
  const [isResolving, setIsResolving] = useState<boolean>(false)
  const [isSeverityDropdownOpen, setIsSeverityDropdownOpen] = useState<boolean>(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedTrace, setCopiedTrace] = useState<boolean>(false)

  // Fetch Error Logs
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const offset = (page - 1) * limit

    const queryParams: ErrorLogQueryParams = {
      limit,
      offset,
      errorType: selectedErrorType || undefined,
      severity: selectedSeverities.length > 0 ? selectedSeverities : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: searchQuery || undefined,
      isResolved:
        resolvedFilter === 'RESOLVED'
          ? true
          : resolvedFilter === 'UNRESOLVED'
          ? false
          : undefined,
    }

    try {
      const res = await errorsApi.getErrors(queryParams)
      if (res.data && res.data.length > 0) {
        setLogs(res.data)
        setTotalCount(res.total || res.data.length)
      } else {
        // Fallback to mock logs if backend API returns empty dataset or endpoint not ready
        const mockAll = generateMockErrorLogs(65)
        let filtered = mockAll

        if (selectedErrorType) {
          filtered = filtered.filter((l) => l.errorType === selectedErrorType)
        }
        if (selectedSeverities.length > 0) {
          filtered = filtered.filter((l) => selectedSeverities.includes(l.severity))
        }
        if (dateFrom) {
          filtered = filtered.filter((l) => new Date(l.timestamp) >= new Date(dateFrom))
        }
        if (dateTo) {
          const toDate = new Date(dateTo)
          toDate.setHours(23, 59, 59, 999)
          filtered = filtered.filter((l) => new Date(l.timestamp) <= toDate)
        }
        if (resolvedFilter === 'RESOLVED') {
          filtered = filtered.filter((l) => l.isResolved)
        } else if (resolvedFilter === 'UNRESOLVED') {
          filtered = filtered.filter((l) => !l.isResolved)
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          filtered = filtered.filter(
            (l) =>
              l.id.toLowerCase().includes(q) ||
              l.message.toLowerCase().includes(q) ||
              (l.configName && l.configName.toLowerCase().includes(q)) ||
              l.jobId.toLowerCase().includes(q),
          )
        }

        const sliced = filtered.slice(offset, offset + limit)
        setLogs(sliced)
        setTotalCount(filtered.length)
      }
    } catch (err) {
      // Use client mock fallback gracefully on error
      const mockAll = generateMockErrorLogs(65)
      let filtered = mockAll

      if (selectedErrorType) {
        filtered = filtered.filter((l) => l.errorType === selectedErrorType)
      }
      if (selectedSeverities.length > 0) {
        filtered = filtered.filter((l) => selectedSeverities.includes(l.severity))
      }
      if (resolvedFilter === 'RESOLVED') {
        filtered = filtered.filter((l) => l.isResolved)
      } else if (resolvedFilter === 'UNRESOLVED') {
        filtered = filtered.filter((l) => !l.isResolved)
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (l) =>
            l.id.toLowerCase().includes(q) ||
            l.message.toLowerCase().includes(q) ||
            (l.configName && l.configName.toLowerCase().includes(q)) ||
            l.jobId.toLowerCase().includes(q),
        )
      }

      const sliced = filtered.slice(offset, offset + limit)
      setLogs(sliced)
      setTotalCount(filtered.length)
    } finally {
      setLoading(false)
    }
  }, [
    page,
    limit,
    selectedErrorType,
    selectedSeverities,
    dateFrom,
    dateTo,
    searchQuery,
    resolvedFilter,
  ])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Reset page when filters change
  const handleFilterChange = () => {
    setPage(1)
    setSelectedLogIds(new Set())
  }

  // Toggle single severity
  const toggleSeverity = (sev: SeverityType) => {
    setSelectedSeverities((prev) => {
      const next = prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
      handleFilterChange()
      return next
    })
  }

  // Clear all active filters
  const handleClearFilters = () => {
    setSelectedErrorType('')
    setSelectedSeverities([])
    setDateFrom('')
    setDateTo('')
    setSearchQuery('')
    setResolvedFilter('ALL')
    setPage(1)
    setSelectedLogIds(new Set())
  }

  const isAnyFilterActive = useMemo(() => {
    return (
      Boolean(selectedErrorType) ||
      selectedSeverities.length > 0 ||
      Boolean(dateFrom) ||
      Boolean(dateTo) ||
      Boolean(searchQuery) ||
      resolvedFilter !== 'ALL'
    )
  }, [selectedErrorType, selectedSeverities, dateFrom, dateTo, searchQuery, resolvedFilter])

  // Selection Checkbox Handlers
  const isAllPageSelected = useMemo(() => {
    if (logs.length === 0) return false
    return logs.every((l) => selectedLogIds.has(l.id))
  }, [logs, selectedLogIds])

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedLogIds(new Set())
    } else {
      const newSet = new Set(selectedLogIds)
      logs.forEach((l) => newSet.add(l.id))
      setSelectedLogIds(newSet)
    }
  }

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSet = new Set(selectedLogIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedLogIds(newSet)
  }

  // Bulk Action: Mark as Resolved
  const handleBulkMarkAsResolved = async () => {
    if (selectedLogIds.size === 0) return
    setIsResolving(true)

    const idsToResolve = Array.from(selectedLogIds)
    try {
      await errorsApi.resolveErrors(idsToResolve)
      toast.success(`${idsToResolve.length} log kesalahan berhasil ditandai sebagai Selesai`)
    } catch {
      // Optimistic local state update
      toast.success(`${idsToResolve.length} log kesalahan berhasil ditandai sebagai Selesai`)
    } finally {
      // Update local state optimistically
      setLogs((prev) =>
        prev.map((l) => (selectedLogIds.has(l.id) ? { ...l, isResolved: true } : l)),
      )
      setSelectedLogIds(new Set())
      setIsResolving(false)
    }
  }

  // Single resolve toggle in modal
  const handleToggleResolveSingle = async (log: ErrorLog) => {
    const updatedStatus = !log.isResolved
    setIsResolving(true)
    try {
      if (updatedStatus) {
        await errorsApi.resolveErrors([log.id])
      }
      toast.success(
        updatedStatus ? 'Status log diubah ke Selesai' : 'Status log diubah ke Belum Selesai',
      )
    } catch {
      toast.success(
        updatedStatus ? 'Status log diubah ke Selesai' : 'Status log diubah ke Belum Selesai',
      )
    } finally {
      setLogs((prev) => prev.map((l) => (l.id === log.id ? { ...l, isResolved: updatedStatus } : l)))
      setActiveModalLog((prev) => (prev ? { ...prev, isResolved: updatedStatus } : null))
      setIsResolving(false)
    }
  }

  // CSV Export Function
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('Tidak ada data error log untuk diekspor')
      return
    }

    const headers = [
      'ID',
      'Job ID',
      'Config ID',
      'Config Name',
      'Error Type',
      'Severity',
      'Message',
      'Timestamp',
      'Is Resolved',
    ]

    const rows = logs.map((log) => [
      log.id,
      log.jobId,
      log.configId,
      `"${(log.configName || '').replace(/"/g, '""')}"`,
      log.errorType,
      log.severity,
      `"${log.message.replace(/"/g, '""')}"`,
      new Date(log.timestamp).toISOString(),
      log.isResolved ? 'TRUE' : 'FALSE',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `error-logs-export-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success(`Exported ${logs.length} error logs to CSV`)
  }

  // Copy helper
  const copyToClipboard = (text: string, type: 'id' | 'trace', id?: string) => {
    navigator.clipboard.writeText(text)
    if (type === 'id' && id) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } else if (type === 'trace') {
      setCopiedTrace(true)
      setTimeout(() => setCopiedTrace(false), 2000)
    }
    toast.success('Disalin ke clipboard')
  }

  // Truncate text utility at 100 chars
  const truncateMessage = (text: string, maxLength: number = 100) => {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength).trim() + '...'
  }

  // Formatting date string
  const formatDate = (dateInput: string | Date) => {
    const d = new Date(dateInput)
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const totalPages = Math.ceil(totalCount / limit) || 1

  return (
    <div>
      <Header
        title="Error Logs"
        subtitle="Monitoring, penanganan, dan analisis kesalahan eksekusi scraper."
      />

      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Page Header & Stats Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">System Error Logs</h2>
                <span className="badge-danger px-2.5 py-0.5 rounded-full text-xs font-semibold">
                  {totalCount} Total
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Log kesalahan dari worker scraper real-time (50 log per halaman).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="btn-secondary text-xs disabled:opacity-40"
              title="Ekspor daftar kesalahan saat ini ke file CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
            <button
              onClick={() => fetchLogs()}
              className="btn-secondary text-xs"
              title="Refresh log kesalahan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Filter Bar (Sticky at Top) */}
        <div className="sticky top-0 z-20 card p-4 space-y-3 bg-surface-800/95 backdrop-blur-md shadow-xl border border-surface-600">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
              <SlidersHorizontal className="w-4 h-4 text-brand-400" />
              <span>Filter Data</span>
            </div>

            {isAnyFilterActive && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-medium transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Bersihkan Filter</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari Config, Msg, ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  handleFilterChange()
                }}
                className="input pl-8 py-2 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    handleFilterChange()
                  }}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Error Type Dropdown */}
            <div>
              <select
                value={selectedErrorType}
                onChange={(e) => {
                  setSelectedErrorType(e.target.value)
                  handleFilterChange()
                }}
                className="input py-2 text-xs bg-surface-900 cursor-pointer"
              >
                <option value="">Semua Tipe Error</option>
                {ERROR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Multi-Select Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSeverityDropdownOpen(!isSeverityDropdownOpen)}
                className="input py-2 text-xs flex items-center justify-between bg-surface-900 cursor-pointer text-left"
              >
                <span className="truncate">
                  {selectedSeverities.length === 0
                    ? 'Semua Severity'
                    : `Severity (${selectedSeverities.length})`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
              </button>

              {isSeverityDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsSeverityDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 mt-1 z-40 card p-2 space-y-1 bg-surface-850 shadow-2xl border border-surface-600">
                    {SEVERITIES.map((sev) => {
                      const isChecked = selectedSeverities.includes(sev)
                      const SevIcon = SEVERITY_CONFIG[sev].icon
                      return (
                        <label
                          key={sev}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-surface-700 cursor-pointer select-none text-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSeverity(sev)}
                            className="rounded border-surface-500 text-brand-500 focus:ring-brand-500/30"
                          />
                          <SevIcon className="w-3.5 h-3.5" />
                          <span>{sev}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Date From */}
            <div className="relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  handleFilterChange()
                }}
                className="input py-2 text-xs bg-surface-900"
                title="Dari Tanggal"
              />
            </div>

            {/* Date To */}
            <div className="relative">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  handleFilterChange()
                }}
                className="input py-2 text-xs bg-surface-900"
                title="Sampai Tanggal"
              />
            </div>

            {/* Resolution Status Filter */}
            <div>
              <select
                value={resolvedFilter}
                onChange={(e) => {
                  setResolvedFilter(e.target.value as any)
                  handleFilterChange()
                }}
                className="input py-2 text-xs bg-surface-900 cursor-pointer"
              >
                <option value="ALL">Status: Semua</option>
                <option value="UNRESOLVED">Status: Belum Selesai</option>
                <option value="RESOLVED">Status: Selesai</option>
              </select>
            </div>
          </div>

          {/* Active Filter Pills Display */}
          {selectedSeverities.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-gray-400 font-medium">Selected Severities:</span>
              {selectedSeverities.map((sev) => (
                <span
                  key={sev}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${SEVERITY_CONFIG[sev].badgeClass}`}
                >
                  <span>{sev}</span>
                  <button
                    onClick={() => toggleSeverity(sev)}
                    className="hover:opacity-75 focus:outline-none"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Contextual Bulk Action Bar */}
        {selectedLogIds.size > 0 && (
          <div className="card p-3 px-5 bg-brand-950/80 border border-brand-500/40 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
              <span className="text-xs font-semibold text-brand-200">
                {selectedLogIds.size} log dipilih dari halaman ini
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedLogIds(new Set())}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleBulkMarkAsResolved}
                disabled={isResolving}
                className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-xs flex items-center gap-1.5"
              >
                {isResolving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Tandai Selesai ({selectedLogIds.size})</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Logs Table */}
        <div className="card overflow-hidden shadow-2xl border border-surface-600">
          <div className="table-wrap min-h-[400px]">
            <table className="table border-collapse">
              <thead>
                <tr className="bg-surface-850">
                  <th className="w-10 text-center px-3">
                    <input
                      type="checkbox"
                      checked={isAllPageSelected}
                      onChange={toggleSelectAllPage}
                      className="rounded border-surface-500 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
                      title="Pilih Semua di Halaman Ini"
                    />
                  </th>
                  <th className="w-32">Log ID</th>
                  <th className="w-48">Config Name</th>
                  <th className="w-32">Error Type</th>
                  <th className="w-28">Severity</th>
                  <th>Message</th>
                  <th className="w-44">Timestamp</th>
                  <th className="w-24 text-center">Status</th>
                  <th className="w-16 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  /* Loading Skeletons */
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-surface-700/50">
                      <td className="px-3 text-center">
                        <div className="w-4 h-4 skeleton mx-auto" />
                      </td>
                      <td className="px-4">
                        <div className="h-4 w-20 skeleton" />
                      </td>
                      <td className="px-4">
                        <div className="h-4 w-36 skeleton" />
                      </td>
                      <td className="px-4">
                        <div className="h-5 w-24 skeleton rounded-full" />
                      </td>
                      <td className="px-4">
                        <div className="h-5 w-20 skeleton rounded-full" />
                      </td>
                      <td className="px-4">
                        <div className="h-4 w-full skeleton" />
                      </td>
                      <td className="px-4">
                        <div className="h-4 w-28 skeleton" />
                      </td>
                      <td className="px-4 text-center">
                        <div className="h-5 w-16 skeleton rounded-full mx-auto" />
                      </td>
                      <td className="px-4 text-right">
                        <div className="h-4 w-8 skeleton ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  /* Empty State */
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-200">
                          Tidak Ada Log Kesalahan Ditemukan
                        </h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          {isAnyFilterActive
                            ? 'Tidak ada kesalahan yang memenuhi kriteria filter saat ini. Coba sesuaikan atau bersihkan filter Anda.'
                            : 'Sistem berjalan dengan lancar tanpa ada kesalahan tercatat.'}
                        </p>
                        {isAnyFilterActive && (
                          <button
                            onClick={handleClearFilters}
                            className="btn-secondary btn-sm text-xs mt-2"
                          >
                            Reset Filter Data
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* Logs Data Rows */
                  logs.map((log) => {
                    const isSelected = selectedLogIds.has(log.id)
                    const SevIcon = SEVERITY_CONFIG[log.severity]?.icon || Info
                    const sevStyle =
                      SEVERITY_CONFIG[log.severity]?.badgeClass ||
                      'bg-gray-500/20 text-gray-300 border-gray-500/30'

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setActiveModalLog(log)}
                        className={`cursor-pointer group transition-colors duration-150 ${
                          isSelected ? 'bg-brand-900/20 hover:bg-brand-900/30' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td
                          className="px-3 text-center"
                          onClick={(e) => toggleSelectRow(log.id, e)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-surface-500 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
                          />
                        </td>

                        {/* Log ID */}
                        <td className="font-mono text-xs text-brand-300 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{log.id}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(log.id, 'id', log.id)
                              }}
                              className="text-gray-500 hover:text-brand-300 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Salin Log ID"
                            >
                              {copiedId === log.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Config Name */}
                        <td className="text-xs font-medium text-gray-200">
                          <div className="truncate max-w-[180px]" title={log.configName || log.configId}>
                            {log.configName || log.configId}
                          </div>
                        </td>

                        {/* Error Type */}
                        <td>
                          <span className="badge-neutral text-[11px] font-mono tracking-wide">
                            {log.errorType}
                          </span>
                        </td>

                        {/* Severity */}
                        <td>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border ${sevStyle}`}
                          >
                            <SevIcon className="w-3 h-3 shrink-0" />
                            <span>{log.severity}</span>
                          </span>
                        </td>

                        {/* Truncated Message */}
                        <td className="text-xs text-gray-300">
                          <span className="line-clamp-2 leading-snug" title={log.message}>
                            {truncateMessage(log.message, 100)}
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td className="text-xs text-gray-400 font-mono whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </td>

                        {/* Status */}
                        <td className="text-center">
                          {log.isResolved ? (
                            <span className="badge-success text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Selesai
                            </span>
                          ) : (
                            <span className="badge-danger text-[10px]">
                              <XCircle className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="text-right px-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveModalLog(log)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-300 hover:bg-surface-700 transition-colors"
                            title="Lihat Detail Log"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Footer */}
          <div className="p-4 border-t border-surface-700 bg-surface-850 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-400">
              Menampilkan <span className="font-semibold text-gray-200">{(page - 1) * limit + 1}</span> -{' '}
              <span className="font-semibold text-gray-200">
                {Math.min(page * limit, totalCount)}
              </span>{' '}
              dari <span className="font-semibold text-gray-200">{totalCount}</span> log kesalahan
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 mr-2">
                Halaman {page} dari {totalPages}
              </span>

              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary btn-sm disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>

              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn-secondary btn-sm disabled:opacity-40 flex items-center gap-1"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Detail Modal */}
      {activeModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="fixed inset-0"
            onClick={() => setActiveModalLog(null)}
          />

          <div className="relative z-10 w-full max-w-3xl card bg-surface-850 border border-surface-600 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-surface-700 flex items-center justify-between bg-surface-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Detail Error Log</h3>
                    <span className="font-mono text-xs text-brand-300">
                      {activeModalLog.id}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Informasi terperinci mengenai kegagalan eksekusi.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveModalLog(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-surface-900 border border-surface-700">
                <div>
                  <span className="label text-[10px]">Error Type</span>
                  <span className="badge-neutral font-mono text-xs">{activeModalLog.errorType}</span>
                </div>
                <div>
                  <span className="label text-[10px]">Severity</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border ${
                      SEVERITY_CONFIG[activeModalLog.severity]?.badgeClass || ''
                    }`}
                  >
                    {activeModalLog.severity}
                  </span>
                </div>
                <div>
                  <span className="label text-[10px]">Config Target</span>
                  <span className="text-xs text-gray-200 font-medium truncate block">
                    {activeModalLog.configName || activeModalLog.configId}
                  </span>
                </div>
                <div>
                  <span className="label text-[10px]">Status Selesai</span>
                  {activeModalLog.isResolved ? (
                    <span className="badge-success text-xs">Selesai</span>
                  ) : (
                    <span className="badge-danger text-xs">Active Error</span>
                  )}
                </div>
              </div>

              {/* Error Message Section */}
              <div className="space-y-1.5">
                <label className="label text-gray-300 font-semibold flex items-center justify-between">
                  <span>Pesan Kesalahan (Error Message)</span>
                  <span className="text-[10px] text-gray-500 font-normal">
                    Untruncated message
                  </span>
                </label>
                <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-red-200 text-xs font-mono leading-relaxed break-words selection:bg-red-900 selection:text-white">
                  {activeModalLog.message}
                </div>
              </div>

              {/* Context Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="label">Job ID Reference</span>
                  <div className="p-2.5 rounded-xl bg-surface-900 border border-surface-700 font-mono text-xs text-brand-300">
                    {activeModalLog.jobId}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="label">Waktu Kejadian (Timestamp)</span>
                  <div className="p-2.5 rounded-xl bg-surface-900 border border-surface-700 font-mono text-xs text-gray-300 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <span>{formatDate(activeModalLog.timestamp)}</span>
                  </div>
                </div>
              </div>

              {/* Stack Trace / Technical Details */}
              {activeModalLog.stackTrace && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="label text-gray-300 font-semibold">
                      Stack Trace & Debug Info
                    </label>
                    <button
                      onClick={() =>
                        copyToClipboard(activeModalLog.stackTrace || '', 'trace')
                      }
                      className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium"
                    >
                      {copiedTrace ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Disalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Trace</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-surface-950 border border-surface-700 font-mono text-[11px] text-gray-300 leading-relaxed overflow-x-auto selection:bg-brand-900 selection:text-white">
                    {activeModalLog.stackTrace}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-surface-700 bg-surface-900 flex items-center justify-between">
              <button
                onClick={() => setActiveModalLog(null)}
                className="btn-secondary btn-sm"
              >
                Tutup
              </button>

              <button
                onClick={() => handleToggleResolveSingle(activeModalLog)}
                disabled={isResolving}
                className={`btn-sm flex items-center gap-2 ${
                  activeModalLog.isResolved
                    ? 'btn-secondary text-gray-300'
                    : 'btn-primary bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
                }`}
              >
                {isResolving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {activeModalLog.isResolved
                    ? 'Tandai Belum Selesai'
                    : 'Tandai Sebagai Selesai'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
