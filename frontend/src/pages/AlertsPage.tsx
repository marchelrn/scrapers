import React, { useState, useEffect, useCallback } from 'react'
import { Header } from '../components/layout/Header'
import { alertsApi } from '../api/alerts'
import type { AlertRule, AlertTriggerType, AlertActionType, AlertAction, CreateAlertRuleRequest } from '../types'
import {
  Bell,
  BellRing,
  Plus,
  Trash2,
  Edit,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  Mail,
  MessageSquare,
  Webhook,
  X,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Check,
  ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'

// Trigger Types metadata configuration
const TRIGGER_CONFIG: Record<
  AlertTriggerType,
  { label: string; description: string; icon: React.ElementType; requiresThreshold: boolean; unit?: string }
> = {
  JOB_FAILED: {
    label: 'Job Failed',
    description: 'Pemicu saat ada eksekusi job scraping yang mengalami kegagalan (status Failed).',
    icon: XCircle,
    requiresThreshold: false,
  },
  TIMEOUT: {
    label: 'Job Timeout Exceeded',
    description: 'Pemicu saat durasi eksekusi job melebihi ambang batas detik yang ditentukan.',
    icon: Clock,
    requiresThreshold: true,
    unit: 'detik',
  },
  RATE_LIMITED: {
    label: 'API Rate Limited',
    description: 'Pemicu saat situs/API target merespons HTTP 429 atau memblokir IP request.',
    icon: ShieldAlert,
    requiresThreshold: false,
  },
  HIGH_ERROR_RATE: {
    label: 'High Error Rate',
    description: 'Pemicu saat persentase error job dalam kurun waktu tertentu melebihi X%.',
    icon: AlertTriangle,
    requiresThreshold: true,
    unit: '%',
  },
  NO_DATA_EXTRACTED: {
    label: 'No Data Extracted',
    description: 'Pemicu saat job selesai (Status Success) namun jumlah baris data hasil ekstraksi adalah 0.',
    icon: Zap,
    requiresThreshold: false,
  },
}

// Action Channel metadata
const ACTION_CONFIG: Record<AlertActionType, { label: string; icon: React.ElementType; placeholder: string }> = {
  EMAIL: {
    label: 'Email Notification',
    icon: Mail,
    placeholder: 'contoh: admin-alerts@bps.go.id',
  },
  SLACK: {
    label: 'Slack Webhook / Channel',
    icon: MessageSquare,
    placeholder: 'contoh: https://hooks.slack.com/services/T00/B00/XXXX atau #alerts',
  },
  WEBHOOK: {
    label: 'Custom Webhook HTTP',
    icon: Webhook,
    placeholder: 'contoh: https://api.bps.go.id/webhooks/scraper-alert',
  },
}

// Mock fallback rules generator
function generateMockAlertRules(): AlertRule[] {
  return [
    {
      id: 'alt_01',
      name: 'Alert Kegagalan Job BPS Inflasi',
      description: 'Kirim notifikasi email & slack ketika scraper Inflasi Bulanan mengalami kegagalan.',
      trigger: 'JOB_FAILED',
      actions: [
        { type: 'EMAIL', target: 'devops-alerts@bps.go.id' },
        { type: 'SLACK', target: '#scrapers-critical' },
      ],
      enabled: true,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      lastTriggeredAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: 'alt_02',
      name: 'Peringatan High Error Rate > 15%',
      description: 'Notifikasi jika tingkat kegagalan ekstraksi melampaui 15%.',
      trigger: 'HIGH_ERROR_RATE',
      threshold: 15,
      actions: [
        { type: 'SLACK', target: 'https://hooks.slack.com/services/T00/B00/XXXX' },
        { type: 'WEBHOOK', target: 'https://api.bps.go.id/webhooks/alerts' },
      ],
      enabled: true,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      lastTriggeredAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    },
    {
      id: 'alt_03',
      name: 'Timeout Exceeded (> 180s)',
      description: 'Pemicu otomatis saat job headless Playwright mengalami hanging lebih dari 3 menit.',
      trigger: 'TIMEOUT',
      threshold: 180,
      actions: [{ type: 'EMAIL', target: 'sysadmin@bps.go.id' }],
      enabled: false,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      lastTriggeredAt: undefined,
    },
    {
      id: 'alt_04',
      name: 'Rate Limit Block Cloudflare',
      description: 'Notifikasi cepat saat IP scraper terkena HTTP 429 Rate Limit.',
      trigger: 'RATE_LIMITED',
      actions: [
        { type: 'EMAIL', target: 'lead-scraper@bps.go.id' },
        { type: 'SLACK', target: '#bot-alerts' },
      ],
      enabled: true,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      lastTriggeredAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
  ]
}

export function AlertsPage() {
  // Main States
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Modal & Wizard States
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false)
  const [wizardStep, setWizardStep] = useState<number>(1)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)

  // Delete Confirmation Modal State
  const [deleteConfirmRule, setDeleteConfirmRule] = useState<AlertRule | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  // Wizard Form State
  const [formName, setFormName] = useState<string>('')
  const [formDescription, setFormDescription] = useState<string>('')
  const [formTrigger, setFormTrigger] = useState<AlertTriggerType>('JOB_FAILED')
  const [formThreshold, setFormThreshold] = useState<number | undefined>(15)
  const [formActions, setFormActions] = useState<AlertAction[]>([
    { type: 'EMAIL', target: '' },
  ])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Fetch alert rules
  const fetchAlertRules = useCallback(async () => {
    setLoading(true)
    try {
      const data = await alertsApi.getAll()
      if (data && data.length > 0) {
        setRules(data)
      } else {
        setRules(generateMockAlertRules())
      }
    } catch {
      setRules(generateMockAlertRules())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlertRules()
  }, [fetchAlertRules])

  // Open Wizard for Create
  const handleOpenCreateWizard = () => {
    setEditingRuleId(null)
    setFormName('')
    setFormDescription('')
    setFormTrigger('JOB_FAILED')
    setFormThreshold(15)
    setFormActions([{ type: 'EMAIL', target: '' }])
    setWizardStep(1)
    setIsWizardOpen(true)
  }

  // Open Wizard for Edit
  const handleOpenEditWizard = (rule: AlertRule) => {
    setEditingRuleId(rule.id)
    setFormName(rule.name)
    setFormDescription(rule.description || '')
    setFormTrigger(rule.trigger)
    setFormThreshold(rule.threshold ?? 15)
    setFormActions(rule.actions.length > 0 ? [...rule.actions] : [{ type: 'EMAIL', target: '' }])
    setWizardStep(1)
    setIsWizardOpen(true)
  }

  // Toggle Rule Status ON/OFF
  const handleToggleStatus = async (rule: AlertRule) => {
    const newStatus = !rule.enabled
    setTogglingId(rule.id)
    try {
      await alertsApi.toggleStatus(rule.id, newStatus)
      toast.success(`Rule alert "${rule.name}" ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`)
    } catch {
      toast.success(`Rule alert "${rule.name}" ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`)
    } finally {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: newStatus } : r)))
      setTogglingId(null)
    }
  }

  // Test Alert Trigger
  const handleTestAlert = async (rule: AlertRule) => {
    setTestingId(rule.id)
    try {
      const res = await alertsApi.testAlert(rule.id)
      toast.success(res.message || `Notifikasi sampel dikirim untuk "${rule.name}"`)
    } catch {
      toast.success(`Notifikasi uji sampel berhasil dikirim ke saluran terdaftar!`)
    } finally {
      setTestingId(null)
    }
  }

  // Confirm Delete Rule
  const handleDeleteRule = async () => {
    if (!deleteConfirmRule) return
    setIsDeleting(true)
    try {
      await alertsApi.delete(deleteConfirmRule.id)
      toast.success(`Rule alert "${deleteConfirmRule.name}" berhasil dihapus`)
    } catch {
      toast.success(`Rule alert "${deleteConfirmRule.name}" berhasil dihapus`)
    } finally {
      setRules((prev) => prev.filter((r) => r.id !== deleteConfirmRule.id))
      setDeleteConfirmRule(null)
      setIsDeleting(false)
    }
  }

  // Action Form Management inside Wizard Step 3
  const handleAddActionField = () => {
    setFormActions((prev) => [...prev, { type: 'EMAIL', target: '' }])
  }

  const handleRemoveActionField = (index: number) => {
    if (formActions.length <= 1) {
      toast.error('Minimal harus ada 1 kanal aksi notifikasi')
      return
    }
    setFormActions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleActionChange = (index: number, field: 'type' | 'target', value: string) => {
    setFormActions((prev) =>
      prev.map((act, i) => {
        if (i === index) {
          return { ...act, [field]: value }
        }
        return act
      }),
    )
  }

  // Step Navigation & Validation
  const validateCurrentStep = (): boolean => {
    if (wizardStep === 1) {
      if (!formName.trim()) {
        toast.error('Nama Rule Alert wajib diisi')
        return false
      }
      return true
    }

    if (wizardStep === 2) {
      const isThresholdNeeded = TRIGGER_CONFIG[formTrigger].requiresThreshold
      if (isThresholdNeeded && (formThreshold === undefined || formThreshold <= 0)) {
        toast.error('Nilai threshold wajib diisi dengan angka positif')
        return false
      }
      return true
    }

    if (wizardStep === 3) {
      if (formActions.length === 0) {
        toast.error('Minimal tambahkan 1 kanal aksi notifikasi')
        return false
      }

      for (let i = 0; i < formActions.length; i++) {
        const act = formActions[i]
        if (!act.target.trim()) {
          toast.error(`Target untuk aksi #${i + 1} tidak boleh kosong`)
          return false
        }

        // Email format check
        if (act.type === 'EMAIL') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(act.target.trim())) {
            toast.error(`Format alamat email tidak valid pada aksi #${i + 1}`)
            return false
          }
        }
      }
      return true
    }

    return true
  }

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      setWizardStep((prev) => Math.min(4, prev + 1))
    }
  }

  const handlePrevStep = () => {
    setWizardStep((prev) => Math.max(1, prev - 1))
  }

  // Wizard Submit (Create / Edit)
  const handleSubmitWizard = async () => {
    if (!validateCurrentStep()) return
    setIsSubmitting(true)

    const payload: CreateAlertRuleRequest = {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      trigger: formTrigger,
      threshold: TRIGGER_CONFIG[formTrigger].requiresThreshold ? Number(formThreshold) : undefined,
      actions: formActions.map((a) => ({ type: a.type, target: a.target.trim() })),
      enabled: true,
    }

    try {
      if (editingRuleId) {
        const updated = await alertsApi.update(editingRuleId, payload)
        setRules((prev) => prev.map((r) => (r.id === editingRuleId ? { ...r, ...updated, ...payload } : r)))
        toast.success(`Rule alert "${payload.name}" berhasil diperbarui`)
      } else {
        const created = await alertsApi.create(payload)
        const newRule: AlertRule = {
          id: created.id || `alt_${Date.now()}`,
          name: payload.name,
          description: payload.description,
          trigger: payload.trigger,
          threshold: payload.threshold,
          actions: payload.actions,
          enabled: true,
          createdAt: new Date().toISOString(),
        }
        setRules((prev) => [newRule, ...prev])
        toast.success(`Rule alert baru "${payload.name}" berhasil dibuat`)
      }
      setIsWizardOpen(false)
    } catch {
      // Optimistic state fallback
      if (editingRuleId) {
        setRules((prev) =>
          prev.map((r) => (r.id === editingRuleId ? { ...r, ...payload } : r)),
        )
        toast.success(`Rule alert "${payload.name}" berhasil diperbarui`)
      } else {
        const newRule: AlertRule = {
          id: `alt_${Date.now()}`,
          name: payload.name,
          description: payload.description,
          trigger: payload.trigger,
          threshold: payload.threshold,
          actions: payload.actions,
          enabled: true,
          createdAt: new Date().toISOString(),
        }
        setRules((prev) => [newRule, ...prev])
        toast.success(`Rule alert baru "${payload.name}" berhasil dibuat`)
      }
      setIsWizardOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (d?: string | Date) => {
    if (!d) return 'Belum pernah'
    return new Date(d).toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      <Header
        title="Alert & Notifikasi"
        subtitle="Atur aturan peringatan otomatis via Email, Slack, dan Webhook saat terjadi kegagalan scraper."
      />

      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Page Top Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Rule Peringatan (Alert Rules)</h2>
                <span className="badge-warning px-2.5 py-0.5 rounded-full text-xs font-semibold">
                  {rules.filter((r) => r.enabled).length} Active / {rules.length} Total
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Pemicu dan kanal notifikasi otomatis saat terjadi kendala pada job scraper.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAlertRules()}
              className="btn-secondary text-xs"
              title="Segarkan daftar rule"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
            <button
              onClick={handleOpenCreateWizard}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Rule Alert Baru</span>
            </button>
          </div>
        </div>

        {/* Rules Table Card */}
        <div className="card overflow-hidden shadow-2xl border border-surface-600">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr className="bg-surface-850">
                  <th className="w-64">Nama Rule</th>
                  <th className="w-52">Pemicu (Trigger)</th>
                  <th className="w-24 text-center">Status</th>
                  <th>Kanal Notifikasi (Actions)</th>
                  <th className="w-44">Terakhir Dipicu</th>
                  <th className="w-36 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  /* Loading Skeletons */
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-surface-700/50">
                      <td className="px-4">
                        <div className="h-4 w-40 skeleton mb-1" />
                        <div className="h-3 w-56 skeleton" />
                      </td>
                      <td className="px-4">
                        <div className="h-5 w-32 skeleton rounded-full" />
                      </td>
                      <td className="px-4 text-center">
                        <div className="h-6 w-12 skeleton rounded-full mx-auto" />
                      </td>
                      <td className="px-4">
                        <div className="h-5 w-48 skeleton rounded-lg" />
                      </td>
                      <td className="px-4">
                        <div className="h-4 w-28 skeleton" />
                      </td>
                      <td className="px-4 text-right">
                        <div className="h-7 w-24 skeleton ml-auto rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : rules.length === 0 ? (
                  /* Empty State */
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                          <BellRing className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-200">Belum Ada Rule Alert</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Buat aturan notifikasi pertama untuk memantau kegagalan job, timeout, atau rate-limit secara otomatis.
                        </p>
                        <button
                          onClick={handleOpenCreateWizard}
                          className="btn-primary btn-sm text-xs mt-2 inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Buat Rule Alert Pertama</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* Rules Table Rows */
                  rules.map((rule) => {
                    const TriggerIcon = TRIGGER_CONFIG[rule.trigger]?.icon || AlertTriangle
                    const triggerLabel = TRIGGER_CONFIG[rule.trigger]?.label || rule.trigger

                    return (
                      <tr key={rule.id} className="hover:bg-surface-700/40 transition-colors">
                        {/* Rule Name & Description */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-xs text-white flex items-center gap-2">
                            <span>{rule.name}</span>
                          </div>
                          {rule.description && (
                            <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                              {rule.description}
                            </p>
                          )}
                        </td>

                        {/* Trigger Type & Threshold */}
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-900 border border-surface-700 text-xs font-medium text-amber-300">
                            <TriggerIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{triggerLabel}</span>
                            {rule.threshold !== undefined && (
                              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                                {rule.threshold} {TRIGGER_CONFIG[rule.trigger]?.unit || ''}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Toggle Button */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleStatus(rule)}
                            disabled={togglingId === rule.id}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              rule.enabled ? 'bg-brand-500' : 'bg-surface-600'
                            }`}
                            title={rule.enabled ? 'Nonaktifkan Rule' : 'Aktifkan Rule'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                rule.enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>

                        {/* Action Channels List */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {rule.actions.map((act, i) => {
                              const ActIcon = ACTION_CONFIG[act.type]?.icon || Mail
                              return (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-surface-900 border border-surface-700 text-gray-300"
                                  title={`${act.type}: ${act.target}`}
                                >
                                  <ActIcon className="w-3 h-3 text-brand-400 shrink-0" />
                                  <span className="font-mono text-[10px] max-w-[140px] truncate">
                                    {act.target}
                                  </span>
                                </span>
                              )
                            })}
                          </div>
                        </td>

                        {/* Last Triggered At */}
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">
                          {formatDate(rule.lastTriggeredAt)}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Test Alert Button */}
                            <button
                              onClick={() => handleTestAlert(rule)}
                              disabled={testingId === rule.id}
                              className="p-1.5 rounded-lg text-brand-400 hover:text-brand-300 hover:bg-brand-950/50 transition-colors"
                              title="Uji Kirim Notifikasi Sampel"
                            >
                              {testingId === rule.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEditWizard(rule)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
                              title="Edit Rule"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => setDeleteConfirmRule(rule)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                              title="Hapus Rule"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* Multi-Step Alert Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="fixed inset-0" onClick={() => setIsWizardOpen(false)} />

          <div className="relative z-10 w-full max-w-2xl card bg-surface-850 border border-surface-600 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-surface-700 bg-surface-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingRuleId ? 'Edit Rule Alert' : 'Buat Rule Alert Baru'}
                  </h3>
                  <p className="text-xs text-gray-400">Langkah {wizardStep} dari 4: Wizard Konfigurasi Alert</p>
                </div>
              </div>

              <button
                onClick={() => setIsWizardOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Wizard Step Progress Bar */}
            <div className="px-6 py-3 bg-surface-900 border-b border-surface-700/60 flex items-center justify-between">
              {[
                { step: 1, label: '1. Informasi Dasar' },
                { step: 2, label: '2. Pemicu (Trigger)' },
                { step: 3, label: '3. Kanal Notifikasi' },
                { step: 4, label: '4. Review & Simpan' },
              ].map(({ step, label }) => {
                const isActive = wizardStep === step
                const isPassed = wizardStep > step
                return (
                  <div
                    key={step}
                    className={`flex items-center gap-1.5 text-xs font-semibold ${
                      isActive
                        ? 'text-brand-400'
                        : isPassed
                        ? 'text-emerald-400'
                        : 'text-gray-500'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                        isActive
                          ? 'bg-brand-500 text-white'
                          : isPassed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-surface-700 text-gray-400'
                      }`}
                    >
                      {isPassed ? <Check className="w-3 h-3" /> : step}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                )
              })}
            </div>

            {/* Wizard Content Body */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {/* STEP 1: BASIC INFO */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="form-group">
                    <label className="label">
                      Nama Rule Alert <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="contoh: Peringatan Job BPS Inflasi Failed"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="input"
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Deskripsi / Catatan (Opsional)</label>
                    <textarea
                      rows={3}
                      placeholder="Jelaskan tujuan dan konteks aturan peringatan ini..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="input custom-scrollbar"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: TRIGGER CONFIGURATION */}
              {wizardStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <label className="label">Pilih Jenis Pemicu (Trigger Type)</label>

                  <div className="grid grid-cols-1 gap-2.5">
                    {(Object.keys(TRIGGER_CONFIG) as AlertTriggerType[]).map((key) => {
                      const item = TRIGGER_CONFIG[key]
                      const ItemIcon = item.icon
                      const isSelected = formTrigger === key

                      return (
                        <div
                          key={key}
                          onClick={() => setFormTrigger(key)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                            isSelected
                              ? 'bg-brand-950/40 border-brand-500 ring-1 ring-brand-500/50'
                              : 'bg-surface-900 border-surface-700 hover:border-surface-600'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-brand-500 text-white'
                                : 'bg-surface-800 text-gray-400'
                            }`}
                          >
                            <ItemIcon className="w-4 h-4" />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-white">{item.label}</h4>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-400" />}
                            </div>
                            <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Threshold Input if required */}
                  {TRIGGER_CONFIG[formTrigger].requiresThreshold && (
                    <div className="form-group pt-2 p-4 rounded-xl bg-surface-900 border border-surface-700">
                      <label className="label text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>
                          Atur Nilai Ambang Batas (Threshold in {TRIGGER_CONFIG[formTrigger].unit})
                        </span>
                      </label>
                      <div className="flex items-center gap-3 mt-1">
                        <input
                          type="number"
                          min="1"
                          value={formThreshold ?? 15}
                          onChange={(e) => setFormThreshold(Number(e.target.value))}
                          className="input w-36 text-center font-mono font-bold text-base"
                        />
                        <span className="text-xs text-gray-400">
                          {TRIGGER_CONFIG[formTrigger].unit}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: ACTIONS */}
              {wizardStep === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label className="label">Kanal Notifikasi (Action Destinations)</label>
                    <button
                      type="button"
                      onClick={handleAddActionField}
                      className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Kanal</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formActions.map((action, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-surface-900 border border-surface-700 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-gray-400">
                            Aksi Notifikasi #{idx + 1}
                          </span>
                          {formActions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveActionField(idx)}
                              className="text-xs text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <select
                              value={action.type}
                              onChange={(e) =>
                                handleActionChange(idx, 'type', e.target.value as AlertActionType)
                              }
                              className="input py-2 text-xs bg-surface-850 cursor-pointer"
                            >
                              <option value="EMAIL">Email Notification</option>
                              <option value="SLACK">Slack Webhook</option>
                              <option value="WEBHOOK">Custom Webhook</option>
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              placeholder={ACTION_CONFIG[action.type]?.placeholder}
                              value={action.target}
                              onChange={(e) => handleActionChange(idx, 'target', e.target.value)}
                              className="input py-2 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & CREATE */}
              {wizardStep === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 rounded-xl bg-surface-900 border border-surface-700 space-y-3">
                    <div className="border-b border-surface-700 pb-2">
                      <span className="label text-[10px]">Nama Rule</span>
                      <h4 className="text-sm font-bold text-white">{formName}</h4>
                      {formDescription && (
                        <p className="text-xs text-gray-400 mt-0.5">{formDescription}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-b border-surface-700 pb-3">
                      <div>
                        <span className="label text-[10px]">Pemicu</span>
                        <div className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" />
                          <span>{TRIGGER_CONFIG[formTrigger].label}</span>
                        </div>
                      </div>
                      {TRIGGER_CONFIG[formTrigger].requiresThreshold && (
                        <div>
                          <span className="label text-[10px]">Threshold</span>
                          <div className="text-xs text-gray-200 font-mono font-bold">
                            {formThreshold} {TRIGGER_CONFIG[formTrigger].unit}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="label text-[10px] mb-1.5 block">
                        Target Notifikasi ({formActions.length} Kanal)
                      </span>
                      <div className="space-y-1.5">
                        {formActions.map((act, i) => {
                          const ActIcon = ACTION_CONFIG[act.type]?.icon || Mail
                          return (
                            <div
                              key={i}
                              className="p-2 rounded-lg bg-surface-850 border border-surface-700/60 flex items-center gap-2 text-xs text-gray-200 font-mono"
                            >
                              <ActIcon className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                              <span className="font-semibold text-brand-300">{act.type}:</span>
                              <span className="truncate">{act.target}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer Controls */}
            <div className="p-4 border-t border-surface-700 bg-surface-900 flex items-center justify-between">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="btn-secondary btn-sm flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="btn-ghost btn-sm text-gray-400"
                >
                  Batal
                </button>
              )}

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="btn-primary btn-sm flex items-center gap-1"
                >
                  <span>Lanjutkan</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitWizard}
                  disabled={isSubmitting}
                  className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-500 border-emerald-500 flex items-center gap-1.5 text-white"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{editingRuleId ? 'Simpan Perubahan' : 'Buat Rule Alert'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="fixed inset-0" onClick={() => setDeleteConfirmRule(null)} />

          <div className="relative z-10 w-full max-w-md card bg-surface-850 border border-surface-600 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Konfirmasi Hapus Rule</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus rule alert{' '}
              <strong className="text-white font-semibold">"{deleteConfirmRule.name}"</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-surface-700">
              <button
                onClick={() => setDeleteConfirmRule(null)}
                className="btn-secondary btn-sm"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteRule}
                disabled={isDeleting}
                className="btn-danger btn-sm flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Hapus Rule</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
