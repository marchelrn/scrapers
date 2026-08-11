import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { configsApi } from '../api/configs'
import { methodsApi } from '../api/methods'
import { secretsApi } from '../api/secrets'
import { schedulesApi } from '../api/schedules'
import type { ScrapingConfig, Method, Secret } from '../types'
import { VisualSelectorModal } from '../components/shared/VisualSelectorModal'
import {
  Plus, Play, Trash2, CheckCircle, XCircle,
  MousePointer, Loader2, KeyRound, Calendar, Clock, Lock
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export function ConfigsPage() {
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<ScrapingConfig[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showVisualSelector, setShowVisualSelector] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedConfigForSchedule, setSelectedConfigForSchedule] = useState<ScrapingConfig | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form Basic Info State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [methodCode, setMethodCode] = useState('target_url')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')

  // Auth Vault Integration State
  const [authType, setAuthType] = useState('none')
  const [secretReference, setSecretReference] = useState('')

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
  const [cronPreset, setCronPreset] = useState('daily')

  const fetchInitialData = async () => {
    try {
      const [cfgs, meths, secs] = await Promise.all([
        configsApi.getAll(),
        methodsApi.getAll().catch(() => []),
        secretsApi.getAll().catch(() => []),
      ])
      setConfigs(cfgs || [])
      setMethods(meths || [])
      setSecrets(secs || [])
    } catch (err: any) {
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

      // Add auth parameter if specified
      paramsPayload.push({ parameter_name: 'auth_type', parameter_value: authType })
      if (authType !== 'none' && secretReference) {
        paramsPayload.push({ parameter_name: 'secret_reference', parameter_value: secretReference })
      }

      await configsApi.create({
        name,
        description: description || undefined,
        method_code: methodCode,
        status,
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
    } catch (err: any) {
      toast.error('Gagal memicu job scraping')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus konfigurasi ini?')) return
    try {
      await configsApi.delete(id)
      toast.success('Konfigurasi berhasil dihapus')
      setConfigs(configs.filter((c) => c.id !== id))
    } catch (err: any) {
      toast.error('Gagal menghapus konfigurasi')
    }
  }

  const handleOpenScheduleModal = (config: ScrapingConfig) => {
    setSelectedConfigForSchedule(config)
    setShowScheduleModal(true)
  }

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConfigForSchedule) return
    setSubmitting(true)
    try {
      await schedulesApi.create({
        config_id: selectedConfigForSchedule.id,
        cron_expression: cronExpression,
        enabled: true,
      })
      toast.success('Jadwal scraping otomatis berhasil disimpan!')
      setShowScheduleModal(false)
      fetchInitialData()
    } catch (err: any) {
      toast.error('Gagal menyimpan jadwal')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePresetChange = (preset: string) => {
    setCronPreset(preset)
    if (preset === 'hourly') setCronExpression('0 * * * *')
    else if (preset === 'daily') setCronExpression('0 0 * * *')
    else if (preset === 'weekly') setCronExpression('0 0 * * 0')
    else if (preset === 'monthly') setCronExpression('0 0 1 * *')
  }

  const getMethodNameLabel = (code: string) => {
    const found = methods.find((m) => m.code === code)
    if (found) return found.name
    if (code === 'google_search') return 'Web Search (News)'
    if (code === 'target_url') return 'Target URL Scraping'
    return code
  }

  return (
    <div>
      <Header
        title="Konfigurasi Scraping BPS"
        subtitle="Kelola metode scraping, blueprint dynamic form, visual selector proxy, dan penjadwalan."
      />

      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Daftar Konfigurasi</h2>
            <p className="text-xs text-gray-400">Total {configs.length} konfigurasi aktif/inaktif</p>
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
                    <th>Metode Blueprint</th>
                    <th>Status</th>
                    <th>Scheduler</th>
                    <th>Dibuat</th>
                    <th className="text-right">Aksi & Eksekusi</th>
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
                    configs.map((c) => (
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
                          <button
                            onClick={() => handleOpenScheduleModal(c)}
                            className={`text-xs inline-flex items-center gap-1.5 px-2 py-1 rounded border transition-colors ${
                              c.schedule_enabled
                                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20'
                                : 'text-gray-400 border-surface-700 bg-surface-800 hover:text-gray-200'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            <span>{c.schedule_enabled ? 'Aktif' : '+ Jadwal'}</span>
                          </button>
                        </td>
                        <td className="text-xs text-gray-400">
                          {new Date(c.created_at).toLocaleDateString('id-ID')}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRunJob(c.id)}
                              className="btn-primary btn-sm bg-brand-600 hover:bg-brand-500"
                              title="Jalankan Job Pintas (Run Shortcut)"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Run</span>
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
                    ))
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
                <p className="text-xs text-gray-400">Dukungan dynamic form blueprint & secret vault authentication</p>
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
                  <label className="label">Metode Scraping (Dinamis / GET methods)</label>
                  <select
                    value={methodCode}
                    onChange={(e) => setMethodCode(e.target.value)}
                    className="input font-semibold text-brand-300"
                  >
                    {methods.length === 0 ? (
                      <>
                        <option value="target_url">Target URL HTML/CSS Scraping</option>
                        <option value="google_search">Web Search News (DuckDuckGo)</option>
                      </>
                    ) : (
                      methods.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.name} ({m.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                    className="input"
                  >
                    <option value="active">Active (Siap dieksekusi)</option>
                    <option value="inactive">Inactive</option>
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
                        1. Low Code (Keyword)
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
                        2. Visual Selector (Point & Click)
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
                    const paramsList = foundMethod?.parameters

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
                          <div className="form-group">
                            <label className="label">Domain Filter</label>
                            <input
                              type="text"
                              value={dynamicParamValues.domain_filter || ''}
                              onChange={(e) =>
                                setDynamicParamValues((prev) => ({ ...prev, domain_filter: e.target.value }))
                              }
                              className="input"
                            />
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {paramsList.map((param, i) => {
                          const pName = param.Name || param.name || `param_${i}`
                          const pLabel = param.Label || param.label || pName
                          const pType = (param.Type || param.type || 'text').toLowerCase()
                          const pReq = param.Required ?? param.required ?? false
                          const pPlaceholder = param.Placeholder || param.placeholder || ''

                          return (
                            <div key={pName} className="form-group">
                              <label className="label">
                                {pLabel} {pReq && <span className="text-red-400">*</span>}
                              </label>
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
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Secret Vault & Authentication Integration */}
              <div className="p-4 rounded-xl bg-surface-800 border border-surface-700 space-y-3">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Autentikasi & Secret Vault (Kredensial)</span>
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Tipe Otentikasi Web</label>
                    <select
                      value={authType}
                      onChange={(e) => setAuthType(e.target.value)}
                      className="input"
                    >
                      <option value="none">Tanpa Login (Public Page)</option>
                      <option value="cookie">Cookie Session</option>
                      <option value="api_key">API Key</option>
                      <option value="bearer_token">Bearer Token</option>
                      <option value="basic_auth">Basic Auth</option>
                    </select>
                  </div>

                  {authType !== 'none' && (
                    <div className="form-group">
                      <label className="label flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>Pilih Secret dari Vault</span>
                      </label>
                      <select
                        value={secretReference}
                        onChange={(e) => setSecretReference(e.target.value)}
                        required={authType !== 'none'}
                        className="input font-mono text-xs border-amber-500/40"
                      >
                        <option value="">-- Pilih Secret Key / Cookie --</option>
                        {secrets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.secret_type})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

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
          onSelectSelector={(generatedCss) => {
            setSelector(generatedCss)
            toast.success(`CSS Selector terpilih: ${generatedCss}`)
          }}
          onClose={() => setShowVisualSelector(false)}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && selectedConfigForSchedule && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-surface-700 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Set Penjadwalan Scraping</span>
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="btn-ghost btn-sm text-gray-400">
                Batal
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Konfigurasi: <span className="text-white font-semibold">{selectedConfigForSchedule.name}</span>
            </p>

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div className="form-group">
                <label className="label">Pilihan Preset Waktu</label>
                <select
                  value={cronPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="input"
                >
                  <option value="daily">Setiap Hari (0 0 * * *)</option>
                  <option value="hourly">Setiap Jam (0 * * * *)</option>
                  <option value="weekly">Setiap Minggu (0 0 * * 0)</option>
                  <option value="monthly">Setiap Bulan (0 0 1 * *)</option>
                  <option value="custom">Kustom Cron Expression</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-400" />
                  <span>Cron Expression</span>
                </label>
                <input
                  type="text"
                  required
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 0 * * *"
                  className="input font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full justify-center py-2 text-xs"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Penjadwalan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
