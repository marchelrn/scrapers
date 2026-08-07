import { useState } from 'react'
import { Header } from '../components/layout/Header'
import { useAuthStore } from '../store/authStore'
import { usersApi } from '../api/users'
import { User, Mail, Lock, Shield, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function ProfilePage() {
  const { user, setUser } = useAuthStore()

  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const updated = await usersApi.updateProfile({
        name: name || undefined,
        email: email || undefined,
        password: password || undefined,
      })
      setUser(updated)
      toast.success('Profil berhasil diperbarui!')
      setPassword('')
    } catch (err: any) {
      toast.error('Gagal memperbarui profil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Header title="Pengaturan Profil Akun" subtitle="Ubah nama, email, atau kata sandi akun Anda." />

      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div className="card p-6 glass border-surface-600">
          <div className="flex items-center gap-4 border-b border-surface-700 pb-6 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-teal-400 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{user?.name}</h2>
              <p className="text-xs text-gray-400">{user?.email}</p>
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 capitalize">
                <Shield className="w-3 h-3" />
                <span>Role: {user?.role}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="label">Nama Lengkap</label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Alamat Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Kata Sandi Baru (Kosongkan jika tidak ingin mengubah)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 text-xs font-semibold mt-4"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
