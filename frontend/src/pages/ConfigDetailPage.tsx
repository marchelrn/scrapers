import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { configsApi } from '../api/configs'
import { schedulesApi } from '../api/schedules'
import type { ScrapingConfig, Schedule } from '../types'
import {
  ArrowLeft, Play, CheckCircle2, XCircle, Code2, Edit3,
  Calendar, CalendarX, Loader2, Repeat, Timer
} from 'lucide-react'
import { UpdateConfigModal } from '../components/shared/UpdateConfigModal'
import { LowCodeSchedulePicker, describeSchedule } from '../components/shared/LowCodeSchedulePicker'
import toast from 'react-hot-toast'

export function ConfigDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [config, setConfig] = useState<ScrapingConfig | null>(null)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [cronExpression, setCronExpression] = useState('0 0 * * *')
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Makassar')
  const [scheduleRunOnce, setScheduleRunOnce] = useState(false)
  const [submittingSchedule, setSubmittingSchedule] = useState(false)

  const fetchConfigAndSchedule = async () => {
    if (!id) return
    try {
      const [cfg, schs] = await Promise.all([
        configsApi.getById(id),
        schedulesApi.getAll().catch(() => []),
      ])
      setConfig(cfg)
      const foundSch = (schs || []).find((s) => s.config_id === id) || null
      setSchedule(foundSch)
      if (foundSch) {
        setCronExpression(foundSch.cron_expression)
        setScheduleTimezone(foundSch.timezone || 'Asia/Makassar')
        setScheduleRunOnce(foundSch.run_once)
      }
    } catch {
      toast.error('Gagal memuat detail konfigurasi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfigAndSchedule()
  }, [id])

  const handleRun = async () => {
    if (!id) return
    try {
      const job = await configsApi.run(id)
      toast.success('Job scraping telah diantrekan!')
      navigate(`/jobs/${job.id}`)
    } catch {
      toast.error('Gagal menjalankan job')
    }
  }

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSubmittingSchedule(true)
    try {
      if (schedule) {
        await schedulesApi.update(schedule.id, {
          cron_expression: cronExpression,
          timezone: scheduleTimezone,
          enabled: true,
          run_once: scheduleRunOnce,
        })
      } else {
        await schedulesApi.create({
          config_id: id,
          cron_expression: cronExpression,
          timezone: scheduleTimezone,
          enabled: true,
          run_once: scheduleRunOnce,
        })
      }
      toast.success('Jadwal scraping berhasil disimpan!')
      setShowScheduleModal(false)
      fetchConfigAndSchedule()
    } catch {
      toast.error('Gagal menyimpan jadwal')
    } finally {
      setSubmittingSchedule(false)
    }
  }

  const handleUnassignSchedule = async () => {
    if (!schedule) return
    const confirmed = confirm(
      config?.name
        ? `Apakah Anda yakin ingin membatalkan/unassign jadwal otomatis untuk konfigurasi "${config.name}"?`
        : 'Apakah Anda yakin ingin membatalkan/unassign jadwal otomatis ini?'
    )
    if (!confirmed) return

    setSubmittingSchedule(true)
    try {
      await schedulesApi.delete(schedule.id)
      toast.success('Jadwal scheduler berhasil di-unassign / dihapus')
      setShowScheduleModal(false)
      fetchConfigAndSchedule()
    } catch {
      toast.error('Gagal membatalkan jadwal')
    } finally {
      setSubmittingSchedule(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Detail Konfigurasi" />
        <div className="p-8 max-w-4xl mx-auto space-y-4">
          <div className="h-40 skeleton" />
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div>
        <Header title="Detail Konfigurasi" />
        <div className="p-8 text-center text-gray-400">Konfigurasi tidak ditemukan.</div>
      </div>
    )
  }

  return (
    <div>
      <Header title={`Config: ${config.name}`} subtitle={`ID: ${config.id}`} />

      <div className="p-8 space-y-6 max-w-5xl mx-auto">
        <Link to="/configs" className="btn-ghost btn-sm text-gray-400 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Konfigurasi</span>
        </Link>

        {/* Action Header Card */}
        <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-850">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{config.name}</h2>
              {config.status === 'active' ? (
                <span className="badge-success"><CheckCircle2 className="w-3 h-3" /> Active</span>
              ) : (
                <span className="badge-neutral"><XCircle className="w-3 h-3" /> Inactive</span>
              )}
            </div>
            {config.description && <p className="text-xs text-gray-400 mt-1">{config.description}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpdateModal(true)} className="btn-secondary text-xs py-2.5">
              <Edit3 className="w-4 h-4 text-brand-300" />
              <span>Update Konfigurasi</span>
            </button>
            <button onClick={handleRun} className="btn-primary text-xs py-2.5">
              <Play className="w-4 h-4" />
              <span>Jalankan Sekarang</span>
            </button>
          </div>
        </div>

        {/* Grid Parameters & Meta */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-5 space-y-4 md:col-span-1 border-surface-700">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Metadata Konfigurasi</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-500 block">Kode Metode</span>
                <span className="font-mono text-brand-300 font-semibold">{config.method_code}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Status Jadwal Otomatis</span>
                {schedule ? (
                  <div className="mt-1 space-y-1.5 p-2.5 rounded-lg bg-surface-900 border border-surface-750">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold flex items-center gap-1 text-[11px] ${schedule.enabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <Calendar className="w-3 h-3" />
                        <span>
                          {schedule.enabled
                            ? 'Terjadwal (Aktif)'
                            : schedule.run_once && schedule.last_run
                            ? 'Terjadwal (Selesai)'
                            : 'Terjadwal (Nonaktif)'}
                        </span>
                      </span>
                      {schedule.run_once ? (
                        <span className="badge-warning text-[10px] px-2 py-0 whitespace-nowrap"><Timer className="w-3 h-3" /> Sekali</span>
                      ) : (
                        <span className="badge-info text-[10px] px-2 py-0 whitespace-nowrap"><Repeat className="w-3 h-3" /> Berulang</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-300">
                      {describeSchedule(
                        schedule.cron_expression,
                        schedule.timezone || 'Asia/Makassar',
                        schedule.run_once,
                        schedule.last_run
                      )}
                    </p>
                    <p className="font-mono text-[10px] text-gray-400">
                      {schedule.cron_expression} ({schedule.timezone || 'Asia/Makassar'})
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setShowScheduleModal(true)}
                        className="btn-secondary btn-sm text-[11px] py-1 px-2 flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Ubah</span>
                      </button>
                      <button
                        onClick={handleUnassignSchedule}
                        className="btn-danger btn-sm text-[11px] py-1 px-2 flex items-center gap-1"
                      >
                        <CalendarX className="w-3 h-3" />
                        <span>Unassign</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-gray-400">Belum Ada Jadwal</span>
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      className="btn-secondary btn-sm text-[11px] py-1 px-2.5 flex items-center gap-1"
                    >
                      <Calendar className="w-3 h-3" />
                      <span>Atur Jadwal</span>
                    </button>
                  </div>
                )}
              </div>
              <div>
                <span className="text-gray-500 block">Pembuat</span>
                <span className="text-gray-300 font-mono">{config.created_by || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Tanggal Dibuat</span>
                <span className="text-gray-300">{new Date(config.created_at).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4 md:col-span-2 border-surface-700">
            <h3 className="text-xs font-bold text-brand-300 uppercase tracking-wider flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              <span>Daftar Parameter (JSONB)</span>
            </h3>

            <div className="space-y-3">
              {config.parameters?.map((p) => (
                <div key={p.id} className="p-3.5 rounded-xl bg-surface-900 border border-surface-700 space-y-1">
                  <span className="text-xs font-mono font-semibold text-teal-300">{p.parameter_name}</span>
                  <pre className="text-xs font-mono text-gray-300 bg-surface-950 p-2.5 rounded-lg border border-surface-800 overflow-x-auto">
                    {JSON.stringify(p.parameter_value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-700 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{schedule ? 'Edit / Unassign Jadwal Scraping' : 'Atur Jadwal Scraping Otomatis'}</span>
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="btn-ghost btn-sm text-gray-400">
                Batal
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <p className="text-gray-400">
                Konfigurasi: <span className="text-white font-semibold">{config.name}</span>
              </p>
              {schedule && (
                <p className="text-emerald-400 flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  <span>Jadwal saat ini terpasang ({schedule.enabled ? 'Status: Aktif' : 'Status: Nonaktif'})</span>
                </p>
              )}
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <LowCodeSchedulePicker
                initialCron={cronExpression}
                initialTimezone={scheduleTimezone}
                initialRunOnce={scheduleRunOnce}
                onChange={(newCron, newTz, newRunOnce) => {
                  setCronExpression(newCron)
                  setScheduleTimezone(newTz)
                  setScheduleRunOnce(newRunOnce)
                }}
              />

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submittingSchedule}
                  className="btn-primary flex-1 justify-center py-2.5 text-xs font-semibold"
                >
                  {submittingSchedule ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : schedule ? (
                    'Simpan Perubahan Jadwal'
                  ) : (
                    'Simpan Jadwal Scraping'
                  )}
                </button>

                {schedule && (
                  <button
                    type="button"
                    disabled={submittingSchedule}
                    onClick={handleUnassignSchedule}
                    className="btn-danger flex-1 justify-center py-2.5 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <CalendarX className="w-4 h-4" />
                    <span>Unassign / Hapus Jadwal</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <UpdateConfigModal
        config={config}
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onSuccess={() => {
          fetchConfigAndSchedule()
        }}
      />
    </div>
  )
}
