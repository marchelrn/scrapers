import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { configsApi } from '../api/configs'
import type { ScrapingConfig } from '../types'
import { ArrowLeft, Play, CheckCircle2, XCircle, Code2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function ConfigDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [config, setConfig] = useState<ScrapingConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    configsApi
      .getById(id)
      .then((res) => setConfig(res))
      .catch(() => toast.error('Gagal memuat detail konfigurasi'))
      .finally(() => setLoading(false))
  }, [id])

  const handleRun = async () => {
    if (!id) return
    try {
      const job = await configsApi.run(id)
      toast.success('Job scraping telah diantrekan!')
      navigate(`/jobs/${job.id}`)
    } catch (err: any) {
      toast.error('Gagal menjalankan job')
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

          <button onClick={handleRun} className="btn-primary text-xs py-2.5">
            <Play className="w-4 h-4" />
            <span>Jalankan Sekarang</span>
          </button>
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
                <span className={config.schedule_enabled ? 'text-emerald-400' : 'text-gray-400'}>
                  {config.schedule_enabled ? 'Enabled' : 'Disabled'}
                </span>
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
    </div>
  )
}
