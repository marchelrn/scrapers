import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { schedulesApi } from '../api/schedules'
import { configsApi } from '../api/configs'
import type { Schedule, ScrapingConfig } from '../types'
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
  const [cronExpression, setCronExpression] = useState('*/1 * * * *')
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
    } catch (err: any) {
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
    } catch (err: any) {
      toast.error('Gagal mengedit status jadwal')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus jadwal otomatis ini?')) return
    try {
      await schedulesApi.delete(id)
      toast.success('Jadwal berhasil dihapus')
      setSchedules(schedules.filter((s) => s.id !== id))
    } catch (err: any) {
      toast.error('Gagal menghapus jadwal')
    }
  }

  return (
    <div>
      <Header
        title="Jadwal Eksekusi Otomatis (Scheduler)"
        subtitle="Atur waktu eksekusi berkala (CRON) untuk menjalankan scraping secara otomatis."
      />

      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Daftar Jadwal</h2>
            <p className="text-xs text-gray-400">Total {schedules.length} jadwal terdaftar dalam sistem</p>
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
                  <th>ID</th>
                  <th>Config ID</th>
                  <th>CRON Expression</th>
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
                  schedules.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs text-gray-400">#{s.id}</td>
                      <td className="font-mono text-xs text-brand-300">
                        {s.config_id.substring(0, 13)}...
                      </td>
                      <td>
                        <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-surface-900 border border-surface-700 text-amber-300">
                          {s.cron_expression}
                        </span>
                      </td>
                      <td className="text-xs text-gray-300">{s.timezone || 'Asia/Makassar'}</td>
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
                      <td className="text-xs text-gray-300">
                        {s.next_run ? new Date(s.next_run).toLocaleString('id-ID') : '-'}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Create Schedule */}
      {showModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-5">
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
                  className="input"
                  required
                >
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.method_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Ekspresi CRON</label>
                <input
                  type="text"
                  required
                  placeholder="*/1 * * * *"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  className="input font-mono"
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setCronExpression('*/1 * * * *')}
                    className="btn-ghost btn-sm text-[10px] text-brand-400"
                  >
                    Setiap Menit (*/1 * * * *)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCronExpression('0 * * * *')}
                    className="btn-ghost btn-sm text-[10px] text-brand-400"
                  >
                    Setiap Jam (0 * * * *)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCronExpression('0 0 * * *')}
                    className="btn-ghost btn-sm text-[10px] text-brand-400"
                  >
                    Setiap Hari (0 0 * * *)
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Zona Waktu (Timezone)</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="input"
                />
              </div>

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
