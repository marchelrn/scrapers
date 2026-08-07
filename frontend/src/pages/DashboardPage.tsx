import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { dashboardApi } from '../api/dashboard'
import { jobsApi } from '../api/jobs'
import type { DashboardSummary, ScrapingJob } from '../types'
import {
  Activity, PlayCircle, CheckCircle2, XCircle, Clock,
  Cpu, Calendar, ArrowUpRight, RefreshCw
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recentJobs, setRecentJobs] = useState<ScrapingJob[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    try {
      const [sumRes, jobsRes] = await Promise.all([
        dashboardApi.getSummary(),
        jobsApi.getAll({ limit: 5 }),
      ])
      setSummary(sumRes)
      setRecentJobs(jobsRes || [])
    } catch (err: any) {
      toast.error('Gagal memuat data dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // auto-refresh 30s
    return () => clearInterval(interval)
  }, [])

  const handleManualRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

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
        title="Dashboard Scraping BPS"
        subtitle="Ringkasan performa worker, eksekusi job, dan status sistem secara real-time."
      />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Top actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Ringkasan Sistem</h2>
            <p className="text-xs text-gray-400">Data otomatis diperbarui setiap 30 detik</p>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="btn-secondary text-xs py-2 px-3"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Active Workers */}
            <div className="stat-card group hover:border-brand-500/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Workers</span>
                <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-300">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white">{summary?.active_workers ?? 0}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <Cpu className="w-3.5 h-3.5 text-gray-500" />
                <span>CPU Load: {summary?.worker_cpu ?? 0}%</span>
              </div>
            </div>

            {/* Running Jobs */}
            <div className="stat-card group hover:border-brand-500/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Running Jobs</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                  <PlayCircle className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white">{summary?.running_jobs ?? 0}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span>Queue: {summary?.queue ?? 0} jobs</span>
              </div>
            </div>

            {/* Successful Jobs */}
            <div className="stat-card group hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Berhasil</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-emerald-400">{summary?.successful_jobs ?? 0}</p>
              <span className="text-[11px] text-gray-400">Job selesai tanpa kendala</span>
            </div>

            {/* Failed Jobs */}
            <div className="stat-card group hover:border-red-500/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gagal</span>
                <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-300">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-red-400">{summary?.failed_jobs ?? 0}</p>
              <span className="text-[11px] text-gray-400">Job gagal saat diproses</span>
            </div>
          </div>
        )}

        {/* Schedule Timestamps Info */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4 flex items-center gap-4 bg-surface-800/60 border-surface-700">
              <div className="w-10 h-10 rounded-xl bg-surface-700 flex items-center justify-center text-brand-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Eksekusi Terakhir</p>
                <p className="text-sm font-bold text-gray-200">
                  {summary.last_execution ? new Date(summary.last_execution).toLocaleString('id-ID') : 'Belum pernah'}
                </p>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-4 bg-surface-800/60 border-surface-700">
              <div className="w-10 h-10 rounded-xl bg-surface-700 flex items-center justify-center text-teal-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Eksekusi Terjadwal Berikutnya</p>
                <p className="text-sm font-bold text-gray-200">
                  {summary.next_execution ? new Date(summary.next_execution).toLocaleString('id-ID') : 'Tidak ada jadwal aktif'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Jobs Table */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-surface-700 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Job Terbaru</h3>
              <p className="text-xs text-gray-400">5 riwayat eksekusi pekerjaan scraping terkini</p>
            </div>
            <Link to="/jobs" className="btn-ghost text-xs text-brand-400 hover:text-brand-300">
              <span>Lihat Semua</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID Job</th>
                  <th>Config ID</th>
                  <th>Worker</th>
                  <th>Status</th>
                  <th>Waktu Mulai</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 text-xs">
                      Belum ada riwayat job scraping.
                    </td>
                  </tr>
                ) : (
                  recentJobs.map((j) => (
                    <tr key={j.id}>
                      <td className="font-mono text-xs text-brand-300">{j.id.substring(0, 8)}...</td>
                      <td className="font-mono text-xs text-gray-400">{j.config_id.substring(0, 8)}...</td>
                      <td className="text-xs text-gray-300">{j.worker_name || 'Worker Python'}</td>
                      <td>{getStatusBadge(j.status)}</td>
                      <td className="text-xs text-gray-400">
                        {j.started_at ? new Date(j.started_at).toLocaleString('id-ID') : '-'}
                      </td>
                      <td>
                        <Link
                          to={`/jobs/${j.id}`}
                          className="btn-ghost btn-sm text-brand-400 hover:text-brand-300"
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
