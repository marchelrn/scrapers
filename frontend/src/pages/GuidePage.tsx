import { useRef } from 'react'
import { Header } from '../components/layout/Header'
import { PdfViewer, type PdfViewerRef } from '../components/shared/PdfViewer'

export function GuidePage() {
  const viewerRef = useRef<PdfViewerRef>(null)
  const pdfUrl = '/panduan-sistem.pdf'

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Panduan Penggunaan Sistem"
        subtitle="Dokumentasi resmi dan petunjuk teknis operasional otomasi web scraping SiAPA BPS"
      />

      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Embedded Interactive PDF Viewer */}
        <div className="space-y-3">
          <PdfViewer
            ref={viewerRef}
            url={pdfUrl}
            title="Buku Panduan SiAPA - BPS"
            initialScale={1.2}
          />

        </div>
      </main>
    </div>
  )
}
export default GuidePage
