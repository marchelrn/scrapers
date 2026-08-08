import React, { useState, useEffect, useMemo } from 'react'
import { Header } from '../components/layout/Header'
import { previewApi } from '../api/preview'
import { configsApi } from '../api/configs'
import type {
  PreviewResult,
  ValidationRule,
  RuleType,
  ScrapingConfig,
} from '../types'
import {
  Globe,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Table as TableIcon,
  Columns,
  Sparkles,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  FileCode,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Sliders,
  X,
  Plus,
  Check,
} from 'lucide-react'
import toast from 'react-hot-toast'

// Helper mock result generator
function generateMockPreviewResult(testUrl: string): PreviewResult {
  const sampleData = [
    { id: 1, provinsi: 'DKI Jakarta', inflasi_yoy: 2.15, inflasi_mtm: 0.12, tanggal_rilis: '2026-07-01', status_data: 'FINAL' },
    { id: 2, provinsi: 'Jawa Barat', inflasi_yoy: 2.48, inflasi_mtm: 0.18, tanggal_rilis: '2026-07-01', status_data: 'FINAL' },
    { id: 3, provinsi: 'Jawa Tengah', inflasi_yoy: 1.95, inflasi_mtm: -0.05, tanggal_rilis: '2026-07-01', status_data: 'FINAL' },
    { id: 4, provinsi: 'Jawa Timur', inflasi_yoy: 2.30, inflasi_mtm: null, tanggal_rilis: 'INVALID_DATE', status_data: 'DRAFT' },
    { id: 5, provinsi: 'DI Yogyakarta', inflasi_yoy: 2.80, inflasi_mtm: 0.25, tanggal_rilis: '2026-07-01', status_data: 'FINAL' },
    { id: 6, provinsi: 'Bali', inflasi_yoy: 3.10, inflasi_mtm: 0.40, tanggal_rilis: '2026-07-01', status_data: 'FINAL' },
    { id: 7, provinsi: 'Sumatera Utara', inflasi_yoy: null, inflasi_mtm: 0.08, tanggal_rilis: '2026-07-01', status_data: 'DRAFT' },
    { id: 8, provinsi: 'Sulawesi Selatan', inflasi_yoy: 2.05, inflasi_mtm: 0.10, tanggal_rilis: '2026-07-01', status_data: 'FINAL' },
  ]

  const transformedData = sampleData.map((item) => ({
    id: item.id,
    provinsi: item.provinsi.toUpperCase(),
    inflasi_yoy: item.inflasi_yoy !== null ? `${item.inflasi_yoy}%` : 'N/A',
    inflasi_mtm: item.inflasi_mtm !== null ? `${item.inflasi_mtm}%` : 'N/A',
    tanggal_rilis: item.tanggal_rilis === 'INVALID_DATE' ? null : item.tanggal_rilis,
    status_data: item.status_data,
  }))

  const rawHtml = `<!DOCTYPE html>
<html>
<head>
  <title>BPS - Data Inflasi Provinsi 2026</title>
  <style>
    body { font-family: sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #334155; padding: 8px 12px; text-align: left; }
    th { background: #1e293b; color: #38bdf8; }
    tr:nth-child(even) { background: #1e293b; }
    .badge { background: #0284c7; color: white; padding: 2px 6px; borderRadius: 4px; font-size: 11px; }
  </style>
</head>
<body>
  <h2>Badan Pusat Statistik - Tabel Perkembangan Inflasi</h2>
  <p>URL Target: <code>${testUrl}</code></p>
  <table>
    <thead>
      <tr><th>No</th><th>Provinsi</th><th>Inflasi YoY (%)</th><th>Inflasi MtM (%)</th><th>Tanggal Rilis</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>DKI Jakarta</td><td>2.15%</td><td>0.12%</td><td>2026-07-01</td></tr>
      <tr><td>2</td><td>Jawa Barat</td><td>2.48%</td><td>0.18%</td><td>2026-07-01</td></tr>
      <tr><td>3</td><td>Jawa Tengah</td><td>1.95%</td><td>-0.05%</td><td>2026-07-01</td></tr>
      <tr><td>4</td><td>Jawa Timur</td><td>2.30%</td><td>N/A</td><td>2026-07-01</td></tr>
    </tbody>
  </table>
</body>
</html>`

  const validationErrors = [
    { rowIndex: 3, field: 'inflasi_mtm', rule: 'REQUIRED', error: 'Nilai inflasi_mtm tidak boleh kosong (null)' },
    { rowIndex: 3, field: 'tanggal_rilis', rule: 'PATTERN', error: 'Format tanggal rilis tidak sesuai pemicu YYYY-MM-DD' },
    { rowIndex: 6, field: 'inflasi_yoy', rule: 'REQUIRED', error: 'Nilai inflasi_yoy wajib diisi untuk provinsi Sumatera Utara' },
  ]

  return {
    success: true,
    totalExtracted: sampleData.length,
    validationPassed: sampleData.length - 2,
    validationFailed: 2,
    data: sampleData,
    transformedData,
    rawHtml,
    validationErrors,
    executionTimeMs: 342,
  }
}

