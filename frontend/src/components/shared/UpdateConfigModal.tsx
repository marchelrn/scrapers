import React, { useState, useEffect } from 'react'
import type { ScrapingConfig, Method } from '../../types'
import { configsApi } from '../../api/configs'
import { methodsApi } from '../../api/methods'
import { VisualSelectorModal } from './VisualSelectorModal'
import { MousePointer, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface UpdateConfigModalProps {
  config: ScrapingConfig | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialMethods?: Method[]
}

export function UpdateConfigModal({
  config,
  isOpen,
  onClose,
  onSuccess,
  initialMethods,
}: UpdateConfigModalProps) {
  const [methods, setMethods] = useState<Method[]>(initialMethods || [])
  const [submitting, setSubmitting] = useState(false)
  const [showVisualSelector, setShowVisualSelector] = useState(false)

  // Form Basic Info State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [methodCode, setMethodCode] = useState('target_url')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')

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

  // Fetch methods if not provided
  useEffect(() => {
    if (!isOpen) return
    if (!initialMethods || initialMethods.length === 0) {
      methodsApi.getAll().then((m) => setMethods(m || [])).catch(() => {})
    }
  }, [isOpen, initialMethods])

  // Populate form fields when config prop changes
  useEffect(() => {
    if (config && isOpen) {
      setName(config.name || '')
      setDescription(config.description || '')
      setMethodCode(config.method_code || 'target_url')
      setStatus(config.status || 'active')

      const paramMap = new Map<string, any>()
      if (config.parameters) {
        config.parameters.forEach((p) => {
          paramMap.set(p.parameter_name, p.parameter_value)
        })
      }

      if (paramMap.has('url')) {
        setTargetUrl(String(paramMap.get('url') ?? 'https://bps.go.id'))
      }
      if (paramMap.has('technique')) {
        const tech = String(paramMap.get('technique')) as 'css' | 'keyword_find'
        setTechnique(tech)
        setTargetUrlUX(tech === 'css' ? 'visual' : 'keyword')
      }
      if (paramMap.has('keyword')) {
        setKeyword(String(paramMap.get('keyword') ?? 'Inflasi'))
      }
      if (paramMap.has('selector')) {
        setSelector(String(paramMap.get('selector') ?? 'h1, table.data'))
      }

      const dynObj: Record<string, any> = {}
      paramMap.forEach((v, k) => {
        if (!['url', 'technique', 'keyword', 'selector'].includes(k)) {
          dynObj[k] = v
        }
      })
      setDynamicParamValues((prev) => ({ ...prev, ...dynObj }))
    }
  }, [config, isOpen])

  // Update technique when methodCode or targetUrlUX changes
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

  if (!isOpen || !config) return null

  const handleUpdateConfig = async (e: React.FormEvent) => {
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

      await configsApi.update(config.id, {
        name,
        description: description || undefined,
        method_code: methodCode,
        status,
        parameters: paramsPayload,
      })

      toast.success('Konfigurasi scraping berhasil diperbarui!')
      onSuccess()
      onClose()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal menyimpan konfigurasi'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="card w-full max-w-2xl bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-surface-700 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">Update Konfigurasi Scraping</h3>
              <p className="text-xs text-gray-400">Dukungan dynamic form blueprint dari registry metode</p>
            </div>
            <button
              onClick={onClose}
              className="btn-ghost btn-sm text-gray-400"
            >
              Batal
            </button>
          </div>

          <form onSubmit={handleUpdateConfig} className="space-y-5">
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

              <div className="form-group">
                <label className="label">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="input"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
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
                      1. Low Code
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
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Perbarui Konfigurasi'}
            </button>
          </form>
        </div>
      </div>

      {/* Visual Selector Proxy Modal Overlay */}
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
    </>
  )
}
