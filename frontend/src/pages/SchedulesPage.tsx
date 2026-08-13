import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { schedulesApi } from '../api/schedules'
import { configsApi } from '../api/configs'
import type { Schedule, ScrapingConfig } from '../types'
import { LowCodeSchedulePicker, cronToIndonesian } from '../components/shared/LowCodeSchedulePicker'
import {
  Plus, Trash2, CheckCircle2, XCircle, Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'

export function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [configs, setConfigs] = useState<ScrapingConfig[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [configId, setConfigId] = useState('')
  const [cronExpression, setCronExpression] = useState('0 0 * * *')
  const [timezone, setTimezone] = useState('Asia/Makassar')
  const [enabled, setEnabled] = useState(true)

  const fetchData = async () => {
    try {
      const [schRes, cfgRes] = await Promise.all([
        schedulesApi.getAll(),
        configsApi.getAll(),
      ])
      setSchedules(schRes || [])
      setConfigs(cfgRes || [])
      if (cfgRes && cfgRes.length > 0) {
        setConfigId(cfgRes[0].id)
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!configId) {
      toast.error('Pilih konfigurasi terlebih dahulu')
      return
    }
    setSubmitting(true)
    try {
      await schedulesApi.create({
        config_id: configId,
        cron_expression: cronExpression,
        timezone,
        enabled,
      })
      toast.success('Jadwal baru berhasil ditambahkan!')
      setShowModal(false)
      fetchData()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal menambahkan jadwal'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (schedule: Schedule) => {
    try {
      await schedulesApi.update(schedule.id, { enabled: !schedule.enabled })
      toast.success(`Jadwal #${schedule.id} ${!schedule.enabled ? 'diaktifkan' : 'dinonaktifkan'}`)
      fetchData()
    } catch {
      toast.error('Gagal mengedit status jadwal')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus jadwal otomatis ini?')) return
    try {
      await schedulesApi.delete(id)
      toast.success('Jadwal berhasil dihapus')
      setSchedules(schedules.filter((s) => s.id !== id))
    } catch {
      toast.error('Gagal menghapus jadwal')
    }
  }

  return (
    <div>
      <Header
        title="Jadwal Eksekusi Otomatis (Scheduler)"
      />

      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Daftar Jadwal Active</h2>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal Baru</span>
          </button>
        </div>

        {/* Schedules Table */}
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Target Konfigurasi</th>
                  <th>Deskripsi Jadwal</th>
                  <th>CRON</th>
                  <th>Timezone</th>
                  <th>Status</th>
                  <th>Next Run</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500 text-xs">
                      Memuat data jadwal...
                    </td>
                  </tr>
                ) : schedules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500 text-xs">
                      Belum ada jadwal otomatis yang dibuat.
                    </td>
                  </tr>
                ) : (
                  schedules.map((s) => {
                    const cfg = configs.find((c) => c.id === s.config_id)
                    return (
                      <tr key={s.id}>
                        <td>
                          <div>
                            <p className="text-xs font-bold text-white">{cfg?.name || 'Config Tanpa Nama'}</p>
                            <p className="font-mono text-[11px] text-gray-400">{s.config_id.substring(0, 13)}...</p>
                          </div>
                        </td>
                        <td className="text-xs text-emerald-300 font-medium">
                          {cronToIndonesian(s.cron_expression, s.timezone || 'Asia/Makassar')}
                        </td>
                        <td>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-900 border border-surface-700 text-amber-300">
                            {s.cron_expression}
                          </span>
                        </td>
                        <td className="text-xs text-gray-300 font-mono">{s.timezone || 'Asia/Makassar'}</td>
                        <td>
                          <button
                            onClick={() => handleToggle(s)}
                            className="cursor-pointer"
                          >
                            {s.enabled ? (
                              <span className="badge-success"><CheckCircle2 className="w-3 h-3" /> Enabled</span>
                            ) : (
                              <span className="badge-neutral"><XCircle className="w-3 h-3" /> Disabled</span>
                            )}
                          </button>
                        </td>
                        <td className="text-xs text-gray-300 font-mono">
                          {(() => {
                            if (!s.next_run) return '-'
                            const d = new Date(s.next_run)
                            if (isNaN(d.getTime()) || d.getFullYear() < 2000) return '-'
                            return d.toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          })()}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="btn-danger btn-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
      {showModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-700 pb-3">
              <h3 className="text-sm font-bold text-white">Tambah Jadwal Scraping Otomatis</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost btn-sm text-gray-400">Batal</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="form-group">
                <label className="label">Pilih Konfigurasi Target</label>
                <select
                  value={configId}
                  onChange={(e) => setConfigId(e.target.value)}
                  className="input font-semibold text-brand-300"
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
                initialCron={cronExpression}
                initialTimezone={timezone}
                onChange={(newCron, newTz) => {
                  setCronExpression(newCron)
                  setTimezone(newTz)
                }}
              />

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="enabledCheck"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                />
                <label htmlFor="enabledCheck" className="text-xs text-gray-300 cursor-pointer">
                  Langsung Aktifkan Jadwal Ini
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full justify-center py-2.5 text-xs font-semibold mt-4"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Jadwal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
