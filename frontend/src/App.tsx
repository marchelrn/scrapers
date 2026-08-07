import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/shared/ProtectedRoute'

import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ConfigsPage } from './pages/ConfigsPage'
import { ConfigDetailPage } from './pages/ConfigDetailPage'
import { JobsPage } from './pages/JobsPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { SchedulesPage } from './pages/SchedulesPage'
import { SecretsPage } from './pages/SecretsPage'
import { UsersPage } from './pages/UsersPage'
import { ProfilePage } from './pages/ProfilePage'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0f1c28',
            color: '#fff',
            border: '1px solid #1e3347',
            fontSize: '12px',
          },
        }}
      />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/configs" element={<ConfigsPage />} />
            <Route path="/configs/:id" element={<ConfigDetailPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/secrets" element={<SecretsPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Admin only route */}
            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
