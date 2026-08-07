import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { jobsApi } from '../api/jobs'
import type { ScrapingJob } from '../types'
import {
  ArrowLeft, CheckCircle2, XCircle, PlayCircle, Clock,
  Terminal, FileText, Database, Copy, Check, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<ScrapingJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchJobDetail = async () => {
    if (!id) return
    try {
      const res = await jobsApi.getById(id)
      setJob(res)
    } catch (err: any) {
      toast.error('Gagal mengambil detail job')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobDetail()
    // Auto-poll if job is pending or running
    const interval = setInterval(() => {
      if (job?.status === 'pending' || job?.status === 'running') {
        fetchJobDetail()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [id, job?.status])

  const copyResults = () => {
    if (!job?.results) return
    const str = JSON.stringify(job.results.map((r) => r.result_json), null, 2)
    navigator.clipboard.writeText(str)
    setCopied(true)
    toast.success('Hasil JSON berhasil disalin!')
    setTimeout(() => setCopied(false), 2000)
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
        <Header title="Detail Execution Job" />
        <div className="p-8 max-w-5xl mx-auto space-y-4">
          <div className="h-48 skeleton" />
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div>
        <Header title="Detail Execution Job" />
        <div className="p-8 text-center text-gray-400">Job tidak ditemukan.</div>
      </div>
    )
  }

  return (
    <div>
      <Header title={`Job Execution`} subtitle={`ID: ${job.id}`} />

      <div className="p-8 space-y-6 max-w-6xl mx-auto">
        <Link to="/jobs" className="btn-ghost btn-sm text-gray-400 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Jobs</span>
        </Link>

        {/* Header Card */}
        <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-850">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-base font-bold text-white">Job {job.id.substring(0, 13)}...</span>
              {getStatusBadge(job.status)}
            </div>
            <p className="text-xs text-gray-400">Config ID: <span className="font-mono text-brand-300">{job.config_id}</span></p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={fetchJobDetail} className="btn-secondary text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            {job.results && job.results.length > 0 && (
              <button onClick={copyResults} className="btn-primary text-xs">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Salin JSON Output</span>
              </button>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 text-xs space-y-1">
            <span className="text-gray-500">Worker Executed</span>
            <p className="font-mono text-gray-200 font-semibold">{job.worker_name || 'python_worker'}</p>
          </div>
          <div className="card p-4 text-xs space-y-1">
            <span className="text-gray-500">Waktu Mulai</span>
            <p className="text-gray-200 font-semibold">{job.started_at ? new Date(job.started_at).toLocaleString('id-ID') : '-'}</p>
          </div>
          <div className="card p-4 text-xs space-y-1">
            <span className="text-gray-500">Waktu Selesai</span>
            <p className="text-gray-200 font-semibold">{job.finished_at ? new Date(job.finished_at).toLocaleString('id-ID') : '-'}</p>
          </div>
        </div>

        {/* Results JSON Box */}
        <div className="card p-5 space-y-3 border-surface-700">
          <h3 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span>Hasil Scraping (JSON Result)</span>
          </h3>

          {!job.results || job.results.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500 bg-surface-900 rounded-xl border border-surface-800">
              Belum ada hasil scraping yang tersimpan untuk job ini.
            </div>
          ) : (
            <div className="space-y-3">
              {job.results.map((res) => (
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

        {/* Execution Logs Terminal */}
        <div className="card p-5 space-y-3 border-surface-700">
          <h3 className="text-xs font-bold text-brand-300 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span>Log Eksekusi Subprocess</span>
          </h3>

          {!job.logs || job.logs.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500 bg-surface-900 rounded-xl border border-surface-800">
              Tidak ada catat log eksekusi.
            </div>
          ) : (
            <div className="bg-surface-950 p-4 rounded-xl border border-surface-800 font-mono text-xs space-y-1.5 max-h-60 overflow-y-auto">
              {job.logs.map((log) => (
                <div key={log.id} className="flex gap-3">
                  <span className="text-gray-500 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                  <span
                    className={
                      log.level === 'ERROR'
                        ? 'text-red-400 font-semibold'
                        : log.level === 'WARN'
                        ? 'text-amber-400'
                        : 'text-gray-300'
                    }
                  >
                    [{log.level}] {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
