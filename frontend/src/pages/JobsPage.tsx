import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { jobsApi } from '../api/jobs'
import { configsApi } from '../api/configs'
import type { ScrapingJob, ScrapingConfig } from '../types'
import {
  CheckCircle2, XCircle, PlayCircle, Clock,
  ChevronLeft, ChevronRight, RefreshCw, Eye
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

export function JobsPage() {
  const [jobs, setJobs] = useState<ScrapingJob[]>([])
  const [configs, setConfigs] = useState<ScrapingConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 10

  const fetchJobs = async (currentPage: number) => {
    setLoading(true)
    try {
      const [jobsRes, cfgsRes] = await Promise.all([
        jobsApi.getAll({ page: currentPage, limit }),
        configsApi.getAll().catch(() => []),
      ])
      setJobs(jobsRes || [])
      setConfigs(cfgsRes || [])
    } catch {
      toast.error('Gagal mengambil daftar pekerjaan (jobs)')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs(page)
  }, [page])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="badge-success"><CheckCircle2 className="w-3 h-3" /> Success</span>
      case 'failed':
        return <span className="badge-danger"><XCircle className="w-3 h-3" /> Failed</span>
      case 'running':
        return <span className="badge-running"><PlayCircle className="w-3 h-3" /> Running</span>
      default:
        return <span className="badge-warning"><Clock className="w-3 h-3" /> Pending</span>
    }
  }

  return (
    <div>
      <Header
        title="Riwayat Scraping Jobs"
        subtitle="Daftar eksekusi job scraping manual maupun otomatis dari scheduler."
      />

      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Daftar Pekerjaan (Jobs)</h2>
            <p className="text-xs text-gray-400">Menampilkan hingga {limit} item per halaman</p>
          </div>

          <button
            onClick={() => fetchJobs(page)}
            className="btn-secondary text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Konfigurasi</th>
                  <th>Job ID</th>
                  <th>Config ID</th>
                  <th>Worker Name</th>
                  <th>Status</th>
                  <th>Waktu Mulai</th>
                  <th>Waktu Selesai</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500 text-xs">
                      Memuat data jobs...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500 text-xs">
                      Belum ada pekerjaan yang dijalankan.
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => {
                    const config = configs.find((c) => c.id === j.config_id)
                    return (
                      <tr key={j.id}>
                        <td className="font-medium text-xs text-white">
                          {config?.name || 'Config Tanpa Nama'}
                        </td>
                        <td className="font-mono text-xs text-brand-300 font-medium">
                          {j.id.substring(0, 8)}...
                        </td>
                        <td className="font-mono text-xs text-gray-400">
                          {j.config_id.substring(0, 8)}...
                        </td>
                        <td className="text-xs text-gray-300">{j.worker_name || 'python_worker'}</td>
                        <td>{getStatusBadge(j.status)}</td>
                        <td className="text-xs text-gray-400">
                          {j.started_at ? new Date(j.started_at).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="text-xs text-gray-400">
                          {j.finished_at ? new Date(j.finished_at).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="text-right">
                          <Link
                            to={`/jobs/${j.id}`}
                            className="btn-ghost btn-sm text-brand-400 hover:text-brand-300 inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Hasil & Log</span>
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-surface-700 flex items-center justify-between bg-surface-850">
            <span className="text-xs text-gray-400">Halaman {page}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="btn-secondary btn-sm disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>
              <button
                disabled={jobs.length < limit}
                onClick={() => setPage(page + 1)}
                className="btn-secondary btn-sm disabled:opacity-40"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

