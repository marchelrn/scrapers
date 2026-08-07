import { useAuthStore } from '../../store/authStore'
import { Bell, Shield } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuthStore()

  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-surface-700/80 bg-surface-900/50 backdrop-blur-md sticky top-0 z-30">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Role Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-800 border border-surface-600">
          <Shield className="w-3.5 h-3.5 text-brand-400" />
          <span className="capitalize text-gray-300">{user?.role ?? 'Operator'}</span>
        </div>

        {/* User indicator */}
        <div className="flex items-center gap-3 pl-4 border-l border-surface-700">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-teal-400 flex items-center justify-center font-bold text-xs text-white shadow-sm">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
        </div>
      </div>
    </header>
  )
}
