import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Method } from '../../types'
import { configsApi } from '../../api/configs'
import { schedulesApi } from '../../api/schedules'
import { DynamicScraperForm } from './DynamicScraperForm'
import { LowCodeSchedulePicker } from '../shared/LowCodeSchedulePicker'
import {
  X, Play, BookmarkPlus, Calendar,
  Loader2, CheckCircle2, ShieldCheck, Tag
} from 'lucide-react'
import toast from 'react-hot-toast'

export interface ScraperRunnerModalProps {
  method: Method | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ScraperRunnerModal({
  method,
  isOpen,
  onClose,
  onSuccess,
}: ScraperRunnerModalProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'run' | 'save' | 'schedule'>('run')
  const [configName, setConfigName] = useState('')
  const [configDescription, setConfigDescription] = useState('')
  const [paramValues, setParamValues] = useState<Record<string, any>>({})
  const [isFormValid, setIsFormValid] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Scheduling State
  const [cronExpression, setCronExpression] = useState('0 8 * * *') // Default 08:00 AM daily
  const [timezone, setTimezone] = useState('Asia/Makassar')
  const [runOnce, setRunOnce] = useState(false)
  const [enableScheduleImmediately, setEnableScheduleImmediately] = useState(false)

  if (!isOpen || !method) return null

  // Auto-generate a smart default name if empty
  const getEffectiveName = () => {
    if (configName.trim()) return configName.trim()
    const queryParam = paramValues['query'] || paramValues['keyword'] || paramValues['url']
    if (queryParam && typeof queryParam === 'string') {
      const cleanQ = queryParam.length > 25 ? queryParam.substring(0, 25) + '...' : queryParam
      return `${method.name} - ${cleanQ}`
    }
    const today = new Date().toISOString().slice(0, 10)
    return `${method.name} (${today})`
  }

  const buildParamsPayload = () => {
    const payload: { parameter_name: string; parameter_value: unknown }[] = []
    Object.entries(paramValues).forEach(([k, v]) => {
      payload.push({
        parameter_name: k,
        parameter_value: v,
      })
    })
    return payload
  }

  // Action 1: On-Demand Execution (Run Directly)
  const handleRunNow = async () => {
    if (!isFormValid) {
      toast.error('Harap lengkapi semua parameter wajib terlebih dahulu')
      return
    }

    setSubmitting(true)
    try {
      const effectiveName = getEffectiveName()
      const paramsPayload = buildParamsPayload()

      // 1. Create config
      const newConfig = await configsApi.create({
        name: effectiveName,
        description: configDescription || `Eksekusi On-Demand via Katalog (${method.name})`,
        method_code: method.code,
        schedule_enabled: false,
        parameters: paramsPayload,
      })

      // 2. Trigger instant job
      toast.loading('Memulai proses scraping...', { id: 'run-job' })
      const job = await configsApi.run(newConfig.id)
      toast.success('Job scraping berhasil dijalankan!', { id: 'run-job' })

      onClose()
      if (onSuccess) onSuccess()

      // 3. Navigate straight to job detail page
      navigate(`/jobs/${job.id}`)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal menjalankan scraping'
      toast.error(msg, { id: 'run-job' })
    } finally {
      setSubmitting(false)
    }
  }

  // Action 2: Save as Configuration
  const handleSaveConfig = async () => {
    if (!isFormValid) {
      toast.error('Harap lengkapi semua parameter wajib terlebih dahulu')
      return
    }

    setSubmitting(true)
    try {
      const effectiveName = getEffectiveName()
      const paramsPayload = buildParamsPayload()

      await configsApi.create({
        name: effectiveName,
        description: configDescription || undefined,
        method_code: method.code,
        schedule_enabled: false,
        parameters: paramsPayload,
      })

      toast.success('Konfigurasi scraping berhasil disimpan!')
      onClose()
      if (onSuccess) onSuccess()
      navigate('/configs')
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal menyimpan konfigurasi'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Action 3: Save and Schedule
  const handleSaveAndSchedule = async () => {
    if (!isFormValid) {
      toast.error('Harap lengkapi semua parameter wajib terlebih dahulu')
      return
    }

    setSubmitting(true)
    try {
      const effectiveName = getEffectiveName()
      const paramsPayload = buildParamsPayload()

      // 1. Create config
      const newConfig = await configsApi.create({
        name: effectiveName,
        description: configDescription || `Jadwal otomatis ${method.name}`,
        method_code: method.code,
        schedule_enabled: enableScheduleImmediately,
        parameters: paramsPayload,
      })

      // 2. Create schedule
      await schedulesApi.create({
        config_id: newConfig.id,
        cron_expression: cronExpression,
        timezone,
        enabled: enableScheduleImmediately,
        run_once: runOnce,
      })

      toast.success(
        enableScheduleImmediately
          ? 'Konfigurasi & Jadwal Aktif berhasil dibuat!'
          : 'Konfigurasi & Jadwal (Status: Nonaktif) berhasil dibuat!'
      )
      onClose()
      if (onSuccess) onSuccess()
      navigate('/schedules')
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal menyimpan jadwal'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl bg-surface-900 border-surface-600 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-surface-700 bg-surface-850/90 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {method.category || 'Umum'}
              </span>
              <span className="text-[11px] font-mono text-gray-400 bg-surface-800 px-2 py-0.5 rounded border border-surface-700">
                v{method.version || '1.0.0'}
              </span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Terverifikasi IPDS</span>
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">{method.name}</h2>
            {method.description && (
              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{method.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-surface-700 bg-surface-900/60 px-6">
          <button
            onClick={() => setActiveTab('run')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'run'
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Jalankan Langsung (On-Demand)</span>
          </button>
          <button
            onClick={() => setActiveTab('save')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'save'
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Simpan Konfigurasi</span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'schedule'
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Simpan & Jadwalkan (Cron)</span>
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Optional Task Name and Notes */}
          <div className="p-4 rounded-xl bg-surface-850 border border-surface-700 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-brand-400" />
                <span>Nama Identifikasi Tugas (Opsional)</span>
              </label>
              <input
                type="text"
                value={configName}
                placeholder={`Contoh: ${method.name} - Isu Terkini`}
                onChange={(e) => setConfigName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-surface-900 border border-surface-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <p className="text-[10px] text-gray-400">
                Bila dikosongkan, sistem akan membuat nama otomatis berdasarkan parameter yang dimasukkan.
              </p>
            </div>

            {activeTab !== 'run' && (
              <div className="space-y-1 pt-1 border-t border-surface-750">
                <label className="text-xs font-semibold text-gray-300">Deskripsi / Catatan Tambahan</label>
                <input
                  type="text"
                  value={configDescription}
                  placeholder="e.g. Diambil rutin untuk laporan Nerwilis Bulanan"
                  onChange={(e) => setConfigDescription(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface-900 border border-surface-700 text-gray-100 placeholder-gray-500"
                />
              </div>
            )}
          </div>

          {/* Dynamic Scraper Parameter Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Parameter Scraping ({method.parameters?.length || 0})
              </h3>
              <span className="text-[11px] text-gray-400">Disediakan oleh {method.author || 'Tim IPDS BPS'}</span>
            </div>

            <DynamicScraperForm
              method={method}
              initialValues={paramValues}
              onChange={(values, valid) => {
                setParamValues(values)
                setIsFormValid(valid)
              }}
              disabled={submitting}
            />
          </div>

          {/* Schedule Picker if activeTab is schedule */}
          {activeTab === 'schedule' && (
            <div className="space-y-3 pt-4 border-t border-surface-700">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pengaturan Waktu Eksekusi Otomatis</span>
              </h3>

              <LowCodeSchedulePicker
                initialCron={cronExpression}
                initialTimezone={timezone}
                initialRunOnce={runOnce}
                onChange={(cron, tz, once) => {
                  setCronExpression(cron)
                  setTimezone(tz)
                  setRunOnce(once)
                }}
              />

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-850 border border-surface-700">
                <div>
                  <p className="text-xs font-semibold text-gray-200">Aktifkan Jadwal Otomatis Langsung</p>
                  <p className="text-[11px] text-gray-400">
                    Default nonaktif (disarankan diuji coba on-demand terlebih dahulu).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableScheduleImmediately(!enableScheduleImmediately)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                    enableScheduleImmediately ? 'bg-emerald-500' : 'bg-surface-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      enableScheduleImmediately ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-surface-850 border-t border-surface-700 flex items-center justify-between gap-3">
          <div className="text-[11px] text-gray-400">
            {isFormValid ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Parameter lengkap & siap dijalankan</span>
              </span>
            ) : (
              <span className="text-amber-400">Harap lengkapi isian berbintang (*)</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-ghost btn-sm text-gray-400 text-xs"
            >
              Batal
            </button>

            {activeTab === 'run' && (
              <button
                type="button"
                onClick={handleRunNow}
                disabled={submitting || !isFormValid}
                className="btn-primary text-xs flex items-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 shadow-lg shadow-teal-900/40"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses Eksekusi...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Jalankan Sekarang (On-Demand)</span>
                  </>
                )}
              </button>
            )}

            {activeTab === 'save' && (
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={submitting || !isFormValid}
                className="btn-primary text-xs flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-4 h-4" />
                    <span>Simpan Konfigurasi</span>
                  </>
                )}
              </button>
            )}

            {activeTab === 'schedule' && (
              <button
                type="button"
                onClick={handleSaveAndSchedule}
                disabled={submitting || !isFormValid}
                className="btn-primary text-xs flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Jadwal...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Simpan & Daftarkan Jadwal</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
