import { useState, useEffect, useRef } from 'react'
import { proxyApi, ProxyError } from '../../api/methods'
import { X, MousePointer, Check, Loader2, RefreshCw, Layers, CheckSquare, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

// Saran tindakan per jenis kegagalan. Pesan dari backend menjelaskan APA yang
// terjadi; baris ini menjelaskan APA YANG HARUS DILAKUKAN operator, sehingga
// kegagalan yang bukan kesalahannya tidak berhenti sebagai jalan buntu.
const PROXY_HINTS: Record<string, string> = {
  CHALLENGE_DETECTED:
    'Pemilihan visual tidak mungkin di situs ini. Isi selector secara manual, atau pilih teknik Headless / Cari Kata Kunci pada konfigurasi.',
  BLOCKED_403:
    'Situs ini menolak server platform, bukan isian Anda. Teknik Headless kadang masih berhasil karena menjalankan peramban sungguhan.',
  RATE_LIMITED_429: 'Tunggu beberapa menit, lalu tekan Muat Halaman lagi.',
  NOT_FOUND: 'Buka alamat ini di tab peramban biasa untuk memastikan halamannya memang ada.',
  VALIDATION_ERROR: 'Perbaiki alamat pada kolom di atas, lalu tekan Muat Halaman.',
  AUTH_FAILED: 'Halaman di balik login tidak dapat diambil platform ini.',
  UPSTREAM_ERROR: 'Masalah ada di sisi situs target. Coba lagi beberapa saat kemudian.',
  NETWORK_ERROR: 'Coba lagi; bila berulang, laporkan ke IPDS beserta alamat yang Anda pakai.',
  PROXY_AUTH_FAILED:
    'Kredensial proxy keluar platform ditolak. Ini murni konfigurasi server: laporkan ke IPDS, atau minta proxy dimatikan sementara agar penarikan berjalan langsung.',
  PROXY_ERROR:
    'Proxy keluar platform tidak dapat dihubungi. Laporkan ke IPDS; sementara itu tidak ada yang bisa Anda perbaiki dari sisi konfigurasi scraper.',
}

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
  // Dua angka yang berbeda dan sama-sama perlu dilihat operator: berapa elemen
  // yang ia klik, dan berapa elemen yang benar-benar akan terambil oleh selector
  // hasilnya. Keduanya berbeda begitu beberapa elemen sejenis digabung menjadi
  // satu selector induk -- dan selisihnya itulah yang mencegah kejutan saat job
  // dijalankan.
  const [selectionCount, setSelectionCount] = useState(0)
  const [selectionMatches, setSelectionMatches] = useState(0)
  // Alasan kegagalan ditahan di state, bukan hanya di toast: toast menghilang
  // setelah beberapa detik dan memotong pesan panjang, sedangkan penjelasan
  // "mengapa" inilah yang dibutuhkan operator untuk memutuskan langkah berikut.
  const [loadError, setLoadError] = useState<{ code: string; message: string; targetStatus?: number } | null>(null)
  // URL yang benar-benar diambil backend setelah pengalihan; selector disimpan
  // terhadap alamat ini, bukan terhadap alamat sebelum redirect.
  const [resolvedUrl, setResolvedUrl] = useState(initialUrl)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const loadTargetHtml = async (targetUrl: string) => {
    if (!targetUrl) return
    setLoading(true)
    setLoadError(null)
    setSelectedCss('')
    setHoveredCss('')
    setSelectionCount(0)
    setSelectionMatches(0)
    try {
      const { html, finalUrl } = await proxyApi.getHtml(targetUrl)
      setResolvedUrl(finalUrl)
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
    } catch (err) {
      // Backend sudah membedakan diblokir, dibatasi laju, halaman verifikasi,
      // alamat salah, dan situs mati. Menampilkan satu pesan generik untuk
      // semuanya membuat operator menyalahkan isiannya sendiri padahal yang
      // menolak adalah situs target.
      const proxyError =
        err instanceof ProxyError
          ? err
          : new ProxyError('UNKNOWN_ERROR', 'Gagal mengambil HTML target via proxy.')
      setLoadError({ code: proxyError.code, message: proxyError.message, targetStatus: proxyError.targetStatus })
      toast.error(proxyError.message, { duration: 8000 })
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
      .bps-picker-selected { outline: 3px solid #f59e0b !important; background: rgba(245, 158, 11, 0.3) !important; }
    `
    doc.head.appendChild(style)

    const ignoredClassPrefixes = [
      'flex', 'grid', 'col', 'row', 'items', 'justify', 'center', 'relative', 'absolute',
      'portrait', 'w-', 'h-', 'max-', 'min-', 'mx-', 'my-', 'px-', 'py-', 'pt-', 'pb-',
      'mt-', 'mb-', 'ml-', 'mr-', 'p-', 'pt-', 'pb-', 'pl-', 'pr-', 'rounded-', 'border-',
      'leading-', 'text-', 'gap-', 'z-', 'font-', 'bg-', 'st-', '__', 'bps-picker',
      'sm:', 'md:', 'lg:', 'xl:', '2xl:', 'hover:', 'focus:', 'group-'
    ]

    // Nama class perlu di-escape, bukan dibuang. Class Tailwind responsif
    // (`md:mt-4`) memuat titik dua yang tidak sah dalam selector kecuali
    // di-escape; versi sebelumnya membuangnya, sehingga elemen yang HANYA
    // dikenali oleh class semacam itu kehilangan penandanya.
    const escapeIdent = (value: string): string => {
      const globalCss = (doc.defaultView as (Window & typeof globalThis) | null)?.CSS
      if (globalCss && typeof globalCss.escape === 'function') return globalCss.escape(value)
      return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`)
    }

    const keptClasses = (el: Element): string[] => {
      const raw = typeof el.className === 'string' ? el.className : ''
      if (!raw) return []
      return raw
        .trim()
        .split(/\s+/)
        .filter((cls) => cls && !ignoredClassPrefixes.some((prefix) => cls.startsWith(prefix)))
    }

    // Satu compound selector untuk satu elemen: tag + class penanda, dan
    // :nth-of-type HANYA bila class belum cukup membedakannya dari saudara
    // sekandung. Versi sebelumnya selalu menempelkan :nth-of-type begitu ada
    // saudara bertag sama, sehingga selector terikat pada posisi persis dan
    // langsung gagal ketika situs menambah satu elemen di atasnya.
    const compoundFor = (el: Element, withPosition: boolean): string => {
      const tag = el.nodeName.toLowerCase()
      let compound = tag + keptClasses(el).map((cls) => `.${escapeIdent(cls)}`).join('')
      const parent = el.parentElement
      if (!parent || !withPosition) return compound

      let ambiguous = false
      try {
        ambiguous = Array.from(parent.children).filter((child) => child.matches(compound)).length > 1
      } catch {
        ambiguous = true
      }
      if (ambiguous) {
        const sameTag = Array.from(parent.children).filter(
          (child) => child.nodeName.toLowerCase() === tag,
        )
        if (sameTag.length > 1) {
          compound += `:nth-of-type(${sameTag.indexOf(el) + 1})`
        }
      }
      return compound
    }

    // el.matches() menilai selector lengkap termasuk bagian leluhurnya, jadi
    // hasilnya sama dengan menyaring querySelectorAll -- tanpa menelusuri
    // seluruh dokumen setiap kali kursor bergerak.
    const matchesTarget = (selector: string, el: Element): boolean => {
      if (!selector) return false
      try {
        return el.matches(selector)
      } catch {
        return false
      }
    }

    const countMatches = (selector: string): number => {
      try {
        return doc.querySelectorAll(selector).length
      } catch {
        return 0
      }
    }

    const generateSelector = (el: HTMLElement): string => {
      if (el.id) return `#${escapeIdent(el.id)}`

      // Rantai penuh dari elemen ke atas, berhenti pada leluhur yang punya id.
      const chain: string[] = []
      let curr: Element | null = el
      while (curr && curr.nodeType === Node.ELEMENT_NODE) {
        const tag = curr.nodeName.toLowerCase()
        if (tag === 'html' || tag === 'body') break
        if (curr !== el && curr.id) {
          chain.unshift(`#${escapeIdent(curr.id)}`)
          break
        }
        chain.unshift(compoundFor(curr, true))
        curr = curr.parentElement
      }
      if (chain.length === 0) return el.nodeName.toLowerCase()

      // Pangkas dari atas selama selector masih menunjuk elemen yang sama.
      // Selector terpendek yang tetap benar adalah yang paling tahan terhadap
      // perubahan tata letak halaman -- dan yang paling bisa dibaca operator.
      let best = chain.join(' > ')
      for (let cut = 1; cut < chain.length; cut++) {
        const shorter = chain.slice(cut).join(' > ')
        if (!matchesTarget(shorter, el)) break
        if (countMatches(shorter) !== countMatches(best)) break
        best = shorter
      }

      // Jaring pengaman: bila hasil pemangkasan ternyata tidak menunjuk elemen
      // ini, kembalikan rantai penuh. Selector yang tidak cocok dengan apa pun
      // adalah kegagalan yang paling membingungkan bagi operator.
      return matchesTarget(best, el) ? best : chain.join(' > ')
    }

    // Beberapa elemen sejenis di bawah satu induk (mis. lima paragraf artikel)
    // sebaiknya menjadi SATU selector `induk > tag`, bukan lima selector
    // berposisi. Selain jauh lebih pendek, hasilnya tetap benar ketika artikel
    // bertambah satu paragraf -- dan itulah maksud operator ketika ia menyapu
    // beberapa paragraf sekaligus.
    const combineSelectors = (elements: HTMLElement[]): string => {
      if (elements.length === 0) return ''
      if (elements.length === 1) return generateSelector(elements[0])

      const first = elements[0]
      const parent = first.parentElement
      const tag = first.nodeName.toLowerCase()
      const sameGroup = elements.every(
        (el) => el.parentElement === parent && el.nodeName.toLowerCase() === tag,
      )

      if (parent && sameGroup) {
        const parentSelector = parent.id
          ? `#${escapeIdent(parent.id)}`
          : generateSelector(parent as HTMLElement)
        const shared = keptClasses(first).filter((cls) =>
          elements.every((el) => keptClasses(el).includes(cls)),
        )
        const childCompound = tag + shared.map((cls) => `.${escapeIdent(cls)}`).join('')
        const grouped = `${parentSelector} > ${childCompound}`
        if (elements.every((el) => matchesTarget(grouped, el))) return grouped
      }

      return Array.from(new Set(elements.map((el) => generateSelector(el)))).join(', ')
    }

    let lastHovered: HTMLElement | null = null
    // Elemen disimpan, bukan string selector-nya. Dengan menyimpan string,
    // penggabungan beberapa paragraf menjadi satu selector induk tidak mungkin
    // dilakukan, dan dua elemen berbeda yang kebetulan menghasilkan selector
    // sama akan saling menimpa.
    const selected: HTMLElement[] = []

    const publishSelection = () => {
      const combined = combineSelectors(selected)
      setSelectedCss(combined)
      setSelectionCount(selected.length)
      setSelectionMatches(combined ? countMatches(combined) : 0)
    }

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

    doc.body.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const target = e.target as HTMLElement
      const isMulti = e.ctrlKey || e.metaKey

      if (isMulti) {
        const at = selected.indexOf(target)
        if (at >= 0) {
          target.classList.remove('bps-picker-selected')
          selected.splice(at, 1)
        } else {
          target.classList.add('bps-picker-selected')
          selected.push(target)
        }
      } else {
        doc.querySelectorAll('.bps-picker-selected').forEach((el) => el.classList.remove('bps-picker-selected'))
        selected.length = 0
        target.classList.add('bps-picker-selected')
        selected.push(target)
      }

      publishSelection()
    })
  }

  const handleConfirm = () => {
    if (!selectedCss) {
      toast.error('Pilih elemen di dalam pratinjau halaman terlebih dahulu')
      return
    }
    onSelectSelector(selectedCss, resolvedUrl)
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
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Visual Selector (Point & Click)</span>
              </h3>
              <p className="text-xs text-gray-400">Arahkan kursor & klik elemen target untuk membuat CSS Selector otomatis</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Tahan <strong>Ctrl / Cmd</strong> untuk memilih &gt; 1 elemen</span>
            </span>

            <button onClick={onClose} className="btn-ghost btn-icon text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
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

          {loadError && !loading && (
            <div className="absolute inset-0 z-10 bg-surface-950 flex items-center justify-center p-8">
              <div className="max-w-xl w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                  <div className="min-w-0 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-red-200">Halaman target tidak dapat diambil</h4>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">{loadError.message}</p>
                    </div>
                    {PROXY_HINTS[loadError.code] && (
                      <p className="text-xs text-amber-200 leading-relaxed">{PROXY_HINTS[loadError.code]}</p>
                    )}
                    <p className="font-mono text-[11px] text-gray-500">
                      {loadError.code}
                      {loadError.targetStatus ? ` \u00b7 status situs target: ${loadError.targetStatus}` : ''}
                    </p>
                    <button onClick={() => loadTargetHtml(url)} className="btn-secondary btn-sm">
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Coba Lagi</span>
                    </button>
                  </div>
                </div>
              </div>
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
              <CheckSquare className="w-3.5 h-3.5 text-brand-400" />
              <span>CSS Selector Terpilih ({selectionCount} elemen diklik):</span>
              {selectedCss && (
                <span className={selectionMatches === 0 ? 'text-red-300 normal-case' : 'text-brand-300 normal-case'}>
                  selector ini mencocokkan {selectionMatches} elemen di halaman
                </span>
              )}
            </p>
            <p className="font-mono text-xs text-amber-300 bg-surface-900 px-3 py-2 rounded-xl border border-surface-700 truncate" title={selectedCss || hoveredCss}>
              {selectedCss || hoveredCss || 'Belum ada elemen yang diklik'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onClose} className="btn-secondary text-xs">
              Batal
            </button>
            <button onClick={handleConfirm} className="btn-primary text-xs">
              <Check className="w-4 h-4" />
              <span>Gunakan Selector Ini{selectionMatches > 1 ? ` (${selectionMatches} elemen)` : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
