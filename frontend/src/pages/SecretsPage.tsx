import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { secretsApi } from '../api/secrets'
import type { Secret, SecretType } from '../types'
import {
  KeyRound, Plus, Trash2, Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'

export function SecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [secretType, setSecretType] = useState<SecretType>('bearer_token')
  const [secretValue, setSecretValue] = useState('')

  const fetchSecrets = async () => {
    try {
      const res = await secretsApi.getAll()
      setSecrets(res || [])
    } catch (err: any) {
      toast.error('Gagal mengambil daftar secret')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSecrets()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await secretsApi.create({
        name,
        description: description || undefined,
        secret_type: secretType,
        secret_value: secretValue,
      })
      toast.success('Secret credential berhasil disimpan secara aman!')
      setShowModal(false)
      setName('')
      setDescription('')
      setSecretValue('')
      fetchSecrets()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal menyimpan secret'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus secret ini dari repositori credential?')) return
    try {
      await secretsApi.delete(id)
      toast.success('Secret berhasil dihapus')
      setSecrets(secrets.filter((s) => s.id !== id))
    } catch (err: any) {
      toast.error('Gagal menghapus secret')
    }
  }

  return (
    <div>
      <Header
        title="Manajemen Secrets & Credential Target"
        subtitle="Simpan API Key, Bearer Token, atau Cookie otentikasi tanpa menyimpannya di plaintext."
      />

      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Daftar Credentials</h2>
            <p className="text-xs text-gray-400">Semua kredensial tersensor secara otomatis di log aplikasi</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            <span>Tambah Secret Baru</span>
          </button>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Secret</th>
                  <th>ID Referensi</th>
                  <th>Tipe Credential</th>
                  <th>Pembuat</th>
                  <th>Tanggal Dibuat</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 text-xs">
                      Memuat data secrets...
                    </td>
                  </tr>
                ) : secrets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500 text-xs">
                      Belum ada secret credential yang dibuat.
                    </td>
                  </tr>
                ) : (
                  secrets.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-surface-700 flex items-center justify-center text-brand-300">
                            <KeyRound className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">{s.name}</p>
                            {s.description && <p className="text-[11px] text-gray-500">{s.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-brand-300">{s.id}</td>
                      <td>
                        <span className="badge-info font-mono text-[10px] uppercase">
                          {s.secret_type}
                        </span>
                      </td>
                      <td className="text-xs text-gray-400 font-mono">{s.created_by || '-'}</td>
                      <td className="text-xs text-gray-400">
                        {new Date(s.created_at).toLocaleDateString('id-ID')}
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

      {/* Modal Create Secret */}
      {showModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg bg-surface-900 border-surface-600 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-surface-700 pb-3">
              <h3 className="text-sm font-bold text-white">Tambah Secret Credential Baru</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost btn-sm text-gray-400">Batal</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="form-group">
                <label className="label">Nama Secret</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BPS API Bearer Token"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </div>

              <div className="form-group">
                <label className="label">Deskripsi Opsional</label>
                <input
                  type="text"
                  placeholder="Keterangan kredensial..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input"
                />
              </div>

              <div className="form-group">
                <label className="label">Tipe Credential</label>
                <select
                  value={secretType}
                  onChange={(e) => setSecretType(e.target.value as SecretType)}
                  className="input"
                >
                  <option value="bearer_token">Bearer Token (Authorization: Bearer)</option>
                  <option value="api_key">API Key (x-api-key header)</option>
                  <option value="basic_auth">Basic Authentication</option>
                  <option value="cookie">Cookie Session Array (Playwright)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label">Nilai Rahasia (Secret Value)</label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOiJIUzI1Ni..."
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  className="input font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Nilai ini akan diinjeksi saat runtime worker dan tersensor sebagai ***REDACTED*** pada log.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full justify-center py-2.5 text-xs font-semibold mt-4"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Credential'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
