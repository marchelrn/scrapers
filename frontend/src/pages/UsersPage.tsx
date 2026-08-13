import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { usersApi } from '../api/users'
import type { UserResponse } from '../types'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function UsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    try {
      const res = await usersApi.getAll()
      setUsers(res || [])
    } catch {
      toast.error('Gagal mengambil daftar pengguna')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleRoleChange = async (user: UserResponse, newRole: string) => {
    try {
      await usersApi.updateAsAdmin(user.id, { role: newRole })
      toast.success(`Role ${user.name} diubah menjadi ${newRole}`)
      fetchUsers()
    } catch {
      toast.error('Gagal memperbarui role user')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus akun user ini?')) return
    try {
      await usersApi.delete(id)
      toast.success('Pengguna berhasil dihapus')
      setUsers(users.filter((u) => u.id !== id))
    } catch {
      toast.error('Gagal menghapus user')
    }
  }

  return (
    <div>
      <Header
        title="Manajemen Pengguna System (Admin Only)"
      />

      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Daftar Pengguna</h2>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Pengguna</th>
                  <th>Email Address</th>
                  <th>Role</th>
                  <th>ID Account</th>
                  <th>Terdaftar</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 text-xs">
                      Memuat daftar pengguna...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500 text-xs">
                      Tidak ada pengguna terdaftar.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-semibold text-xs text-white">{u.name}</td>
                      <td className="text-xs text-gray-300">{u.email}</td>
                      <td>
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          className="bg-surface-900 border border-surface-700 rounded-lg text-xs px-2 py-1 text-brand-300 font-semibold cursor-pointer"
                        >
                          <option value="operator">Operator</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="font-mono text-xs text-gray-500">{u.id.substring(0, 13)}...</td>
                      <td className="text-xs text-gray-400">
                        {new Date(u.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleDelete(u.id)}
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
    </div>
  )
}
