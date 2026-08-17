import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { jobsApi } from '../api/jobs'
import { configsApi } from '../api/configs'
import type { ScrapingJob, ScrapingConfig } from '../types'
import {
  ArrowLeft, CheckCircle2, XCircle, PlayCircle, Clock,
  Terminal, Database, Copy, Check, RefreshCw, FileSpreadsheet, Download, Table, Code2
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<ScrapingJob | null>(null)
  const [config, setConfig] = useState<ScrapingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'results' | 'logs'>('results')
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table')

  const fetchJobDetail = async (silent = false) => {
    if (!id) return
    if (!silent) setLoading(true)
    try {
      const res = await jobsApi.getById(id)
      setJob(res)
      if (res?.config_id) {
        configsApi.getById(res.config_id).then((cfg) => setConfig(cfg)).catch(() => {})
      }
    } catch {
      if (!silent) toast.error('Gagal mengambil detail job')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobDetail(false)
  }, [id])

  useEffect(() => {
    if (!job || job.status === 'success' || job.status === 'failed') return

    const interval = setInterval(() => {
      fetchJobDetail(true)
    }, 3000)

    return () => clearInterval(interval)
  }, [id, job?.status])

  // Process results into flat rows for table display and Excel export
  const flattenedRows = useMemo(() => {
    if (!job?.results || job.results.length === 0) return []
    const rows: Record<string, any>[] = []
    
    // Check if the overall result structure from backend is { error, method, status, results, metadata }
    // If so, we only care about the nested "results" property
    job.results.forEach((item) => {
      let json = item.result_json as any
      
      // Handle the case where the JSON output format has the inner "results" array payload
      // This matches the DTO wrapper structure {"error": null, "method": "...", "results": [...]}
      if (json && typeof json === 'object' && 'results' in json && 'status' in json && 'method' in json) {
        json = json.results
      }
      
      if (Array.isArray(json)) {
        json.forEach((sub) => {
          if (typeof sub === 'object' && sub !== null) {
            rows.push(sub)
          } else {
            rows.push({ result: sub })
          }
        })
      } else if (typeof json === 'object' && json !== null) {
        rows.push(json as Record<string, any>)
      } else if (json !== undefined && json !== null) {
        rows.push({ result: json })
      }
    })
    return rows
  }, [job?.results])

  // Extract unique keys for table header
  const tableColumns = useMemo(() => {
    if (flattenedRows.length === 0) return []
    const keysSet = new Set<string>()
    flattenedRows.forEach((row) => {
      Object.keys(row).forEach((k) => keysSet.add(k))
    })
    return Array.from(keysSet)
  }, [flattenedRows])

  const copyResults = () => {
    if (!job?.results) return
    const str = JSON.stringify(job.results.map((r) => r.result_json), null, 2)
    navigator.clipboard.writeText(str)
    setCopied(true)
    toast.success('Hasil JSON berhasil disalin!')
    setTimeout(() => setCopied(false), 2000)
  }

  const exportExcel = () => {
    if (flattenedRows.length === 0) {
      toast.error('Tidak ada data untuk diekspor')
      return
    }
    try {
      const worksheet = XLSX.utils.json_to_sheet(flattenedRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Results')
      const nameSlug = config?.name ? config.name.replace(/[^a-zA-Z0-9_-]/g, '_') : `job_${id?.substring(0, 8)}`
      const fileName = `${nameSlug}_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(workbook, fileName)
      toast.success(`Berhasil mengunduh ${fileName}`)
    } catch {
      toast.error('Gagal mengekspor file Excel')
    }
  }

  const exportCSV = () => {
    if (flattenedRows.length === 0) {
      toast.error('Tidak ada data untuk diekspor')
      return
    }
    try {
      const worksheet = XLSX.utils.json_to_sheet(flattenedRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Results')
      const nameSlug = config?.name ? config.name.replace(/[^a-zA-Z0-9_-]/g, '_') : `job_${id?.substring(0, 8)}`
      const fileName = `${nameSlug}_${new Date().toISOString().slice(0, 10)}.csv`
      XLSX.writeFile(workbook, fileName, { bookType: 'csv' })
      toast.success(`Berhasil mengunduh ${fileName}`)
    } catch {
      toast.error('Gagal mengekspor file CSV')
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return <span className="badge-success"><CheckCircle2 className="w-3.5 h-3.5" /> Success</span>
      case 'failed':
        return <span className="badge-danger"><XCircle className="w-3.5 h-3.5" /> Failed</span>
      case 'running':
        return <span className="badge-running"><PlayCircle className="w-3.5 h-3.5" /> Running</span>
      default:
        return <span className="badge-warning"><Clock className="w-3.5 h-3.5" /> Pending</span>
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Detail Hasil Eksekusi Job" />
        <div className="p-8 max-w-6xl mx-auto space-y-4">
          <div className="h-48 skeleton" />
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div>
        <Header title="Detail Hasil Eksekusi Job" />
        <div className="p-8 text-center text-gray-400">Job tidak ditemukan.</div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title={config?.name ? `Hasil Eksekusi: ${config.name}` : `Hasil Eksekusi Job`}
        subtitle={`Job ID: ${job.id}`}
      />

      <div className="p-8 space-y-6 max-w-6xl mx-auto">
        <Link to="/jobs" className="btn-ghost btn-sm text-gray-400 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Jobs</span>
        </Link>

        {/* Header Card */}
        <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-850 border-surface-700">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-base font-bold text-white">
                {config?.name || `Job ${job.id.substring(0, 8)}...`}
              </span>
              {getStatusBadge(job.status)}
            </div>
            <p className="text-xs text-gray-400">
              Konfigurasi: <span className="font-semibold text-brand-300">{config?.name || job.config_id}</span>
              <span className="text-gray-500 font-mono ml-2">(Job ID: {job.id})</span>
            </p>
          </div>

          <div className="flex flex-col md:items-end gap-2.5">
            {/* Result / Refresh Button (Alone on top) */}
            <div className="flex justify-end w-full">
              <button onClick={() => fetchJobDetail(false)} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Result</span>
              </button>
            </div>

            {/* 1 Single Row for 3 Download Buttons */}
            {flattenedRows.length > 0 && (
              <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap overflow-x-auto">
                <button onClick={exportExcel} className="btn-primary bg-emerald-800 hover:bg-emerald-600 text-xs flex items-center gap-1.5 px-3 py-1.5 shrink-0">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download Excel (.xlsx)</span>
                </button>
                <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 shrink-0">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button onClick={copyResults} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 shrink-0">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Download JSON</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Timestamps & Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4 text-xs space-y-1 bg-surface-800/80">
            <span className="text-gray-500">Worker Executed</span>
            <p className="font-mono text-gray-200 font-semibold">{job.worker_name || 'python_worker'}</p>
          </div>
          <div className="card p-4 text-xs space-y-1 bg-surface-800/80">
            <span className="text-gray-500">Total Baris Hasil</span>
            <p className="font-mono text-teal-300 font-bold text-sm">{flattenedRows.length} Data Extracted</p>
          </div>
          <div className="card p-4 text-xs space-y-1 bg-surface-800/80">
            <span className="text-gray-500">Waktu Mulai</span>
            <p className="text-gray-200 font-semibold">{job.started_at ? new Date(job.started_at).toLocaleString('id-ID') : '-'}</p>
          </div>
          <div className="card p-4 text-xs space-y-1 bg-surface-800/80">
            <span className="text-gray-500">Waktu Selesai</span>
            <p className="text-gray-200 font-semibold">{job.finished_at ? new Date(job.finished_at).toLocaleString('id-ID') : '-'}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-surface-700 space-x-6">
          <button
            onClick={() => setActiveTab('results')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'results'
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Results</span>
            {flattenedRows.length > 0 && (
              <span className="bg-brand-500/20 text-brand-300 text-[11px] px-2 py-0.5 rounded-full font-mono">
                {flattenedRows.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Terminal Process</span>
            {job.logs && job.logs.length > 0 && (
              <span className="bg-surface-700 text-gray-300 text-[11px] px-2 py-0.5 rounded-full font-mono">
                {job.logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content: Results */}
        {activeTab === 'results' && (
          <div className="card p-5 space-y-4 border-surface-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span>Data Ekstraksi</span>
                </h3>
              </div>

              {flattenedRows.length > 0 && (
                <div className="flex items-center gap-1 bg-surface-900 p-1 rounded-xl border border-surface-700 text-xs">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors ${
                      viewMode === 'table' ? 'bg-brand-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Tabel HTML</span>
                  </button>
                  <button
                    onClick={() => setViewMode('json')}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors ${
                      viewMode === 'json' ? 'bg-brand-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Raw JSON</span>
                  </button>
                </div>
              )}
            </div>

            {flattenedRows.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-500 bg-surface-900 rounded-xl border border-surface-800 space-y-2">
                <Database className="w-8 h-8 mx-auto text-gray-600" />
                <p className="font-semibold text-gray-400">Belum ada data hasil scraping</p>
                <p>Jika job masih dalam status <span className="text-amber-400 font-mono">running</span>, halaman ini akan otomatis diperbarui.</p>
              </div>
            ) : viewMode === 'table' ? (
              <div className="card overflow-hidden border-surface-800">
                <div className="table-wrap max-h-[500px]">
                  <table className="table">
                    <thead className="sticky top-0 bg-surface-850 z-10">
                      <tr>
                        <th className="w-12 text-center">#</th>
                        {tableColumns.map((col) => (
                          <th key={col} className="capitalize text-brand-300">{col.replace(/_/g, ' ')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {flattenedRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-800/50">
                          <td className="text-center font-mono text-xs text-gray-500">{idx + 1}</td>
                          {tableColumns.map((col) => {
                            const val = row[col]
                            const cellStr = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')
                            const isUrl = cellStr.startsWith('http://') || cellStr.startsWith('https://')

                            if (col === 'extraction_status') {
                              let badgeStyle = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              if (cellStr.includes('headless')) {
                                badgeStyle = 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              } else if (cellStr.includes('fallback') || cellStr.includes('snippet')) {
                                badgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }
                              return (
                                <td key={col} className="text-xs max-w-xs">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${badgeStyle}`}>
                                    {cellStr}
                                  </span>
                                </td>
                              )
                            }

                            if (col === 'is_fallback') {
                              return (
                                <td key={col} className="text-xs max-w-xs">
                                  {val ? (
                                    <span className="text-amber-400 font-mono text-[11px]">Fallback Snippet</span>
                                  ) : (
                                    <span className="text-emerald-400 font-mono text-[11px]">Full Text</span>
                                  )}
                                </td>
                              )
                            }

                            return (
                              <td key={col} className="text-xs text-gray-200 max-w-xs truncate">
                                {isUrl ? (
                                  <a href={cellStr} target="_blank" rel="noreferrer" className="text-teal-400 underline hover:text-teal-300 truncate block">
                                    {cellStr}
                                  </a>
                                ) : (
                                  <span title={cellStr}>{cellStr}</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {job.results?.map((res) => (
                  <pre
                    key={res.id}
                    className="bg-surface-950 p-4 rounded-xl text-xs font-mono text-emerald-300 border border-surface-800 overflow-x-auto max-h-96"
                  >
                    {JSON.stringify(res.result_json, null, 2)}
                  </pre>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Logs */}
        {activeTab === 'logs' && (
          <div className="card p-5 space-y-3 border-surface-700">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-brand-300 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                <span>Log Eksekusi Subprocess Python (Debugging & Audit)</span>
              </h3>
              <span className="text-xs text-gray-400">Diperlukan untuk analisa pesan kesalahan saat job failed</span>
            </div>

            {!job.logs || job.logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 bg-surface-900 rounded-xl border border-surface-800">
                Tidak ada catatan log eksekusi untuk job ini.
              </div>
            ) : (
              <div className="bg-surface-950 p-4 rounded-xl border border-surface-800 font-mono text-xs space-y-2 max-h-96 overflow-y-auto">
                {job.logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 border-b border-surface-900/60 pb-1.5">
                    <span className="text-gray-500 shrink-0 text-[11px]">
                      [{new Date(log.created_at).toLocaleTimeString()}]
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        log.level === 'ERROR'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : log.level === 'WARN'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span
                      className={`break-all ${
                        log.level === 'ERROR'
                          ? 'text-red-300 font-semibold'
                          : log.level === 'WARN'
                          ? 'text-amber-300'
                          : 'text-gray-300'
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
