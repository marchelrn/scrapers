import React, { Component, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#050a0e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
          <div style={{ background: '#0f1c28', border: '1px solid #1e3347', borderRadius: '16px', padding: '32px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#f87171' }}>Aplikasi Mengalami Kendala Error</h2>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>{this.state.error?.message || 'Terjadi kesalahan pada rendering aplikasi.'}</p>
            <button
              onClick={() => {
                localStorage.clear()
                window.location.reload()
              }}
              style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              Reset Cache & Muat Ulang
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
