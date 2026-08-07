import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { Activity, Lock, Mail, User, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'operator'>('operator')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isRegister) {
        await authApi.register({ name, email, password, role })
        toast.success('Registrasi berhasil! Silakan login.')
        setIsRegister(false)
      } else {
        const res = await authApi.login({ email, password })
        login(res.authorization.token, res.user)
        toast.success(`Selamat datang kembali, ${res.user.name}!`)
        navigate('/dashboard')
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Terjadi kesalahan pada server'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow Deco */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md card p-8 glass relative z-10 shadow-2xl border border-surface-600">
        {/* Header Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-900/60 mb-3">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isRegister ? 'Buat Akun Baru' : 'Login ke Platform'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {isRegister
              ? 'Daftarkan diri Anda untuk mengelola scraping BPS'
              : 'Masukkan kredensial Anda untuk mengakses dashboard'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-300 text-xs animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="form-group">
              <label className="label">Nama Lengkap</label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="label">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder="user@bps.go.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Kata Sandi</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div className="form-group">
              <label className="label">Role Akun</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'operator')}
                className="input"
              >
                <option value="operator">Operator (Pengelola Scraper)</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3 mt-6 text-sm font-semibold"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRegister ? (
              'Daftar Akun'
            ) : (
              'Masuk Sekarang'
            )}
          </button>
        </form>

        {/* Footer switch */}
        <div className="mt-6 pt-6 border-t border-surface-700/60 text-center">
          <p className="text-xs text-gray-400">
            {isRegister ? 'Sudah memiliki akun?' : 'Belum memiliki akun?'}
            <button
              onClick={() => {
                setIsRegister(!isRegister)
                setError(null)
              }}
              className="ml-1 text-brand-400 font-semibold hover:underline"
            >
              {isRegister ? 'Login di sini' : 'Daftar sekarang'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
