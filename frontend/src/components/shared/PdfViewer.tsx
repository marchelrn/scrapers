import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import {
  ZoomIn, ZoomOut, RotateCw, Download, Printer, Maximize2,
  Minimize2, ChevronLeft, ChevronRight, Search, X, PanelLeftClose,
  PanelLeft, RefreshCw, FileText, ChevronDown, Check, ArrowUp, ArrowDown,
  ExternalLink, Layers, RotateCcw
} from 'lucide-react'

// Set worker source
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

export interface PdfViewerRef {
  goToPage: (pageNum: number) => void
  search: (query: string) => void
}

interface SearchMatch {
  pageNumber: number
  indexInPage: number
  totalInPage: number
  globalIndex: number
}

interface PdfViewerProps {
  url: string
  title?: string
  initialScale?: number
  onPageChange?: (page: number, total: number) => void
}

interface PageTextData {
  pageNumber: number
  text: string
  items: Array<{ str: string; transform: number[]; width: number; height: number }>
}

export const PdfViewer = forwardRef<PdfViewerRef, PdfViewerProps>(function PdfViewer(
  { url, title = 'Dokumen Panduan', initialScale = 1.2, onPageChange },
  ref
) {
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageInputValue, setPageInputValue] = useState<string>('1')
  const [scale, setScale] = useState<number>(initialScale)
  const [rotation, setRotation] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  // Search States
  const [searchOpen, setSearchOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [pagesTextData, setPagesTextData] = useState<PageTextData[]>([])
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1)

  // Zoom preset dropdown
  const [zoomDropdownOpen, setZoomDropdownOpen] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 1. Scroll to specific page
  const scrollToPage = useCallback(
    (pageNum: number) => {
      if (pageNum < 1 || (numPages > 0 && pageNum > numPages)) return
      setCurrentPage(pageNum)
      setPageInputValue(String(pageNum))
      onPageChange?.(pageNum, numPages)

      const targetEl = pageRefs.current[pageNum - 1]
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [numPages, onPageChange]
  )

  // Expose methods to parent components
  useImperativeHandle(
    ref,
    () => ({
      goToPage: (pageNum: number) => {
        scrollToPage(pageNum)
      },
      search: (query: string) => {
        setSearchOpen(true)
        setSearchQuery(query)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      },
    }),
    [scrollToPage]
  )

  // 2. Load PDF Document
  const loadPdf = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const loadingTask = pdfjsLib.getDocument({
        url,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/cmaps/',
        cMapPacked: true,
      })

      const doc = await loadingTask.promise
      setPdfDoc(doc)
      setNumPages(doc.numPages)
      pageRefs.current = new Array(doc.numPages).fill(null)
      onPageChange?.(1, doc.numPages)

      // Extract text content from all pages for instant in-document search
      const textData: PageTextData[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        try {
          const page = await doc.getPage(i)
          const textContent = await page.getTextContent()
          const fullText = textContent.items.map((item: any) => item.str || '').join(' ')
          textData.push({
            pageNumber: i,
            text: fullText,
            items: textContent.items as any,
          })
        } catch (e) {
          console.warn(`Failed extracting text from page ${i}:`, e)
        }
      }
      setPagesTextData(textData)
    } catch (err: any) {
      console.error('Failed to load PDF:', err)
      setError(err?.message || 'Gagal memuat dokumen PDF. Pastikan file tersedia.')
    } finally {
      setLoading(false)
    }
  }, [url, onPageChange])

  useEffect(() => {
    loadPdf()
  }, [loadPdf])

  // 3. Search Functionality
  useEffect(() => {
    if (!searchQuery.trim() || pagesTextData.length === 0) {
      setMatches([])
      setActiveMatchIndex(-1)
      return
    }

    const q = searchQuery.toLowerCase()
    const foundMatches: SearchMatch[] = []
    let globalCounter = 0

    pagesTextData.forEach((page) => {
      const pText = page.text.toLowerCase()
      let startIdx = 0
      let matchInPageIdx = 0

      while (startIdx < pText.length) {
        const foundAt = pText.indexOf(q, startIdx)
        if (foundAt === -1) break

        foundMatches.push({
          pageNumber: page.pageNumber,
          indexInPage: matchInPageIdx,
          totalInPage: 0,
          globalIndex: globalCounter,
        })
        globalCounter++
        matchInPageIdx++
        startIdx = foundAt + q.length
      }
    })

    // Count totals per page
    foundMatches.forEach((m) => {
      const pageTotal = foundMatches.filter((x) => x.pageNumber === m.pageNumber).length
      m.totalInPage = pageTotal
    })

    setMatches(foundMatches)
    if (foundMatches.length > 0) {
      setActiveMatchIndex(0)
      scrollToPage(foundMatches[0].pageNumber)
    } else {
      setActiveMatchIndex(-1)
    }
  }, [searchQuery, pagesTextData, scrollToPage])

  const nextMatch = () => {
    if (matches.length === 0) return
    const nextIdx = (activeMatchIndex + 1) % matches.length
    setActiveMatchIndex(nextIdx)
    scrollToPage(matches[nextIdx].pageNumber)
  }

  const prevMatch = () => {
    if (matches.length === 0) return
    const prevIdx = (activeMatchIndex - 1 + matches.length) % matches.length
    setActiveMatchIndex(prevIdx)
    scrollToPage(matches[prevIdx].pageNumber)
  }

  // Track current visible page when scrolling
  useEffect(() => {
    if (!viewerContainerRef.current) return

    const handleScroll = () => {
      const container = viewerContainerRef.current
      if (!container) return
      const containerTop = container.scrollTop + container.clientHeight / 4

      let visiblePage = 1
      for (let i = 0; i < pageRefs.current.length; i++) {
        const el = pageRefs.current[i]
        if (el && el.offsetTop <= containerTop) {
          visiblePage = i + 1
        }
      }
      setCurrentPage(visiblePage)
      setPageInputValue(String(visiblePage))
    }

    const container = viewerContainerRef.current
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [numPages])

  // Keyboard Shortcuts (Ctrl+F for search, + / - for zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      } else if (e.key === 'Enter' && searchOpen) {
        if (e.shiftKey) prevMatch()
        else nextMatch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen, matches, activeMatchIndex])

  // Zoom Helpers
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.15, 3.0))
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.15, 0.4))
  const resetScale = () => setScale(1.0)

  const fitToWidth = () => {
    if (!viewerContainerRef.current) return
    const containerWidth = viewerContainerRef.current.clientWidth - (sidebarOpen ? 40 : 80)
    const calculatedScale = Math.max(0.5, Math.min(containerWidth / 620, 2.5))
    setScale(Number(calculatedScale.toFixed(2)))
  }

  const fitToPage = () => {
    if (!viewerContainerRef.current) return
    const containerHeight = viewerContainerRef.current.clientHeight - 80
    const calculatedScale = Math.max(0.4, Math.min(containerHeight / 860, 2.0))
    setScale(Number(calculatedScale.toFixed(2)))
  }

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const handlePrint = () => {
    const printWindow = window.open(url, '_blank')
    if (printWindow) {
      printWindow.focus()
      printWindow.print()
    }
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = url
    link.download = 'Panduan-Sistem-SiAPA-BPS.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-surface-950 border border-surface-700 rounded-2xl overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : 'h-[820px] w-full'
      }`}
    >
      {/* ---------------- MAIN TOOLBAR ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-surface-900 border-b border-surface-700/80 shrink-0 select-none">
        {/* Left: Sidebar Toggle, Title & Page Nav */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-xl text-xs transition-colors border ${
              sidebarOpen
                ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                : 'text-gray-400 hover:text-white hover:bg-surface-800 border-surface-700'
            }`}
            title={sidebarOpen ? 'Tutup Panel Halaman' : 'Buka Panel Halaman'}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>

          <div className="hidden md:flex items-center gap-2 pl-1 pr-3 border-r border-surface-700">
            <FileText className="w-4 h-4 text-brand-400 shrink-0" />
            <span className="text-xs font-semibold text-gray-200 truncate max-w-[200px]">{title}</span>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-1.5 bg-surface-800/80 px-2 py-1 rounded-xl border border-surface-700">
            <button
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 text-xs">
              <input
                type="number"
                min={1}
                max={numPages || 1}
                value={pageInputValue}
                onChange={(e) => setPageInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt(pageInputValue, 10)
                    if (!isNaN(val) && val >= 1 && val <= numPages) {
                      scrollToPage(val)
                    } else {
                      setPageInputValue(String(currentPage))
                    }
                  }
                }}
                onBlur={() => {
                  const val = parseInt(pageInputValue, 10)
                  if (!isNaN(val) && val >= 1 && val <= numPages) {
                    scrollToPage(val)
                  } else {
                    setPageInputValue(String(currentPage))
                  }
                }}
                className="w-9 bg-surface-900 border border-surface-600 rounded-lg px-1 py-0.5 text-center text-xs font-mono font-semibold text-brand-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-gray-400 text-xs font-mono">/ {numPages || '-'}</span>
            </div>

            <button
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Halaman Selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-surface-800/80 px-2 py-1 rounded-xl border border-surface-700">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.4}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 disabled:opacity-30 transition-colors"
            title="Perkecil (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Preset Selector */}
          <div className="relative">
            <button
              onClick={() => setZoomDropdownOpen(!zoomDropdownOpen)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-medium text-gray-300 hover:text-white hover:bg-surface-700 transition-colors"
            >
              <span>{Math.round(scale * 100)}%</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {zoomDropdownOpen && (
              <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 w-28 bg-surface-800 border border-surface-600 rounded-xl shadow-xl py-1 z-30">
                {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setScale(preset)
                      setZoomDropdownOpen(false)
                    }}
                    className={`flex items-center justify-between w-full px-3 py-1 text-xs font-mono transition-colors ${
                      Math.abs(scale - preset) < 0.05
                        ? 'text-brand-300 bg-brand-500/10 font-bold'
                        : 'text-gray-300 hover:bg-surface-700 hover:text-white'
                    }`}
                  >
                    <span>{Math.round(preset * 100)}%</span>
                    {Math.abs(scale - preset) < 0.05 && <Check className="w-3 h-3 text-brand-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 disabled:opacity-30 transition-colors"
            title="Perbesar (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={resetScale}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 transition-colors"
            title="Reset Zoom (100%)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-surface-700 mx-0.5" />

          <button
            onClick={fitToWidth}
            className="px-2 py-1 rounded-lg text-[11px] font-medium text-gray-400 hover:text-brand-300 hover:bg-surface-700 transition-colors"
            title="Sesuaikan Lebar Halaman"
          >
            Lebar
          </button>

          <button
            onClick={fitToPage}
            className="px-2 py-1 rounded-lg text-[11px] font-medium text-gray-400 hover:text-brand-300 hover:bg-surface-700 transition-colors"
            title="Sesuaikan 1 Halaman Penuh"
          >
            Penuh
          </button>
        </div>

        {/* Right: Search, Rotate & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Search Toggle */}
          <button
            onClick={() => {
              setSearchOpen(!searchOpen)
              if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50)
            }}
            className={`p-2 rounded-xl text-xs transition-colors border ${
              searchOpen || searchQuery
                ? 'bg-brand-600/20 text-brand-300 border-brand-500/40'
                : 'text-gray-400 hover:text-white hover:bg-surface-800 border-surface-700'
            }`}
            title="Cari Teks di PDF (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Rotate */}
          <button
            onClick={rotate}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-surface-800 border border-surface-700 transition-colors"
            title="Putar Dokumen (90°)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="p-2 rounded-xl text-gray-400 hover:text-brand-300 hover:bg-brand-500/10 border border-surface-700 hover:border-brand-500/30 transition-colors"
            title="Unduh PDF"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="hidden sm:block p-2 rounded-xl text-gray-400 hover:text-white hover:bg-surface-800 border border-surface-700 transition-colors"
            title="Cetak Dokumen"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-surface-800 border border-surface-700 transition-colors"
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ---------------- SEARCH BAR OVERLAY ---------------- */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-800/95 backdrop-blur-md border-b border-surface-700/80 animate-slide-up z-20">
          <Search className="w-4 h-4 text-brand-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Cari kata kunci di panduan (misal: visual selector, cron, anti-blokir)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-surface-900/90 border border-surface-600 rounded-xl px-3 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
          />

          {searchQuery && (
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-surface-700 text-gray-300 whitespace-nowrap">
              {matches.length > 0
                ? `${activeMatchIndex + 1} / ${matches.length} hasil`
                : '0 ditemukan'}
            </span>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={prevMatch}
              disabled={matches.length === 0}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 disabled:opacity-30 transition-colors"
              title="Hasil Sebelumnya (Shift+Enter)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={nextMatch}
              disabled={matches.length === 0}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 disabled:opacity-30 transition-colors"
              title="Hasil Selanjutnya (Enter)"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => {
              setSearchQuery('')
              setSearchOpen(false)
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-surface-700 transition-colors"
            title="Tutup Pencarian (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ---------------- VIEWER BODY: SIDEBAR + CANVASES ---------------- */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar: Page Thumbnails */}
        {sidebarOpen && (
          <aside className="w-56 bg-surface-900 border-r border-surface-700 flex flex-col shrink-0 overflow-y-auto p-3 space-y-3 select-none">
            <div className="flex items-center justify-between pb-2 border-b border-surface-800">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-400" />
                Halaman ({numPages})
              </span>
            </div>

            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
              const hasMatch = matches.some((m) => m.pageNumber === pageNum)
              const matchCount = matches.filter((m) => m.pageNumber === pageNum).length

              return (
                <div
                  key={pageNum}
                  onClick={() => scrollToPage(pageNum)}
                  className={`group flex flex-col items-center p-2 rounded-xl border cursor-pointer transition-all duration-200 ${
                    currentPage === pageNum
                      ? 'bg-brand-500/15 border-brand-500/50 shadow-md shadow-brand-950/40'
                      : 'bg-surface-800/40 border-surface-700 hover:bg-surface-800 hover:border-surface-600'
                  }`}
                >
                  <div className="w-full aspect-[1/1.414] bg-white rounded-md flex items-center justify-center relative overflow-hidden shadow-inner">
                    <PdfThumbnail
                      pdfDoc={pdfDoc}
                      pageNumber={pageNum}
                    />
                    {hasMatch && (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-black shadow">
                        {matchCount} match
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between w-full mt-1.5 px-1">
                    <span
                      className={`text-[11px] font-medium ${
                        currentPage === pageNum ? 'text-brand-300 font-bold' : 'text-gray-400 group-hover:text-gray-200'
                      }`}
                    >
                      Halaman {pageNum}
                    </span>
                    {currentPage === pageNum && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                    )}
                  </div>
                </div>
              )
            })}
          </aside>
        )}

        {/* Main Canvas Scroll Area */}
        <div
          ref={viewerContainerRef}
          className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-8 flex flex-col items-center bg-surface-950/80 space-y-6 relative"
        >
          {loading && (
            <div className="flex flex-col items-center justify-center my-auto py-20 space-y-3">
              <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
              <p className="text-sm font-medium text-gray-300">Memuat Dokumen Panduan PDF...</p>
              <p className="text-xs text-gray-500">Mempersiapkan visual & indeks teks</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center my-auto py-16 px-6 max-w-md text-center bg-surface-900 border border-red-500/30 rounded-2xl">
              <div className="p-3 bg-red-500/10 rounded-2xl mb-3 text-red-400">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Gagal Menampilkan PDF</h4>
              <p className="text-xs text-gray-400 mb-4">{error}</p>
              <div className="flex items-center gap-2">
                <button onClick={loadPdf} className="btn-secondary btn-sm text-xs">
                  <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary btn-sm text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Buka Tab Baru
                </a>
              </div>
            </div>
          )}

          {!loading && !error && pdfDoc && (
            <>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  ref={(el) => {
                    pageRefs.current[pageNum - 1] = el
                  }}
                  className="relative group transition-transform duration-150"
                  id={`pdf-page-${pageNum}`}
                >
                  <PdfPageRenderer
                    pdfDoc={pdfDoc}
                    pageNumber={pageNum}
                    scale={scale}
                    rotation={rotation}
                    isActiveSearchPage={
                      activeMatchIndex >= 0 &&
                      matches[activeMatchIndex]?.pageNumber === pageNum
                    }
                  />

                  {/* Page indicator pill at bottom right */}
                  <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-surface-900/80 backdrop-blur text-[10px] font-mono text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity border border-surface-700">
                    Hal. {pageNum} / {numPages}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
})

// ---------------- SUBCOMPONENT: PAGE RENDERER ----------------
interface PdfPageRendererProps {
  pdfDoc: any
  pageNumber: number
  scale: number
  rotation: number
  isActiveSearchPage: boolean
}

function PdfPageRenderer({
  pdfDoc,
  pageNumber,
  scale,
  rotation,
  isActiveSearchPage,
}: PdfPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  useEffect(() => {
    let isCancelled = false
    let currentRenderTask: any = null

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return

      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (isCancelled) return

        const viewport = page.getViewport({ scale, rotation })
        setPageSize({ width: viewport.width, height: viewport.height })

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        currentRenderTask = page.render({
          canvasContext: ctx,
          viewport,
        })

        await currentRenderTask.promise
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNumber} render error:`, err)
        }
      }
    }

    renderPage()

    return () => {
      isCancelled = true
      if (currentRenderTask) {
        try {
          currentRenderTask.cancel()
        } catch {}
      }
    }
  }, [pdfDoc, pageNumber, scale, rotation])

  return (
    <div
      className={`relative bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-200 border ${
        isActiveSearchPage ? 'ring-4 ring-amber-400/80 border-amber-400' : 'border-surface-700/60'
      }`}
      style={{
        width: pageSize.width || 'auto',
        height: pageSize.height || 'auto',
        minWidth: pageSize.width ? `${pageSize.width}px` : '300px',
        minHeight: pageSize.height ? `${pageSize.height}px` : '400px',
      }}
    >
      <canvas ref={canvasRef} className="block select-text" />
    </div>
  )
}

// ---------------- SUBCOMPONENT: THUMBNAIL ----------------
function PdfThumbnail({ pdfDoc, pageNumber }: { pdfDoc: any; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let isCancelled = false
    let currentTask: any = null

    const renderThumb = async () => {
      if (!pdfDoc || !canvasRef.current) return
      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (isCancelled) return

        const viewport = page.getViewport({ scale: 0.22 })
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = viewport.width
        canvas.height = viewport.height

        currentTask = page.render({
          canvasContext: ctx,
          viewport,
        })
        await currentTask.promise
      } catch {}
    }

    renderThumb()
    return () => {
      isCancelled = true
      if (currentTask) {
        try {
          currentTask.cancel()
        } catch {}
      }
    }
  }, [pdfDoc, pageNumber])

  return <canvas ref={canvasRef} className="w-full h-full object-contain" />
}
