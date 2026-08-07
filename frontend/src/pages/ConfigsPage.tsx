import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { configsApi } from '../api/configs'
import { methodsApi } from '../api/methods'
import type { ScrapingConfig, Method } from '../types'
import { VisualSelectorModal } from '../components/shared/VisualSelectorModal'
import {
  Plus, Settings, Play, Trash2, Edit2, CheckCircle, XCircle,
  MousePointer, Search, Globe, Code, KeyRound, Loader2, ArrowRight
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export function ConfigsPage() {
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<ScrapingConfig[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showVisualSelector, setShowVisualSelector] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [methodCode, setMethodCode] = useState('target_url')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')

  // Dynamic parameters depending on method_code
  // For target_url: url, technique (css/keyword_find), selector / keyword
  // For google_search: query, domain_filter, max_results
  const [targetUrl, setTargetUrl] = useState('https://example.com')
  const [technique, setTechnique] = useState<'css' | 'keyword_find'>('css')
  const [selector, setSelector] = useState('h1')
  const [keyword, setKeyword] = useState('')

  const [searchQuery, setSearchQuery] = useState('Pertanian Sulawesi Utara')
  const [domainFilter, setDomainFilter] = useState('bps.go.id')
  const [maxResults, setMaxResults] = useState('5')

  const fetchInitial = async () => {
    try {
      const [cfgs, mths] = await Promise.all([
        configsApi.getAll(),
        methodsApi.getAll().catch(() => []),
      ])
      setConfigs(cfgs || [])
      setMethods(mths || [])
    } catch (err: any) {
      toast.error('Gagal memuat daftar konfigurasi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInitial()
  }, [])

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
      } else if (methodCode === 'google_search') {
        paramsPayload = [
          { parameter_name: 'query', parameter_value: searchQuery },
          { parameter_name: 'domain_filter', parameter_value: domainFilter },
          { parameter_name: 'max_results', parameter_value: parseInt(maxResults, 10) || 5 },
        ]
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
      fetchInitial()
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

  return (
    <div>
      <Header
        title="Konfigurasi Scraping"
        subtitle="Kelola metode scraping, URL target, selector, atau pencarian berita otomatis."
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
          <div className="card overflow-hidden">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama Konfigurasi</th>
                    <th>Metode</th>
                    <th>Status</th>
                    <th>Scheduler</th>
                    <th>Dibuat</th>
                    <th className="text-right">Aksi</th>
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
                      <tr key={c.id}>
                        <td>
                          <div>
                            <Link to={`/configs/${c.id}`} className="text-sm font-semibold text-white hover:text-brand-300">
                              {c.name}
                            </Link>
                            {c.description && <p className="text-xs text-gray-500 truncate max-w-xs">{c.description}</p>}
                          </div>
                        </td>
                        <td>
                          <span className="badge-neutral font-mono text-[11px]">
                            {c.method_code === 'google_search' ? 'Web Search (News)' : 'Target URL Scraping'}
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
                          <span className={c.schedule_enabled ? 'text-emerald-400 text-xs' : 'text-gray-500 text-xs'}>
                            {c.schedule_enabled ? 'Aktif' : 'Non-aktif'}
                          </span>
                        </td>
                        <td className="text-xs text-gray-400">
                          {new Date(c.created_at).toLocaleDateString('id-ID')}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRunJob(c.id)}
                              className="btn-primary btn-sm bg-brand-600 hover:bg-brand-500"
                              title="Jalankan Job Manual"
                            >
                              <Play className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-700 pb-4">
              <h3 className="text-base font-bold text-white">Buat Konfigurasi Scraping Baru</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-ghost btn-sm text-gray-400"
              >
                Batal
              </button>
            </div>

            <form onSubmit={handleCreateConfig} className="space-y-4">
              <div className="form-group">
                <label className="label">Nama Konfigurasi</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scrape Inflasi BPS 2026"
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
                  <label className="label">Pilih Metode Scraping</label>
                  <select
                    value={methodCode}
                    onChange={(e) => setMethodCode(e.target.value)}
                    className="input"
                  >
                    <option value="target_url">Target URL HTML/CSS Scraping</option>
                    <option value="google_search">Web Search News (DuckDuckGo)</option>
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

              {/* Dynamic Params Form */}
              {methodCode === 'target_url' ? (
                <div className="p-4 rounded-xl bg-surface-800 border border-surface-700 space-y-4">
                  <h4 className="text-xs font-bold text-brand-300 uppercase tracking-wider">Parameter Target URL</h4>

                  <div className="form-group">
                    <label className="label">Target URL</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        required
                        placeholder="https://bps.go.id/publikasi"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        className="input flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setShowVisualSelector(true)}
                        className="btn-secondary text-xs shrink-0 text-amber-300 border-amber-500/40 hover:bg-amber-500/10"
                      >
                        <MousePointer className="w-3.5 h-3.5" />
                        <span>Visual Selector</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="label">Teknik Ekstraksi</label>
                      <select
                        value={technique}
                        onChange={(e) => setTechnique(e.target.value as 'css' | 'keyword_find')}
                        className="input"
                      >
                        <option value="css">CSS Selector Element</option>
                        <option value="keyword_find">Keyword Paragraph Finder</option>
                      </select>
                    </div>

                    {technique === 'css' ? (
                      <div className="form-group">
                        <label className="label">CSS Selector</label>
                        <input
                          type="text"
                          required
                          placeholder="h1, table.data > tbody > tr"
                          value={selector}
                          onChange={(e) => setSelector(e.target.value)}
                          className="input font-mono"
                        />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="label">Kata Kunci (Keyword)</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Inflasi, Produk Domestik"
                          value={keyword}
                          onChange={(e) => setKeyword(e.target.value)}
                          className="input"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-surface-800 border border-surface-700 space-y-4">
                  <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider">Parameter Web Search (News)</h4>

                  <div className="form-group">
                    <label className="label">Query Pencarian</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pertanian Sulawesi Utara"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="label">Filter Domain Opsional</label>
                      <input
                        type="text"
                        placeholder="e.g. bps.go.id"
                        value={domainFilter}
                        onChange={(e) => setDomainFilter(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Maksimal Hasil</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={maxResults}
                        onChange={(e) => setMaxResults(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
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
          onSelectSelector={(generatedCss) => {
            setSelector(generatedCss)
            toast.success(`CSS Selector terpilih: ${generatedCss}`)
          }}
          onClose={() => setShowVisualSelector(false)}
        />
      )}
    </div>
  )
}
