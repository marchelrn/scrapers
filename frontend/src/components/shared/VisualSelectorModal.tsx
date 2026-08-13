import { useState, useEffect, useRef } from 'react'
import { proxyApi } from '../../api/methods'
import { X, MousePointer, Check, Loader2, RefreshCw, Layers } from 'lucide-react'
import toast from 'react-hot-toast'

interface VisualSelectorModalProps {
  initialUrl: string
  onSelectSelector: (selector: string, finalUrl?: string) => void
  onClose: () => void
}

export function VisualSelectorModal({ initialUrl, onSelectSelector, onClose }: VisualSelectorModalProps) {
  const [url, setUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(false)
  const [selectedCss, setSelectedCss] = useState('')
  const [hoveredCss, setHoveredCss] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const loadTargetHtml = async (targetUrl: string) => {
    if (!targetUrl) return
    setLoading(true)
    try {
      const html = await proxyApi.getHtml(targetUrl)
      if (iframeRef.current) {
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
        if (doc) {
          doc.open()
          doc.write(html)
          doc.close()

          // Inject styling & event listeners for element picker
          injectPickerScript(doc)
        }
      }
    } catch {
      toast.error('Gagal mengambil HTML target via proxy')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialUrl) {
      loadTargetHtml(initialUrl)
    }
  }, [initialUrl])

  // Helper script injected into the proxy HTML inside the iframe
  const injectPickerScript = (doc: Document) => {
    const style = doc.createElement('style')
    style.innerHTML = `
      .bps-picker-hover { outline: 2px solid #14b8a6 !important; background: rgba(20, 184, 166, 0.15) !important; cursor: pointer !important; }
      .bps-picker-selected { outline: 3px solid #f59e0b !important; background: rgba(245, 158, 11, 0.25) !important; }
    `
    doc.head.appendChild(style)

    const generateSelector = (el: HTMLElement): string => {
      if (el.id) return `#${el.id}`
      let path: string[] = []
      let curr: HTMLElement | null = el
      while (curr && curr.nodeType === Node.ELEMENT_NODE) {
        let selector = curr.nodeName.toLowerCase()
        if (curr.className && typeof curr.className === 'string') {
          const classes = curr.className.trim().split(/\s+/).filter(c => !c.startsWith('bps-picker')).join('.')
          if (classes) selector += `.${classes}`
        }
        path.unshift(selector)
        if (curr.id) {
          path[0] = `#${curr.id}`
          break
        }
        curr = curr.parentElement
      }
      return path.join(' > ')
    }

    let lastHovered: HTMLElement | null = null

    doc.body.addEventListener('mouseover', (e) => {
      e.stopPropagation()
      const target = e.target as HTMLElement
      if (lastHovered && lastHovered !== target) {
        lastHovered.classList.remove('bps-picker-hover')
      }
      target.classList.add('bps-picker-hover')
      lastHovered = target
      setHoveredCss(generateSelector(target))
    })

    doc.body.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const target = e.target as HTMLElement
      doc.querySelectorAll('.bps-picker-selected').forEach((el) => el.classList.remove('bps-picker-selected'))
      target.classList.add('bps-picker-selected')
      const sel = generateSelector(target)
      setSelectedCss(sel)
    })
  }

  const handleConfirm = () => {
    if (!selectedCss) {
      toast.error('Pilih elemen di dalam pratinjau halaman terlebih dahulu')
      return
    }
    onSelectSelector(selectedCss, url)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="card w-full max-w-6xl h-[90vh] flex flex-col bg-surface-900 border-surface-600 shadow-2xl overflow-hidden">
        {/* Modal Topbar */}
        <div className="px-6 py-4 border-b border-surface-700 flex items-center justify-between bg-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-300 flex items-center justify-center">
              <MousePointer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Visual Selector (Point & Click)</h3>
              <p className="text-xs text-gray-400">Arahkan kursor & klik elemen target untuk membuat CSS Selector otomatis</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* URL Bar */}
        <div className="px-6 py-3 border-b border-surface-700 bg-surface-850 flex items-center gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://bps.go.id/target-halaman"
            className="input text-xs flex-1"
          />
          <button
            onClick={() => loadTargetHtml(url)}
            disabled={loading}
            className="btn-secondary btn-sm"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Muat Halaman</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 relative bg-white overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-gray-300 gap-3">
              <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
              <p className="text-xs">Mengambil HTML target via Proxy Backend...</p>
            </div>
          )}

          <iframe
            ref={iframeRef}
            title="Visual Selector Sandbox"
            className="w-full h-full border-none"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>

        {/* Footer Selector Details & Actions */}
        <div className="px-6 py-4 border-t border-surface-700 bg-surface-850 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-400" />
              <span>CSS Selector Terpilih:</span>
            </p>
            <p className="font-mono text-xs text-amber-300 bg-surface-900 px-3 py-2 rounded-xl border border-surface-700 truncate">
              {selectedCss || hoveredCss || 'Belum ada elemen yang diklik'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onClose} className="btn-secondary text-xs">
              Batal
            </button>
            <button onClick={handleConfirm} className="btn-primary text-xs">
              <Check className="w-4 h-4" />
              <span>Gunakan Selector Ini</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
