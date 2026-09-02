import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { schedulesApi } from '../api/schedules'
import { configsApi } from '../api/configs'
import type { Schedule, ScrapingConfig } from '../types'
import { LowCodeSchedulePicker, describeSchedule } from '../components/shared/LowCodeSchedulePicker'
import {
  Plus, Trash2, CheckCircle2, XCircle, Loader2, Repeat, Timer,
  Search, RefreshCw, Play, Edit3, Calendar, Clock, Check
} from 'lucide-react'
import toast from 'react-hot-toast'

type FilterStatus = 'all' | 'enabled' | 'disabled' | 'run_once' | 'recurring'

export function SchedulesPage() {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [configs, setConfigs] = useState<ScrapingConfig[]>([])
  const [loading, setLoading] = useState(true)

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [submittingCreate, setSubmittingCreate] = useState(false)
  const [createConfigId, setCreateConfigId] = useState('')
  const [createCron, setCreateCron] = useState('0 0 * * *')
  const [createTz, setCreateTz] = useState('Asia/Makassar')
  const [createEnabled, setCreateEnabled] = useState(true)
  const [createRunOnce, setCreateRunOnce] = useState(false)

  // Edit Modal State
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [editCron, setEditCron] = useState('0 0 * * *')
  const [editTz, setEditTz] = useState('Asia/Makassar')
  const [editEnabled, setEditEnabled] = useState(true)
  const [editRunOnce, setEditRunOnce] = useState(false)

  // Running job loading state
  const [triggeringJobId, setTriggeringJobId] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [schRes, cfgRes] = await Promise.all([
        schedulesApi.getAll(),
        configsApi.getAll(),
      ])
      setSchedules(schRes || [])
      setConfigs(cfgRes || [])
      if (cfgRes && cfgRes.length > 0 && !createConfigId) {
        setCreateConfigId(cfgRes[0].id)
      }
    } catch {
      toast.error('Gagal mengambil data jadwal')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Handle Create Schedule
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createConfigId) {
      toast.error('Pilih konfigurasi target terlebih dahulu')
      return
    }
    setSubmittingCreate(true)
    try {
      await schedulesApi.create({
        config_id: createConfigId,
        cron_expression: createCron,
        timezone: createTz,
        enabled: createEnabled,
        run_once: createRunOnce,
      })
      toast.success('Jadwal baru berhasil ditambahkan!')
      setShowCreateModal(false)
      fetchData()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal menambahkan jadwal'
      toast.error(msg)
    } finally {
      setSubmittingCreate(false)
    }
  }

  // Handle Open Edit Modal
  const handleOpenEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setEditCron(schedule.cron_expression)
    setEditTz(schedule.timezone || 'Asia/Makassar')
    setEditEnabled(schedule.enabled)
    setEditRunOnce(schedule.run_once)
  }

  // Handle Update Schedule
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSchedule) return
    setSubmittingEdit(true)
    try {
      await schedulesApi.update(editingSchedule.id, {
        cron_expression: editCron,
        timezone: editTz,
        enabled: editEnabled,
        run_once: editRunOnce,
      })
      toast.success(`Jadwal #${editingSchedule.id} berhasil diperbarui!`)
      setEditingSchedule(null)
      fetchData()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal memperbarui jadwal'
      toast.error(msg)
    } finally {
      setSubmittingEdit(false)
    }
  }

  // Toggle Enable/Disable
  const handleToggle = async (schedule: Schedule) => {
    try {
      await schedulesApi.update(schedule.id, { enabled: !schedule.enabled })
      toast.success(`Jadwal #${schedule.id} ${!schedule.enabled ? 'diaktifkan' : 'dinonaktifkan'}`)
      fetchData()
    } catch {
      toast.error('Gagal mengedit status jadwal')
    }
  }

  // Handle Delete Schedule
  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal otomatis ini?')) return
    try {
      await schedulesApi.delete(id)
      toast.success('Jadwal berhasil dihapus')
      setSchedules((prev) => prev.filter((s) => s.id !== id))
    } catch {
      toast.error('Gagal menghapus jadwal')
    }
  }

  // Handle Trigger Job Manually
  const handleRunNow = async (configId: string) => {
    setTriggeringJobId(configId)
    try {
      const job = await configsApi.run(configId)
      toast.success('Job scraping berhasil dipicu!')
      navigate(`/jobs/${job.id}`)
    } catch {
      toast.error('Gagal memicu job scraping')
    } finally {
      setTriggeringJobId(null)
    }
  }

  // Helpers
  const isSpentRunOnce = (s: Schedule) => !s.enabled && s.run_once && !!s.last_run

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime()) || d.getFullYear() < 2000) return '-'
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Stats calculation
  const stats = useMemo(() => {
    const total = schedules.length
    const active = schedules.filter((s) => s.enabled).length
    const runOnceCount = schedules.filter((s) => s.run_once).length
    const inactive = schedules.filter((s) => !s.enabled).length
    const repeatCount = schedules.filter((s) => !s.run_once).length
    return { total, active, runOnceCount, inactive , repeatCount}
  }, [schedules])

  // Filter & Search Logic
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const cfg = configs.find((c) => c.id === s.config_id)
      const configName = cfg?.name?.toLowerCase() || ''
      const methodCode = cfg?.method_code?.toLowerCase() || ''
      const cronExpr = s.cron_expression.toLowerCase()
      const query = searchQuery.toLowerCase().trim()

      const matchSearch =
        !query ||
        configName.includes(query) ||
        methodCode.includes(query) ||
        cronExpr.includes(query) ||
        String(s.id).includes(query)

      if (!matchSearch) return false

      if (filterStatus === 'enabled') return s.enabled
      if (filterStatus === 'disabled') return !s.enabled
      if (filterStatus === 'run_once') return s.run_once
      if (filterStatus === 'recurring') return !s.run_once

      return true
    })
  }, [schedules, configs, searchQuery, filterStatus])

  return (
    <div className="min-h-screen pb-12">
      <Header
        title="Jadwal Eksekusi"
        subtitle="Otomasi & Penjadwalan Scraping BPS Terjadwal (Cron Engine)"
      />

      <div className="p-8 space-y-6 max-w-7xl mx-auto">

        {/* Toolbar: Search, Filters, & Add Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search & Filter Group */}
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari target konfigurasi atau CRON..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-11 text-xs py-2 bg-surface-850 border-surface-700 focus:border-brand-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-850 border border-surface-700 text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterStatus === 'all'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700/50'
                }`}
              >
                Semua ({schedules.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('enabled')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterStatus === 'enabled'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700/50'
                }`}
              >
                Aktif ({stats.active})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('run_once')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterStatus === 'run_once'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700/50'
                }`}
              >
                Sekali Jalan ({stats.runOnceCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('recurring')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterStatus === 'recurring'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700/50'
                }`}
              >
                Berulang ({stats.repeatCount})
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              title="Segarkan data jadwal"
              className="btn-secondary text-xs px-3 py-2 bg-surface-850 border-surface-700 hover:bg-surface-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>

            <button
              onClick={() => {
                if (configs.length > 0 && !createConfigId) {
                  setCreateConfigId(configs[0].id)
                }
                setShowCreateModal(true)
              }}
              className="btn-primary text-xs py-2 px-4 shadow-lg shadow-brand-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jadwal Baru</span>
            </button>
          </div>
        </div>

        {/* Schedules Table */}
        <div className="card overflow-hidden border-surface-700/80 bg-surface-900/90 shadow-xl">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr className="bg-surface-950/70 border-b border-surface-700/80">
                  <th className="py-3.5 px-4 font-semibold text-gray-300 w-[24%]">Target Konfigurasi</th>
                  <th className="py-3.5 px-4 font-semibold text-gray-300">Frekuensi & Pola Jadwal</th>
                  <th className="py-3.5 px-4 font-semibold text-gray-300 whitespace-nowrap w-[22%]">Waktu Eksekusi</th>
                  <th className="py-3.5 px-4 font-semibold text-gray-300 text-center whitespace-nowrap w-[10%]">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-gray-300 text-center whitespace-nowrap w-[12%]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/40">
                {loading ? (
                  // Skeleton Loading Rows
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div className="h-4 bg-surface-800 rounded w-3/4" />
                          <div className="h-3 bg-surface-800/60 rounded w-1/2" />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div className="h-4 bg-surface-800 rounded w-5/6" />
                          <div className="h-3 bg-surface-800/60 rounded w-1/3" />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div className="h-3.5 bg-surface-800 rounded w-2/3" />
                          <div className="h-3.5 bg-surface-800/60 rounded w-1/2" />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="h-6 bg-surface-800 rounded-full w-20 mx-auto" />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="h-7 bg-surface-800 rounded-lg w-24 mx-auto" />
                      </td>
                    </tr>
                  ))
                ) : filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 px-4">
                      <div className="max-w-sm mx-auto flex flex-col items-center justify-center text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center text-gray-500">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-300">
                            {searchQuery || filterStatus !== 'all'
                              ? 'Tidak ada jadwal yang cocok'
                              : 'Belum ada jadwal otomatis'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {searchQuery || filterStatus !== 'all'
                              ? 'Coba ubah kata kunci pencarian atau filter status jadwal.'
                              : 'Mulai buat otomasi jadwal untuk menjalankan konfigurasi scraping secara berkala.'}
                          </p>
                        </div>
                        {(!searchQuery && filterStatus === 'all') && (
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn-primary text-xs py-2 px-3 mt-2"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Buat Jadwal Pertama</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((s) => {
                    const cfg = configs.find((c) => c.id === s.config_id)
                    const spent = isSpentRunOnce(s)

                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-surface-800/40 transition-colors group"
                      >
                        {/* Target Konfigurasi */}
                        <td className="px-4 py-3.5 align-middle">
                          <div className="space-y-1">
                            {cfg ? (
                              <Link
                                to={`/configs/${cfg.id}`}
                                className="text-xs font-bold text-white hover:text-brand-300 transition-colors line-clamp-1 block"
                                title={cfg.name}
                              >
                                {cfg.name}
                              </Link>
                            ) : (
                              <p className="text-xs font-semibold text-gray-400 italic">
                                Konfigurasi Terhapus
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Frekuensi & Pola Jadwal */}
                        <td className="px-4 py-3.5 align-middle">
                          <div className="space-y-1.5">
                            <p
                              className={`text-xs font-semibold leading-snug ${
                                s.run_once
                              }`}
                            >
                              {describeSchedule(
                                s.cron_expression,
                                s.timezone || 'Asia/Makassar',
                                s.run_once,
                                s.last_run
                              )}
                            </p>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Pattern Badge */}
                              {s.run_once ? (
                                <span className="badge-warning font-medium text-[10px] py-0.5 px-2">
                                  <Timer className="w-3 h-3" />
                                </span>
                              ) : (
                                <span className="badge-info font-medium text-[10px] py-0.5 px-2">
                                  <Repeat className="w-3 h-3" />
                                </span>
                              )}

                            </div>
                          </div>
                        </td>

                        {/* Waktu Eksekusi (Next & Last Run) */}
                        <td className="px-4 py-3.5 align-middle text-xs whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-gray-300 font-mono text-[11px]">
                              <Clock className="w-3 h-3 text-white shrink-0" />
                              <span className="text-gray-400 font-sans text-[11px]">Berikutnya:</span>
                              <span className={s.enabled ? 'text-white font-medium' : 'text-gray-500'}>
                                {s.enabled ? formatDate(s.next_run) : '-'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px]">
                              <Calendar className="w-3 h-3 text-gray-500 shrink-0" />
                              <span className="text-gray-400 font-sans text-[11px]">Terakhir:</span>
                              <span className="text-gray-300">{formatDate(s.last_run)}</span>
                            </div>
                          </div>
                        </td>

                        {/* Status Toggle */}
                        <td className="px-4 py-3.5 align-middle text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(s)}
                            className="cursor-pointer inline-flex transition-transform active:scale-95"
                            title={
                              s.enabled
                                ? 'Jadwal Aktif. Klik untuk menonaktifkan'
                                : spent
                                ? 'Sudah dieksekusi sekali (selesai). Klik untuk mengaktifkan kembali'
                                : 'Jadwal Nonaktif. Klik untuk mengaktifkan'
                            }
                          >
                            {s.enabled ? (
                              <span className="badge-success text-xs py-1 px-2.5 shadow-sm shadow-emerald-950/40">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aktif</span>
                              </span>
                            ) : spent ? (
                              <span className="badge-info text-xs py-1 px-2.5">
                                <Check className="w-3.5 h-3.5" />
                                <span>Selesai</span>
                              </span>
                            ) : (
                              <span className="badge-neutral text-xs py-1 px-2.5 opacity-80 hover:opacity-100">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Nonaktif</span>
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Aksi */}
                        <td className="px-4 py-3.5 align-middle text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {/* Run Now Button */}
                            <button
                              type="button"
                              onClick={() => handleRunNow(s.config_id)}
                              disabled={triggeringJobId === s.config_id}
                              title="Jalankan Job sekarang (manual trigger)"
                              className="btn-primary btn-sm px-2 py-1.5 bg-brand-600 hover:bg-brand-500 border-brand-500 text-white"
                            >
                              {triggeringJobId === s.config_id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(s)}
                              title="Edit Jadwal"
                              className="btn-secondary btn-sm px-2 py-1.5 text-brand-300 border-surface-600 hover:bg-surface-700"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDelete(s.id)}
                              title="Hapus Jadwal"
                              className="btn-danger btn-sm px-2 py-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Create Schedule */}
      {showCreateModal && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Tambah Jadwal Scraping Otomatis</h3>
                  <p className="text-[11px] text-gray-400">Atur frekuensi dan waktu eksekusi berkala</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-ghost btn-sm text-gray-400 hover:text-white"
              >
                Batal
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="form-group">
                <label className="label text-xs font-semibold text-gray-300">
                  Pilih Target Konfigurasi Scraping <span className="text-red-400">*</span>
                </label>
                <select
                  value={createConfigId}
                  onChange={(e) => setCreateConfigId(e.target.value)}
                  className="input font-semibold text-brand-300 text-xs"
                  required
                >
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.method_code})
                    </option>
                  ))}
                </select>
              </div>

              <LowCodeSchedulePicker
                initialCron={createCron}
                initialTimezone={createTz}
                initialRunOnce={createRunOnce}
                onChange={(newCron, newTz, newRunOnce) => {
                  setCreateCron(newCron)
                  setCreateTz(newTz)
                  setCreateRunOnce(newRunOnce)
                }}
              />

              <div className="flex items-center gap-2 pt-2 border-t border-surface-700/60">
                <input
                  type="checkbox"
                  id="enabledCheck"
                  checked={createEnabled}
                  onChange={(e) => setCreateEnabled(e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                />
                <label htmlFor="enabledCheck" className="text-xs text-gray-300 cursor-pointer font-medium select-none">
                  Langsung Aktifkan Jadwal Ini Sekarang
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingCreate}
                className="btn-primary w-full justify-center py-2.5 text-xs font-semibold mt-4 shadow-lg shadow-brand-900/30"
              >
                {submittingCreate ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan & Daftarkan Jadwal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Schedule */}
      {editingSchedule && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-700 pb-3">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Jadwal Scraping #{editingSchedule.id}</h3>
                  <p className="text-[11px] text-gray-400">
                    Target: <span className="text-white font-medium">
                      {configs.find((c) => c.id === editingSchedule.config_id)?.name || editingSchedule.config_id}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingSchedule(null)}
                className="btn-ghost btn-sm text-gray-400 hover:text-white"
              >
                Batal
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <LowCodeSchedulePicker
                initialCron={editCron}
                initialTimezone={editTz}
                initialRunOnce={editRunOnce}
                onChange={(newCron, newTz, newRunOnce) => {
                  setEditCron(newCron)
                  setEditTz(newTz)
                  setEditRunOnce(newRunOnce)
                }}
              />

              <div className="flex items-center gap-2 pt-2 border-t border-surface-700/60">
                <input
                  type="checkbox"
                  id="editEnabledCheck"
                  checked={editEnabled}
                  onChange={(e) => setEditEnabled(e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                />
                <label htmlFor="editEnabledCheck" className="text-xs text-gray-300 cursor-pointer font-medium select-none">
                  Status Jadwal Aktif
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingEdit}
                className="btn-primary w-full justify-center py-2.5 text-xs font-semibold mt-4 shadow-lg shadow-brand-900/30"
              >
                {submittingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Perbarui Jadwal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
