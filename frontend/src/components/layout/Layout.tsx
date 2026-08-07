import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="flex min-h-screen bg-surface-950 text-gray-100 font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 bg-surface-950/60 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
