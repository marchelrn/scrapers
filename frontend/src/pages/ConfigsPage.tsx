import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { configsApi } from '../api/configs'
import { methodsApi } from '../api/methods'
import { schedulesApi } from '../api/schedules'
import type { ScrapingConfig, Method, Schedule } from '../types'
import { VisualSelectorModal } from '../components/shared/VisualSelectorModal'
import { LowCodeSchedulePicker } from '../components/shared/LowCodeSchedulePicker'
import { UpdateConfigModal } from '../components/shared/UpdateConfigModal'
import {
  Plus, Play, Trash2, CheckCircle, XCircle,
  MousePointer, Loader2, Calendar, Edit3
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export function ConfigsPage() {
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<ScrapingConfig[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showVisualSelector, setShowVisualSelector] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedConfigForSchedule, setSelectedConfigForSchedule] = useState<ScrapingConfig | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [selectedConfigForUpdate, setSelectedConfigForUpdate] = useState<ScrapingConfig | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form Basic Info State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [methodCode, setMethodCode] = useState('target_url')

  // Target URL UX Options
  const [targetUrlUX, setTargetUrlUX] = useState<'keyword' | 'visual'>('keyword')
  const [targetUrl, setTargetUrl] = useState('https://bps.go.id')
  const [technique, setTechnique] = useState<'css' | 'keyword_find'>('keyword_find')
  const [selector, setSelector] = useState('h1, table.data')
  const [keyword, setKeyword] = useState('Inflasi')

  // Dynamic parameters state map for generic methods
  const [dynamicParamValues, setDynamicParamValues] = useState<Record<string, any>>({
    query: 'Pertanian Sulawesi Utara',
    domain_filter: 'bps.go.id',
    max_results: 5,
  })

  // Schedule Modal Form State
  const [cronExpression, setCronExpression] = useState('0 0 * * *')
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Makassar')
  const [scheduleRunOnce, setScheduleRunOnce] = useState(false)

  const fetchInitialData = async () => {
    try {
      const [cfgs, meths, schs] = await Promise.all([
        configsApi.getAll(),
        methodsApi.getAll().catch(() => []),
        schedulesApi.getAll().catch(() => []),
      ])
      setConfigs(cfgs || [])
      setMethods(meths || [])
      setSchedules(schs || [])
    } catch {
      toast.error('Gagal memuat data awal konfigurasi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInitialData()
  }, [])

  // When methodCode changes, initialize parameters
  useEffect(() => {
    if (methodCode === 'target_url') {
      if (targetUrlUX === 'keyword') {
        setTechnique('keyword_find')
      } else {
        setTechnique('css')
      }
    } else {
      const selectedM = methods.find((m) => m.code === methodCode)
      if (selectedM && selectedM.parameters) {
        const initial: Record<string, any> = {}
        selectedM.parameters.forEach((p) => {
          const pName = p.Name || p.name || ''
          const pDefault = p.Default ?? p.default
          if (pName) {
            initial[pName] = pDefault ?? ''
          }
        })
        setDynamicParamValues((prev) => ({ ...initial, ...prev }))
      }
    }
  }, [methodCode, targetUrlUX, methods])

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let paramsPayload: { parameter_name: string; parameter_value: unknown }[] = []

      if (methodCode === 'target_url') {
        paramsPayload = [
          { parameter_name: 'url', parameter_value: targetUrl },
          { parameter_name: 'technique', parameter_value: technique },
        ]
        if (technique === 'css') {
          paramsPayload.push({ parameter_name: 'selector', parameter_value: selector })
        } else {
          paramsPayload.push({ parameter_name: 'keyword', parameter_value: keyword })
        }
      } else {
        const selectedM = methods.find((m) => m.code === methodCode)
        if (selectedM && selectedM.parameters) {
          selectedM.parameters.forEach((p) => {
            const pName = p.Name || p.name || ''
            if (pName) {
              paramsPayload.push({
                parameter_name: pName,
                parameter_value: dynamicParamValues[pName] ?? '',
              })
            }
          })
        } else {
          Object.entries(dynamicParamValues).forEach(([k, v]) => {
            paramsPayload.push({ parameter_name: k, parameter_value: v })
          })
        }
      }

      await configsApi.create({
        name,
        description: description || undefined,
        method_code: methodCode,
        schedule_enabled: false,
        parameters: paramsPayload,
      })

      toast.success('Konfigurasi scraping berhasil dibuat!')
      setShowCreateModal(false)
      fetchInitialData()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal menyimpan konfigurasi'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRunJob = async (configId: string) => {
    try {
      const job = await configsApi.run(configId)
      toast.success('Job scraping berhasil dijalankan!')
      navigate(`/jobs/${job.id}`)
    } catch {
      toast.error('Gagal memicu job scraping')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus konfigurasi ini?')) return
    try {
      await configsApi.delete(id)
      toast.success('Konfigurasi berhasil dihapus')
      setConfigs(configs.filter((c) => c.id !== id))
    } catch {
      toast.error('Gagal menghapus konfigurasi')
    }
  }

  const handleOpenScheduleModal = (config: ScrapingConfig) => {
    setSelectedConfigForSchedule(config)
    const existingSchedule = schedules.find((s) => s.config_id === config.id)
    if (existingSchedule) {
      setCronExpression(existingSchedule.cron_expression)
      setScheduleTimezone(existingSchedule.timezone || 'Asia/Makassar')
      setScheduleRunOnce(existingSchedule.run_once)
    } else {
      setCronExpression('0 0 * * *')
      setScheduleTimezone('Asia/Makassar')
      setScheduleRunOnce(false)
    }
    setShowScheduleModal(true)
  }

  const   handleUnassignSchedule = async (scheduleId: number) => {
    // const confirmed = confirm(
    //   configName
    //     ? `Apakah Anda yakin ingin membatalkan/unassign jadwal otomatis untuk konfigurasi "${configName}"?`
    //     : 'Apakah Anda yakin ingin membatalkan/unassign jadwal otomatis ini?'
    // )
    // if (!confirmed) return

    setSubmitting(true)
    try {
      await schedulesApi.delete(scheduleId)
      toast.success('Jadwal scheduler berhasil di-unassign / dihapus')
      setShowScheduleModal(false)
      fetchInitialData()
    } catch {
      toast.error('Gagal membatalkan jadwal')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenUpdateModal = (config: ScrapingConfig) => {
    setSelectedConfigForUpdate(config)
    setShowUpdateModal(true)
  }

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConfigForSchedule) return
    setSubmitting(true)
    try {
      const existingSchedule = schedules.find((s) => s.config_id === selectedConfigForSchedule.id)
      if (existingSchedule) {
        await schedulesApi.update(existingSchedule.id, {
          cron_expression: cronExpression,
          timezone: scheduleTimezone,
          enabled: true,
          run_once: scheduleRunOnce,
        })
      } else {
        await schedulesApi.create({
          config_id: selectedConfigForSchedule.id,
          cron_expression: cronExpression,
          timezone: scheduleTimezone,
          enabled: true,
          run_once: scheduleRunOnce,
        })
      }
      toast.success('Jadwal scraping otomatis berhasil disimpan!')
      setShowScheduleModal(false)
      fetchInitialData()
    } catch {
      toast.error('Gagal menyimpan jadwal')
    } finally {
      setSubmitting(false)
    }
  }

  const getMethodNameLabel = (code: string) => {
    const found = methods.find((m) => m.code === code)
    if (found) return found.name
    if (code === 'google_news') return 'Google News RSS Search'
    if (code === 'target_url') return 'Target URL Scraping'
    return code
  }

  // @ts-ignore
  return (
    <div>
      <Header
        title="Konfigurasi Scraping BPS"
      />

      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Daftar Konfigurasi</h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Konfigurasi Baru</span>
          </button>
        </div>

        {/* Configs Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 skeleton" />
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden border-surface-700">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama Konfigurasi</th>
                    <th>Metode Scraping</th>
                    <th>Status</th>
                    <th>Scheduler</th>
                    {/*<th>Dibuat</th>*/}
                    <th className={ "text-center" }>Aksi & Eksekusi</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500 text-xs">
                        Belum ada konfigurasi scraping. Klik "Tambah Konfigurasi Baru" untuk membuat.
                      </td>
                    </tr>
                  ) : (
                    configs.map((c) => {
                      const assignedSchedule = schedules.find((s) => s.config_id === c.id)
                      return (
                        <tr key={c.id} className="hover:bg-surface-800/40">
                          <td>
                            <div>
                              <Link to={`/configs/${c.id}`} className="text-sm font-semibold text-white hover:text-brand-300">
                                {c.name}
                              </Link>
                              {c.description && <p className="text-xs text-gray-400 truncate max-w-xs">{c.description}</p>}
                            </div>
                          </td>
                          <td>
                            <span className="badge-neutral font-mono text-[11px] px-2 py-0.5 rounded bg-surface-800 text-teal-300 border border-surface-700">
                              {getMethodNameLabel(c.method_code)}
                            </span>
                          </td>
                          <td>
                            {c.status === 'active' ? (
                              <span className="badge-success"><CheckCircle className="w-3 h-3" /> Active</span>
                            ) : (
                              <span className="badge-neutral"><XCircle className="w-3 h-3" /> Inactive</span>
                            )}
                          </td>
                          <td>
                            {assignedSchedule ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleOpenScheduleModal(c)}
                                  title={assignedSchedule.enabled ? 'Jadwal Aktif - Klik untuk ubah' : 'Jadwal Nonaktif - Klik untuk ubah'}
                                  className={`text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                                    assignedSchedule.enabled
                                      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20'
                                      : 'text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20'
                                  }`}
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>{assignedSchedule.enabled ? 'Aktif' : 'Nonaktif'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUnassignSchedule(assignedSchedule.id)}
                                  title="Hapus Jadwal Scheduler"
                                  className="p-1 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/30 border border-surface-700 hover:border-red-500/30 transition-colors"
                                >
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenScheduleModal(c)}
                                title="Atur Jadwal Scraping Otomatis"
                                className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-700 bg-surface-800 text-gray-400 hover:text-gray-200 hover:border-surface-600 transition-colors"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Atur</span>
                              </button>
                            )}
                          </td>
                          {/*<td className="text-xs text-gray-400">*/}
                          {/*  {new Date(c.created_at).toLocaleDateString('id-ID')}*/}
                          {/*</td>*/}
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRunJob(c.id)}
                                className="btn-primary btn-sm bg-brand-600 hover:bg-brand-500"
                                title="Jalankan Job"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Run</span>
                              </button>
                              <button
                                onClick={() => handleOpenUpdateModal(c)}
                                className="btn-secondary btn-sm text-brand-300 border-brand-500/40 hover:bg-brand-500/10 flex items-center gap-1"
                                title="Update / Edit Konfigurasi"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDelete(c.id)}
                                className="btn-danger btn-sm"
                                title="Hapus Config"
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
        )}
      </div>

      {/* Create Config Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-700 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Buat Konfigurasi Scraping Baru</h3>
                <p className="text-xs text-gray-400">Dukungan dynamic form blueprint dari registry metode</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-ghost btn-sm text-gray-400"
              >
                Batal
              </button>
            </div>

            <form onSubmit={handleCreateConfig} className="space-y-5">
              <div className="form-group">
                <label className="label">Nama Konfigurasi</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scrape Berita Pertanian Sulut BPS"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </div>

              <div className="form-group">
                <label className="label">Deskripsi Opsional</label>
                <textarea
                  rows={2}
                  placeholder="Catatan mengenai target data ini..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Metode Scraping</label>
                  <select
                    value={methodCode}
                    onChange={(e) => setMethodCode(e.target.value)}
                    className="input font-semibold text-brand-300"
                  >
                    {methods.length === 0 ? (
                      <>
                        <option value="target_url">Target URL</option>
                        <option value="google_news">Google News RSS Search</option>
                      </>
                    ) : (
                      methods.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Special UX Skenario B: Target URL */}
              {methodCode === 'target_url' ? (
                <div className="p-4 rounded-xl bg-surface-800 border border-surface-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-brand-300 uppercase tracking-wider">
                      Target URL Scraping Options
                    </h4>
                    <div className="flex bg-surface-900 p-1 rounded-lg border border-surface-700 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetUrlUX('keyword')
                          setTechnique('keyword_find')
                        }}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          targetUrlUX === 'keyword'
                            ? 'bg-brand-600 text-white font-medium'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        1. Keywords
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetUrlUX('visual')
                          setTechnique('css')
                        }}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          targetUrlUX === 'visual'
                            ? 'bg-brand-600 text-white font-medium'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        2. Visual Selector
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="label">Target Web URL</label>
                    <input
                      type="url"
                      required
                      placeholder="https://bps.go.id/publikasi"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      className="input"
                    />
                  </div>

                  {targetUrlUX === 'keyword' ? (
                    <div className="form-group">
                      <label className="label">Kata Kunci Pencarian Paragraf (Keyword Find)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Inflasi, Produk Domestik, Pertanian"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        className="input"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Backend otomatis mengekstrak paragraf & tabel yang memuat kata kunci ini.
                      </p>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="label">CSS Selector Element</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="h1, table.data > tbody > tr"
                          value={selector}
                          onChange={(e) => setSelector(e.target.value)}
                          className="input font-mono flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setShowVisualSelector(true)}
                          className="btn-secondary text-xs shrink-0 text-amber-300 border-amber-500/40 hover:bg-amber-500/10"
                        >
                          <MousePointer className="w-3.5 h-3.5" />
                          <span>Interactive Click (Proxy)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Dynamic Form Generator for other methods */
                <div className="p-4 rounded-xl bg-surface-800 border border-surface-700 space-y-4">
                  <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                    Dynamic Parameters Blueprint ({methodCode})
                  </h4>

                  {(() => {
                    const foundMethod = methods.find((m) => m.code === methodCode)
                    let paramsList = foundMethod?.parameters

                    if (!paramsList || paramsList.length === 0) {
                      if (methodCode === 'google_news') {
                        paramsList = [
                          { name: 'query', label: 'Search Query', type: 'text', required: true, placeholder: 'e.g. Pertanian Sulawesi Utara 2026' },
                          { name: 'domain_filter', label: 'Domain Filter (Optional)', type: 'text', required: false, placeholder: 'e.g. bps.go.id, antaranews.com' },
                          { name: 'max_results', label: 'Max Results', type: 'number', required: false, default: 10 },
                          { name: 'ai_instruction', label: 'AI Instruction / Prompt', type: 'textarea', required: false, placeholder: 'e.g. Ringkas dan ekstrak hanya data mengenai komoditas Pertanian' },
                          { name: 'deduplicate', label: 'Hindari Duplikasi (Skip URL Lama)', type: 'boolean', required: false, default: true }
                        ] as any
                      }
                    }

                    if (!paramsList || paramsList.length === 0) {
                      return (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="form-group">
                            <label className="label">Search Query</label>
                            <input
                              type="text"
                              value={dynamicParamValues.query || ''}
                              onChange={(e) =>
                                setDynamicParamValues((prev) => ({ ...prev, query: e.target.value }))
                              }
                              className="input"
                            />
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {paramsList.map((param: any, i: number) => {
                          const pName = param.Name || param.name || `param_${i}`
                          const pLabel = param.Label || param.label || pName
                          const pType = (param.Type || param.type || 'text').toLowerCase()
                          const pReq = param.Required ?? param.required ?? false
                          const pPlaceholder = param.Placeholder || param.placeholder || ''
                          const pDesc = param.Description || param.description || ''

                          const isTextarea = pType === 'textarea' || pName === 'ai_instruction'
                          const isBoolean = pType === 'boolean' || pName === 'deduplicate'

                          return (
                            <div key={pName} className={`form-group ${isTextarea ? 'col-span-1 md:col-span-2' : ''}`}>
                              <label className="label flex items-center justify-between">
                                <span>{pLabel} {pReq && <span className="text-red-400">*</span>}</span>
                              </label>
                              {isTextarea ? (
                                <textarea
                                  rows={3}
                                  required={pReq}
                                  placeholder={pPlaceholder}
                                  value={dynamicParamValues[pName] ?? ''}
                                  onChange={(e) =>
                                    setDynamicParamValues((prev) => ({
                                      ...prev,
                                      [pName]: e.target.value,
                                    }))
                                  }
                                  className="input text-xs font-sans"
                                />
                              ) : isBoolean ? (
                                <select
                                  value={String(dynamicParamValues[pName] ?? param.default ?? true)}
                                  onChange={(e) =>
                                    setDynamicParamValues((prev) => ({
                                      ...prev,
                                      [pName]: e.target.value === 'true',
                                    }))
                                  }
                                  className="input"
                                >
                                  <option value="true">Aktif (Ya - Skip URL duplikat)</option>
                                  <option value="false">Nonaktif (Ambil ulang URL yang sama)</option>
                                </select>
                              ) : (
                                <input
                                  type={pType === 'number' ? 'number' : 'text'}
                                  required={pReq}
                                  placeholder={pPlaceholder}
                                  value={dynamicParamValues[pName] ?? ''}
                                  onChange={(e) =>
                                    setDynamicParamValues((prev) => ({
                                      ...prev,
                                      [pName]: pType === 'number' ? Number(e.target.value) : e.target.value,
                                    }))
                                  }
                                  className="input"
                                />
                              )}
                              {pDesc && <p className="text-[11px] text-gray-400 mt-1">{pDesc}</p>}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full justify-center py-2.5 text-xs font-semibold"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Konfigurasi'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Visual Selector Modal Overlay */}
      {showVisualSelector && (
        <VisualSelectorModal
          initialUrl={targetUrl}
          onSelectSelector={(generatedCss, newTargetUrl) => {
            setSelector(generatedCss)
            if (newTargetUrl) {
              setTargetUrl(newTargetUrl)
            }
            toast.success(`CSS Selector terpilih: ${generatedCss}`)
          }}
          onClose={() => setShowVisualSelector(false)}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && selectedConfigForSchedule && (() => {
        const existingSchedule = schedules.find((s) => s.config_id === selectedConfigForSchedule.id)
        return (
          <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="card w-full max-w-lg bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-surface-700 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>{existingSchedule ? 'Edit Jadwal Scraping' : 'Atur Jadwal Scraping Otomatis'}</span>
                </h3>
                <button onClick={() => setShowScheduleModal(false)} className="btn-ghost btn-sm text-gray-400">
                  Batal
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <p className="text-gray-400">
                  Konfigurasi: <span className="text-white font-semibold">{selectedConfigForSchedule.name}</span>
                </p>
              </div>

              <form onSubmit={handleCreateSchedule} className="space-y-4">
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
                    disabled={submitting}
                    className="btn-primary flex-1 justify-center py-2.5 text-xs font-semibold"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Jadwal'}
                  </button>

                  {existingSchedule && (
                    <button
                      type="button"
                      onClick={() => handleUnassignSchedule(existingSchedule.id)}
                      disabled={submitting}
                      className="btn-danger btn-sm py-2.5 px-3 text-xs"
                      title="Batalkan & Hapus Jadwal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      {/* Update Config Modal Overlay */}
      <UpdateConfigModal
        config={selectedConfigForUpdate}
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onSuccess={fetchInitialData}
        initialMethods={methods}
      />
    </div>
  )
}
