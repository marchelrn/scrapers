import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Settings, Briefcase, Calendar,
  KeyRound, Users, LogOut, ChevronRight, Activity, User,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/configs',   label: 'Konfigurasi', icon: Settings },
  { to: '/jobs',      label: 'Jobs',        icon: Briefcase },
  { to: '/schedules', label: 'Jadwal',      icon: Calendar },
  { to: '/secrets',   label: 'Secrets',     icon: KeyRound },
]

const adminItems = [
  { to: '/users', label: 'Users', icon: Users },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-surface-900 border-r border-surface-700 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-surface-700">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-900/50">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">ScraperBPS</p>
          <p className="text-[10px] text-brand-400 font-medium uppercase tracking-widest">Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Menu Utama</p>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700/60'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-brand-500" />}
              </>
            )}
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <p className="px-3 mt-4 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Admin</p>
            {adminItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700/60'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                    <span className="flex-1">{label}</span>
                    {isActive && <ChevronRight className="w-3 h-3 text-brand-500" />}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-surface-700 space-y-1">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
              isActive ? 'bg-surface-700 text-gray-200' : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700/60'
            }`
          }
        >
          <div className="w-7 h-7 rounded-lg bg-brand-700/40 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-brand-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-300 truncate">{user?.name ?? 'User'}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-500
                     hover:text-red-400 hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