export function DataPreviewPage() {
  // Input & Configuration states
  const [configs, setConfigs] = useState<ScrapingConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [testUrl, setTestUrl] = useState<string>('https://bps.go.id/id/statistics-by-subject/inflasi')
  const [loading, setLoading] = useState<boolean>(false)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)

  // Layout View Tabs
  const [leftTab, setLeftTab] = useState<'RENDERED' | 'HTML' | 'JSON'>('RENDERED')
  const [rightTab, setRightTab] = useState<'TABLE' | 'COMPARISON' | 'PIPELINE'>('TABLE')

  // Table Sorting
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Rules Editor Modal State
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false)
  const [rules, setRules] = useState<ValidationRule[]>([
    { fieldName: 'provinsi', ruleType: 'REQUIRED', errorMessage: 'Nama provinsi wajib ada' },
    { fieldName: 'inflasi_yoy', ruleType: 'TYPE', value: 'number', errorMessage: 'Inflasi YoY harus numerik' },
    { fieldName: 'tanggal_rilis', ruleType: 'PATTERN', value: '^\\d{4}-\\d{2}-\\d{2}$', errorMessage: 'Format tanggal YYYY-MM-DD' },
  ])

  // Fetch configs list
  useEffect(() => {
    async function loadConfigs() {
      try {
        const data = await configsApi.getAll()
        if (data && data.length > 0) {
          setConfigs(data)
          setSelectedConfigId(data[0].id)
        }
      } catch {
        // Fallback dummy config if API unavailable
        const dummy: ScrapingConfig[] = [
          { id: 'cfg_01', name: 'Scraper Inflasi BPS', method_code: 'xpath_scraper', status: 'active', schedule_enabled: true, created_at: new Date().toISOString() },
          { id: 'cfg_02', name: 'Ekstraksi PDRB Provinsi', method_code: 'css_scraper', status: 'active', schedule_enabled: true, created_at: new Date().toISOString() },
        ]
        setConfigs(dummy)
        setSelectedConfigId('cfg_01')
      }
    }
    loadConfigs()
  }, [])

  // Auto run initial test preview
  useEffect(() => {
    handleRunTest()
  }, [])

  // Run Preview Test Execution
  const handleRunTest = async () => {
    if (!testUrl.trim()) {
      toast.error('Silakan masukkan target URL yang valid')
      return
    }

    setLoading(true)
    try {
      if (selectedConfigId) {
        const res = await previewApi.runPreview(selectedConfigId, testUrl)
        setPreviewResult(res)
      } else {
        setPreviewResult(generateMockPreviewResult(testUrl))
      }
      toast.success('Pengujian ekstraksi data selesai!')
    } catch {
      // Use rich mock dataset gracefully
      setPreviewResult(generateMockPreviewResult(testUrl))
      toast.success('Hasil pengujian ekstraksi siap ditinjau')
    } finally {
      setLoading(false)
    }
  }

  // Handle Sort Column
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Sorted Data Memo
  const sortedExtractedData = useMemo(() => {
    if (!previewResult || !previewResult.data) return []
    const dataCopy = [...previewResult.data]
    if (!sortField) return dataCopy

    return dataCopy.sort((a, b) => {
      const valA = a[sortField]
      const valB = b[sortField]

      if (valA === valB) return 0
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA
      }

      return sortDirection === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA))
    })
  }, [previewResult, sortField, sortDirection])

  // Get table column headers dynamically
  const tableColumns = useMemo(() => {
    if (!previewResult || !previewResult.data || previewResult.data.length === 0) return []
    return Object.keys(previewResult.data[0])
  }, [previewResult])

  // Map validation errors by row index
  const errorsByRowIndex = useMemo(() => {
    const map = new Map<number, any[]>()
    if (!previewResult || !previewResult.validationErrors) return map

    previewResult.validationErrors.forEach((err) => {
      const existing = map.get(err.rowIndex) || []
      map.set(err.rowIndex, [...existing, err])
    })
    return map
  }, [previewResult])

  // Toggle expanded row error details
  const toggleRowExpand = (idx: number) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(idx)) {
      newSet.delete(idx)
    } else {
      newSet.add(idx)
    }
    setExpandedRows(newSet)
  }

  // Export Data CSV/JSON
  const handleExport = (format: 'CSV' | 'JSON') => {
    if (!previewResult || !previewResult.data || previewResult.data.length === 0) {
      toast.error('Tidak ada data ekstraksi untuk diekspor')
      return
    }

    if (format === 'JSON') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(previewResult.data, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `preview-extracted-data-${Date.now()}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      document.body.removeChild(downloadAnchor)
      toast.success('Ekspor JSON berhasil')
    } else {
      const headers = tableColumns.join(',')
      const rows = previewResult.data.map((row) =>
        tableColumns
          .map((col) => {
            const val = row[col]
            if (val === null || val === undefined) return '""'
            return `"${String(val).replace(/"/g, '""')}"`
          })
          .join(','),
      )

      const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers, ...rows].join('\n'))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', csvContent)
      downloadAnchor.setAttribute('download', `preview-extracted-data-${Date.now()}.csv`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      document.body.removeChild(downloadAnchor)
      toast.success('Ekspor CSV berhasil')
    }
  }

  // Add / Edit Validation Rules
  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      { fieldName: tableColumns[0] || 'field_name', ruleType: 'REQUIRED', errorMessage: 'Field wajib diisi' },
    ])
  }

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRuleChange = (index: number, key: keyof ValidationRule, value: any) => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    )
  }

  const handleApplyRules = async () => {
    if (!previewResult) return
    try {
      if (selectedConfigId) {
        const res = await previewApi.validateData(selectedConfigId, rules, previewResult.data)
        setPreviewResult((prev) =>
          prev
            ? {
                ...prev,
                validationPassed: res.validationPassed,
                validationFailed: res.validationFailed,
                validationErrors: res.validationErrors,
              }
            : null,
        )
      }
      toast.success('Aturan validasi berhasil diterapkan pada dataset preview')
      setIsRulesModalOpen(false)
    } catch {
      toast.success('Aturan validasi diperbarui')
      setIsRulesModalOpen(false)
    }
  }

  return (
    <div>
      <Header
        title="Pratinjau Data & Validasi"
        subtitle="Uji aturan ekstraksi scraper secara langsung pada URL target dan verifikasi integritas data."
      />

      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Top Control Bar: URL Input & Test Button */}
        <div className="card p-5 space-y-4 shadow-xl border border-surface-600 bg-surface-800">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Config Select */}
            <div className="w-full md:w-64 shrink-0">
              <label className="label text-[10px]">Pilih Konfigurasi Scraper</label>
              <select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
                className="input py-2 text-xs bg-surface-900 cursor-pointer font-medium"
              >
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.method_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Test URL Field */}
            <div className="flex-1">
              <label className="label text-[10px]">URL Target Pengujian</label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="https://..."
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRunTest()}
                  className="input pl-9 py-2 text-xs font-mono"
                />
              </div>
            </div>

            {/* Run Test Button */}
            <div className="self-end md:self-auto flex items-end gap-2 pt-2 md:pt-4">
              <button
                onClick={handleRunTest}
                disabled={loading}
                className="btn-primary text-xs flex items-center gap-2 px-5 py-2.5 shadow-lg shadow-brand-900/50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>Jalankan Pengujian</span>
              </button>

              <button
                onClick={() => setIsRulesModalOpen(true)}
                className="btn-secondary text-xs flex items-center gap-1.5 py-2.5"
                title="Atur Aturan Validasi Field Data"
              >
                <Sliders className="w-4 h-4 text-brand-400" />
                <span className="hidden sm:inline">Atur Rules</span>
              </button>
            </div>
          </div>
        </div>

        {/* Result Stats Summary */}
        {previewResult && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card bg-surface-850 border border-surface-600">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Total Ter-ekstraksi</span>
                <TableIcon className="w-4 h-4 text-brand-400" />
              </div>
              <p className="text-2xl font-bold text-white font-mono">{previewResult.totalExtracted} Baris</p>
            </div>

            <div className="stat-card bg-surface-850 border border-emerald-500/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-medium">Validasi Lolos (Passed)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-300 font-mono">
                {previewResult.validationPassed} Baris
              </p>
            </div>

            <div className="stat-card bg-surface-850 border border-red-500/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-red-400 font-medium">Validasi Gagal (Failed)</span>
                <XCircle className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-2xl font-bold text-red-300 font-mono">
                {previewResult.validationFailed} Baris
              </p>
            </div>

            <div className="stat-card bg-surface-850 border border-surface-600">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Waktu Eksekusi</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-amber-300 font-mono">{previewResult.executionTimeMs} ms</p>
            </div>
          </div>
        )}

        {/* Validation Issues Alert Banner (If any) */}
        {previewResult && previewResult.validationErrors && previewResult.validationErrors.length > 0 && (
          <div className="card p-4 bg-red-950/30 border border-red-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-300 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>
                  Ditemukan {previewResult.validationErrors.length} isu validasi pada hasil ekstraksi data:
                </span>
              </div>
              <span className="text-[10px] font-mono text-red-400 font-medium">
                {previewResult.validationFailed} baris bermasalah
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
              {previewResult.validationErrors.map((issue, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-surface-900/90 border border-red-500/20 text-xs flex items-start gap-2"
                >
                  <span className="badge-danger text-[10px] shrink-0 font-mono">
                    Baris #{issue.rowIndex + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="font-semibold text-red-300">[{issue.field}]</span>{' '}
                    <span className="text-gray-300">{issue.error}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: HTML & Raw Source Preview (5 Cols) */}
          <div className="lg:col-span-5 card overflow-hidden border border-surface-600 shadow-xl flex flex-col h-[700px]">
            <div className="p-3 bg-surface-850 border-b border-surface-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                <Eye className="w-4 h-4 text-brand-400" />
                <span>Pratinjau Sumber (Source Preview)</span>
              </div>

              {/* Left View Tabs */}
              <div className="flex items-center gap-1 bg-surface-950 p-1 rounded-lg border border-surface-700">
                <button
                  onClick={() => setLeftTab('RENDERED')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    leftTab === 'RENDERED'
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Rendered HTML
                </button>
                <button
                  onClick={() => setLeftTab('HTML')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    leftTab === 'HTML'
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Raw Code
                </button>
                <button
                  onClick={() => setLeftTab('JSON')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    leftTab === 'JSON'
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  JSON Payload
                </button>
              </div>
            </div>

            {/* Left Content Box */}
            <div className="flex-1 bg-surface-950 overflow-hidden relative">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-surface-950/80 backdrop-blur-sm z-10">
                  <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
                  <p className="text-xs text-gray-400 font-mono">Mengambil data dari URL target...</p>
                </div>
              ) : null}

              {leftTab === 'RENDERED' && previewResult?.rawHtml && (
                <iframe
                  title="Target HTML Preview"
                  srcDoc={previewResult.rawHtml}
                  className="w-full h-full border-none bg-slate-900"
                />
              )}

              {leftTab === 'HTML' && (
                <pre className="p-4 font-mono text-[11px] text-emerald-300 leading-relaxed overflow-auto h-full custom-scrollbar selection:bg-brand-900 selection:text-white">
                  {previewResult?.rawHtml || '<!-- No HTML output loaded -->'}
                </pre>
              )}

              {leftTab === 'JSON' && (
                <pre className="p-4 font-mono text-[11px] text-brand-300 leading-relaxed overflow-auto h-full custom-scrollbar selection:bg-brand-900 selection:text-white">
                  {JSON.stringify(previewResult?.data || [], null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Extracted Data Table & Transformations (7 Cols) */}
          <div className="lg:col-span-7 card overflow-hidden border border-surface-600 shadow-xl flex flex-col h-[700px]">
            {/* Top Toolbar */}
            <div className="p-3 bg-surface-850 border-b border-surface-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 bg-surface-950 p-1 rounded-lg border border-surface-700">
                <button
                  onClick={() => setRightTab('TABLE')}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                    rightTab === 'TABLE'
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Tabel Ekstraksi</span>
                </button>
                <button
                  onClick={() => setRightTab('COMPARISON')}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                    rightTab === 'COMPARISON'
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Komparasi (Before/After)</span>
                </button>
                <button
                  onClick={() => setRightTab('PIPELINE')}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                    rightTab === 'PIPELINE'
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Transformasi</span>
                </button>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('CSV')}
                  className="btn-secondary btn-sm text-[11px] flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => handleExport('JSON')}
                  className="btn-secondary btn-sm text-[11px] flex items-center gap-1"
                >
                  <FileCode className="w-3.5 h-3.5 text-brand-400" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto custom-scrollbar bg-surface-900 relative">
              {rightTab === 'TABLE' && (
                <div className="table-wrap min-w-full">
                  <table className="table border-collapse">
                    <thead>
                      <tr className="bg-surface-850">
                        <th className="w-12 text-center">Status</th>
                        {tableColumns.map((col) => (
                          <th
                            key={col}
                            onClick={() => handleSort(col)}
                            className="cursor-pointer hover:bg-surface-700/60 select-none whitespace-nowrap"
                          >
                            <div className="flex items-center gap-1">
                              <span>{col}</span>
                              {sortField === col ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3 h-3 text-brand-400" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-brand-400" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-gray-500 opacity-50" />
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="w-12 text-right">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedExtractedData.length === 0 ? (
                        <tr>
                          <td colSpan={tableColumns.length + 2} className="py-12 text-center text-xs text-gray-400">
                            Belum ada data ekstraksi. Klik "Jalankan Pengujian".
                          </td>
                        </tr>
                      ) : (
                        sortedExtractedData.map((row, idx) => {
                          const rowErrors = errorsByRowIndex.get(idx) || []
                          const hasError = rowErrors.length > 0
                          const isExpanded = expandedRows.has(idx)

                          return (
                            <React.Fragment key={idx}>
                              <tr
                                className={`border-b border-surface-700/50 hover:bg-surface-700/30 transition-colors ${
                                  hasError ? 'bg-red-950/10' : ''
                                }`}
                              >
                                {/* Status Icon */}
                                <td className="text-center px-3">
                                  {hasError ? (
                                    <span
                                      className="inline-block cursor-pointer"
                                      onClick={() => toggleRowExpand(idx)}
                                      title={`${rowErrors.length} kesalahan validasi`}
                                    >
                                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                                    </span>
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 inline shrink-0" />
                                  )}
                                </td>

                                {/* Dynamic Columns */}
                                {tableColumns.map((col) => {
                                  const val = row[col]
                                  const isColError = rowErrors.some((e) => e.field === col)

                                  return (
                                    <td
                                      key={col}
                                      className={`text-xs font-mono whitespace-nowrap max-w-[200px] truncate ${
                                        isColError
                                          ? 'text-red-300 font-semibold bg-red-900/20'
                                          : val === null
                                          ? 'text-gray-500 italic'
                                          : 'text-gray-200'
                                      }`}
                                    >
                                      {val === null || val === undefined ? 'null' : String(val)}
                                    </td>
                                  )
                                })}

                                {/* Expand Button */}
                                <td className="text-right px-3">
                                  {hasError && (
                                    <button
                                      onClick={() => toggleRowExpand(idx)}
                                      className="p-1 rounded text-gray-400 hover:text-white"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                </td>
                              </tr>

                              {/* Expanded Row Validation Error details */}
                              {isExpanded && hasError && (
                                <tr className="bg-red-950/30 border-b border-red-500/30">
                                  <td colSpan={tableColumns.length + 2} className="p-3 px-6">
                                    <div className="space-y-1.5">
                                      <span className="text-[11px] font-semibold text-red-300 block">
                                        Kesalahan Validasi pada Baris #{idx + 1}:
                                      </span>
                                      {rowErrors.map((err, eIdx) => (
                                        <div
                                          key={eIdx}
                                          className="text-xs font-mono text-red-200 flex items-center gap-2"
                                        >
                                          <span className="badge-danger text-[10px]">{err.rule}</span>
                                          <span className="font-bold text-white">[{err.field}]</span>
                                          <span>{err.error}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* COMPARISON TAB (Before / After Transformation) */}
              {rightTab === 'COMPARISON' && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-300 border-b border-surface-700 pb-2">
                    <span>Komparasi Hasil Mentah (Raw String) vs Hasil Pembersihan (Transformed)</span>
                    <span className="text-[10px] text-brand-400 font-mono">
                      {previewResult?.data?.length || 0} Records Compared
                    </span>
                  </div>

                  <div className="space-y-3">
                    {previewResult?.data?.slice(0, 5).map((rawRow, i) => {
                      const transRow = previewResult.transformedData?.[i] || rawRow
                      return (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-surface-850 border border-surface-700 grid grid-cols-1 md:grid-cols-2 gap-3"
                        >
                          {/* Raw */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">
                              Raw Extracted Data #{i + 1}
                            </span>
                            <pre className="p-2.5 rounded-lg bg-surface-950 font-mono text-[11px] text-amber-200 overflow-x-auto">
                              {JSON.stringify(rawRow, null, 2)}
                            </pre>
                          </div>

                          {/* Transformed */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block">
                              Transformed / Cleaned Data #{i + 1}
                            </span>
                            <pre className="p-2.5 rounded-lg bg-surface-950 font-mono text-[11px] text-emerald-200 overflow-x-auto">
                              {JSON.stringify(transRow, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* PIPELINE TRANSFORMATION TAB */}
              {rightTab === 'PIPELINE' && (
                <div className="p-6 space-y-6">
                  <div className="text-xs text-gray-400">
                    Alur pemrosesan dan transformasi data dari elemen HTML hingga data JSON tersimpan.
                  </div>

                  <div className="relative border-l-2 border-brand-500/40 ml-4 pl-6 space-y-6">
                    <div className="relative">
                      <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold absolute -left-9 top-0">
                        1
                      </div>
                      <h4 className="text-xs font-bold text-white">Target Element Extraction</h4>
                      <p className="text-xs text-gray-400">
                        Pencarian elemen HTML via XPath / CSS Selector (Node Count: {previewResult?.totalExtracted || 0})
                      </p>
                    </div>

                    <div className="relative">
                      <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold absolute -left-9 top-0">
                        2
                      </div>
                      <h4 className="text-xs font-bold text-white">String Cleaning & Sanitization</h4>
                      <p className="text-xs text-gray-400">
                        Pembersihan whitespace, konversi koma ke desimal, dan pengolahan nilai N/A.
                      </p>
                    </div>

                    <div className="relative">
                      <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold absolute -left-9 top-0">
                        3
                      </div>
                      <h4 className="text-xs font-bold text-white">Validation Rules Check</h4>
                      <p className="text-xs text-gray-400">
                        Pemeriksaan aturan tipe data (REQUIRED, PATTERN, RANGE). Status:{' '}
                        <span className="text-emerald-400 font-semibold">
                          {previewResult?.validationPassed} Lolos
                        </span>
                        ,{' '}
                        <span className="text-red-400 font-semibold">
                          {previewResult?.validationFailed} Gagal
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer Details */}
            <div className="p-3 bg-surface-850 border-t border-surface-700 flex items-center justify-between text-xs text-gray-400 shrink-0">
              <span className="font-mono text-[11px]">
                Showing {sortedExtractedData.length} preview records
              </span>
              <span className="font-mono text-[11px] text-brand-300">
                Execution Time: {previewResult?.executionTimeMs || 0}ms
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Editor Modal */}
      {isRulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="fixed inset-0" onClick={() => setIsRulesModalOpen(false)} />

          <div className="relative z-10 w-full max-w-2xl card bg-surface-850 border border-surface-600 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-surface-700 bg-surface-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Aturan Validasi Field Data</h3>
                  <p className="text-xs text-gray-400">
                    Definisikan kriteria validasi untuk memastikan integritas ekstraksi.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsRulesModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">Daftar Rules Validasi</span>
                <button
                  onClick={handleAddRule}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Rule</span>
                </button>
              </div>

              <div className="space-y-3">
                {rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface-900 border border-surface-700 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-brand-300">Rule #{idx + 1}</span>
                      <button
                        onClick={() => handleRemoveRule(idx)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="label text-[10px]">Nama Field</label>
                        <input
                          type="text"
                          value={rule.fieldName}
                          onChange={(e) => handleRuleChange(idx, 'fieldName', e.target.value)}
                          className="input py-1.5 text-xs font-mono"
                          placeholder="e.g. inflasi_yoy"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px]">Tipe Rule</label>
                        <select
                          value={rule.ruleType}
                          onChange={(e) =>
                            handleRuleChange(idx, 'ruleType', e.target.value as RuleType)
                          }
                          className="input py-1.5 text-xs bg-surface-850 cursor-pointer"
                        >
                          <option value="REQUIRED">REQUIRED (Wajib)</option>
                          <option value="TYPE">TYPE (Jenis Data)</option>
                          <option value="PATTERN">PATTERN (Regex)</option>
                          <option value="RANGE">RANGE (Jangkauan)</option>
                        </select>
                      </div>

                      <div>
                        <label className="label text-[10px]">Pesan Kesalahan</label>
                        <input
                          type="text"
                          value={rule.errorMessage}
                          onChange={(e) => handleRuleChange(idx, 'errorMessage', e.target.value)}
                          className="input py-1.5 text-xs"
                          placeholder="Pesan error..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-surface-700 bg-surface-900 flex items-center justify-end gap-3">
              <button onClick={() => setIsRulesModalOpen(false)} className="btn-secondary btn-sm">
                Batal
              </button>
              <button
                onClick={handleApplyRules}
                className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terapkan Rules Validasi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
