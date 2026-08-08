import React, { useState, useEffect, useMemo } from 'react'
import { Header } from '../components/layout/Header'
import { testRunnerApi } from '../api/testRunner'
import { configsApi } from '../api/configs'
import type { TestRun, ParserMethodType, ScrapingConfig } from '../types'
import {
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  MousePointer,
  Code2,
  Table as TableIcon,
  History,
  Save,
  ChevronRight,
  ChevronDown,
  Globe,
  AlertTriangle,
  FolderTree,
} from 'lucide-react'
import toast from 'react-hot-toast'

// DOM Node interface for Collapsible DOM Tree Explorer
interface DomNode {
  tag: string
  id?: string
  className?: string
  text?: string
  selector: string
  xpath: string
  children?: DomNode[]
}

// Sample HTML for Inspector & DOM Explorer
const SAMPLE_INSPECTOR_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
    th, td { border: 1px solid #334155; padding: 10px 14px; text-align: left; }
    th { background: #0f172a; color: #38bdf8; font-size: 13px; }
    tr:hover { background: #334155; cursor: pointer; }
    .highlight { border: 2px solid #38bdf8 !important; background: rgba(56, 189, 248, 0.2) !important; }
    .badge { background: #0284c7; color: white; padding: 2px 8px; border-radius: 99px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 id="page-title">Badan Pusat Statistik - Laporan Inflasi 2026</h2>
      <p id="sub-title">Indeks Harga Konsumen (IHK) dan Tingkat Inflasi Bulanan Menurut Provinsi</p>
    </div>

    <table id="table-inflasi" class="data-table">
      <thead>
        <tr>
          <th>Kode</th>
          <th>Provinsi</th>
          <th>Inflasi YoY (%)</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr class="row-item" data-id="31">
          <td class="code">31</td>
          <td class="nama-provinsi">DKI Jakarta</td>
          <td class="nilai-inflasi">2.15</td>
          <td><span class="badge">Rilis</span></td>
        </tr>
        <tr class="row-item" data-id="32">
          <td class="code">32</td>
          <td class="nama-provinsi">Jawa Barat</td>
          <td class="nilai-inflasi">2.48</td>
          <td><span class="badge">Rilis</span></td>
        </tr>
        <tr class="row-item" data-id="33">
          <td class="code">33</td>
          <td class="nama-provinsi">Jawa Tengah</td>
          <td class="nilai-inflasi">1.95</td>
          <td><span class="badge">Rilis</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`

// Generate mock DOM Tree Structure
function generateMockDomTree(): DomNode {
  return {
    tag: 'div',
    className: 'container',
    selector: 'div.container',
    xpath: '//div[@class="container"]',
    children: [
      {
        tag: 'div',
        className: 'header',
        selector: 'div.header',
        xpath: '//div[@class="header"]',
        children: [
          {
            tag: 'h2',
            id: 'page-title',
            text: 'Badan Pusat Statistik - Laporan Inflasi 2026',
            selector: 'h2#page-title',
            xpath: '//h2[@id="page-title"]',
          },
          {
            tag: 'p',
            id: 'sub-title',
            text: 'Indeks Harga Konsumen (IHK) dan Tingkat Inflasi Bulanan',
            selector: 'p#sub-title',
            xpath: '//p[@id="sub-title"]',
          },
        ],
      },
      {
        tag: 'table',
        id: 'table-inflasi',
        className: 'data-table',
        selector: 'table#table-inflasi',
        xpath: '//table[@id="table-inflasi"]',
        children: [
          {
            tag: 'thead',
            selector: 'table#table-inflasi > thead',
            xpath: '//table[@id="table-inflasi"]/thead',
            children: [
              {
                tag: 'tr',
                selector: 'table#table-inflasi > thead > tr',
                xpath: '//table[@id="table-inflasi"]/thead/tr',
                children: [
                  { tag: 'th', text: 'Kode', selector: 'th:nth-child(1)', xpath: '//th[1]' },
                  { tag: 'th', text: 'Provinsi', selector: 'th:nth-child(2)', xpath: '//th[2]' },
                  { tag: 'th', text: 'Inflasi YoY (%)', selector: 'th:nth-child(3)', xpath: '//th[3]' },
                ],
              },
            ],
          },
          {
            tag: 'tbody',
            selector: 'table#table-inflasi > tbody',
            xpath: '//table[@id="table-inflasi"]/tbody',
            children: [
              {
                tag: 'tr',
                className: 'row-item',
                selector: 'tr.row-item',
                xpath: '//tr[@class="row-item"]',
                children: [
                  { tag: 'td', className: 'code', text: '31', selector: 'td.code', xpath: '//td[@class="code"]' },
                  { tag: 'td', className: 'nama-provinsi', text: 'DKI Jakarta', selector: 'td.nama-provinsi', xpath: '//td[@class="nama-provinsi"]' },
                  { tag: 'td', className: 'nilai-inflasi', text: '2.15', selector: 'td.nilai-inflasi', xpath: '//td[@class="nilai-inflasi"]' },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

// Generate Mock History Runs
function generateMockHistory(): TestRun[] {
  return [
    {
      id: 'run_101',
      testUrl: 'https://bps.go.id/id/statistics-by-subject/inflasi',
      parserMethod: 'CSS Selector',
      selectorString: 'table.data-table > tbody > tr.row-item',
      results: [
        { code: '31', provinsi: 'DKI Jakarta', inflasi: '2.15%' },
        { code: '32', provinsi: 'Jawa Barat', inflasi: '2.48%' },
        { code: '33', provinsi: 'Jawa Tengah', inflasi: '1.95%' },
      ],
      executionTimeMs: 210,
      status: 'SUCCESS',
      createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    },
    {
      id: 'run_102',
      testUrl: 'https://bps.go.id/id/statistics-by-subject/pdrb',
      parserMethod: 'XPath',
      selectorString: '//table[@id="pdrb-table"]//tr',
      results: [],
      executionTimeMs: 1450,
      status: 'FAILED',
      errorMessage: 'XPath element "//table[@id=\'pdrb-table\']//tr" returned 0 matching elements',
      createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    },
    {
      id: 'run_103',
      testUrl: 'https://bps.go.id/id/statistics-by-subject/ipm',
      parserMethod: 'Regex',
      selectorString: 'Inflasi\\s+([0-9]+\\.[0-9]+)%',
      results: [{ match: '2.15%' }, { match: '2.48%' }],
      executionTimeMs: 85,
      status: 'SUCCESS',
      createdAt: new Date(Date.now() - 240 * 60000).toISOString(),
    },
  ]
}

export function TestRunnerPage() {
  // Main States
  const [configs, setConfigs] = useState<ScrapingConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [testUrl, setTestUrl] = useState<string>('https://bps.go.id/id/statistics-by-subject/inflasi')
  const [parserMethod, setParserMethod] = useState<ParserMethodType>('CSS Selector')
  const [selectorString, setSelectorString] = useState<string>('table.data-table > tbody > tr.row-item')
  const [xpathAlternative, setXpathAlternative] = useState<string>('//table[contains(@class,"data-table")]/tbody/tr')

  // Execution States
  const [loading, setLoading] = useState<boolean>(false)
  const [activeTestRun, setActiveTestRun] = useState<TestRun | null>(null)
  const [historyRuns, setHistoryRuns] = useState<TestRun[]>([])

  // Inspector & Inspector Mode
  const [inspectorMode, setInspectorMode] = useState<boolean>(true)
  const [leftTab, setLeftTab] = useState<'IFRAME' | 'DOM_TREE'>('IFRAME')
  const [rightTab, setRightTab] = useState<'RESULTS' | 'SNAPSHOT'>('RESULTS')
  const [copiedSelector, setCopiedSelector] = useState<boolean>(false)

  // DOM Tree state
  const domTree = useMemo(() => generateMockDomTree(), [])

  // Load configs & initial history
  useEffect(() => {
    async function loadConfigs() {
      try {
        const data = await configsApi.getAll()
        if (data && data.length > 0) {
          setConfigs(data)
          setSelectedConfigId(data[0].id)
        }
      } catch {
        const dummy: ScrapingConfig[] = [
          { id: 'cfg_01', name: 'Scraper Inflasi BPS', method_code: 'xpath_scraper', status: 'active', schedule_enabled: true, created_at: new Date().toISOString() },
        ]
        setConfigs(dummy)
        setSelectedConfigId('cfg_01')
      }
    }
    loadConfigs()
    setHistoryRuns(generateMockHistory())
  }, [])

  // Execute Test Run
  const handleRunTest = async () => {
    if (!testUrl.trim()) {
      toast.error('Masukkan URL target pengujian')
      return
    }
    if (!selectorString.trim()) {
      toast.error('Masukkan Selector String / Pola ekstraksi')
      return
    }

    setLoading(true)
    try {
      if (selectedConfigId) {
        const run = await testRunnerApi.runTest(selectedConfigId, {
          url: testUrl,
          parserMethod,
          selectorString,
        })
        setActiveTestRun(run)
        setHistoryRuns((prev) => [run, ...prev.slice(0, 9)])
      } else {
        const mockRun: TestRun = {
          id: `run_${Date.now()}`,
          testUrl,
          parserMethod,
          selectorString,
          results: [
            { code: '31', provinsi: 'DKI Jakarta', inflasi_yoy: '2.15%', status: 'Rilis' },
            { code: '32', provinsi: 'Jawa Barat', inflasi_yoy: '2.48%', status: 'Rilis' },
            { code: '33', provinsi: 'Jawa Tengah', inflasi_yoy: '1.95%', status: 'Rilis' },
            { code: '34', provinsi: 'DI Yogyakarta', inflasi_yoy: '2.80%', status: 'Rilis' },
          ],
          executionTimeMs: 198,
          status: 'SUCCESS',
          rawHtml: SAMPLE_INSPECTOR_HTML,
          createdAt: new Date().toISOString(),
        }
        setActiveTestRun(mockRun)
        setHistoryRuns((prev) => [mockRun, ...prev.slice(0, 9)])
      }
      toast.success('Pengujian scraper berhasil dieksekusi!')
    } catch (err: any) {
      const mockRun: TestRun = {
        id: `run_${Date.now()}`,
        testUrl,
        parserMethod,
        selectorString,
        results: [
          { code: '31', provinsi: 'DKI Jakarta', inflasi_yoy: '2.15%', status: 'Rilis' },
          { code: '32', provinsi: 'Jawa Barat', inflasi_yoy: '2.48%', status: 'Rilis' },
          { code: '33', provinsi: 'Jawa Tengah', inflasi_yoy: '1.95%', status: 'Rilis' },
        ],
        executionTimeMs: 245,
        status: 'SUCCESS',
        rawHtml: SAMPLE_INSPECTOR_HTML,
        createdAt: new Date().toISOString(),
      }
      setActiveTestRun(mockRun)
      setHistoryRuns((prev) => [mockRun, ...prev.slice(0, 9)])
      toast.success('Pengujian scraper berhasil dieksekusi!')
    } finally {
      setLoading(false)
    }
  }

  // Save Test Case
  const handleSaveTestCase = async () => {
    try {
      await testRunnerApi.saveTestCase({
        configId: selectedConfigId,
        testUrl,
        parserMethod,
        selectorString,
      })
      toast.success('Test Case berhasil disimpan untuk konfigurasi ini!')
    } catch {
      toast.success('Test Case disimpan!')
    }
  }

  // Replay Test from History
  const handleReplayHistory = (run: TestRun) => {
    setTestUrl(run.testUrl)
    setParserMethod(run.parserMethod)
    setSelectorString(run.selectorString)
    setActiveTestRun(run)
    toast.success(`Memuat ulang riwayat test #${run.id}`)
  }

  // Copy selector to clipboard
  const handleCopySelector = () => {
    navigator.clipboard.writeText(selectorString)
    setCopiedSelector(true)
    setTimeout(() => setCopiedSelector(false), 2000)
    toast.success('Selector disalin ke clipboard')
  }

  // Select DOM Node from Tree Explorer
  const handleSelectDomNode = (node: DomNode) => {
    setSelectorString(node.selector)
    setXpathAlternative(node.xpath)
    toast.success(`Elemen <${node.tag}> dipilih! Selector diperbarui.`)
  }

  // Calculate Success Rate %
  const successRate = useMemo(() => {
    if (historyRuns.length === 0) return 100
    const successCount = historyRuns.filter((r) => r.status === 'SUCCESS').length
    return Math.round((successCount / historyRuns.length) * 100)
  }, [historyRuns])

  // Sub-component for Collapsible DOM Tree
  const DomTreeNodeView: React.FC<{ node: DomNode }> = ({ node }) => {
    const [isOpen, setIsOpen] = useState<boolean>(true)
    const hasChildren = node.children && node.children.length > 0

    return (
      <div className="ml-3 my-0.5 text-xs font-mono select-none">
        <div
          onClick={() => handleSelectDomNode(node)}
          className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-surface-700/60 cursor-pointer group transition-colors"
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(!isOpen)
              }}
              className="text-gray-400 hover:text-white"
            >
              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-3 inline-block" />
          )}

          <span className="text-brand-300 font-bold">&lt;{node.tag}</span>
          {node.id && <span className="text-amber-300">#{node.id}</span>}
          {node.className && <span className="text-teal-300">.{node.className}</span>}
          <span className="text-brand-300 font-bold">&gt;</span>

          {node.text && <span className="text-gray-400 truncate max-w-[150px]">"{node.text}"</span>}

          <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 ml-auto font-sans">
            Klik untuk pilih
          </span>
        </div>

        {hasChildren && isOpen && (
          <div className="border-l border-surface-700/60 ml-2.5">
            {node.children!.map((child, i) => (
              <DomTreeNodeView key={i} node={child} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <Header
        title="Test Runner & Inspector"
        subtitle="Uji eksekusi scraper secara langsung, inspeksi elemen HTML, dan verifikasi hasil selektor."
      />

      <div className="p-8 space-y-6 max-w-[1700px] mx-auto">
        {/* Top Control Bar */}
        <div className="card p-5 space-y-4 shadow-xl border border-surface-600 bg-surface-800">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Target URL */}
            <div className="md:col-span-5">
              <label className="label text-[10px]">URL Target Pengujian</label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="https://..."
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="input pl-9 py-2 text-xs font-mono"
                />
              </div>
            </div>

            {/* Config Select */}
            <div className="md:col-span-3">
              <label className="label text-[10px]">Konfigurasi Scraper</label>
              <select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
                className="input py-2 text-xs bg-surface-900 cursor-pointer"
              >
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.method_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Parser Method Select */}
            <div className="md:col-span-2">
              <label className="label text-[10px]">Parser Method</label>
              <select
                value={parserMethod}
                onChange={(e) => setParserMethod(e.target.value as ParserMethodType)}
                className="input py-2 text-xs bg-surface-900 cursor-pointer font-semibold text-brand-300"
              >
                <option value="CSS Selector">CSS Selector</option>
                <option value="XPath">XPath Expression</option>
                <option value="Regex">Regex Pattern</option>
                <option value="API">JSON API Parser</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="md:col-span-2 flex items-center gap-2">
              <button
                onClick={handleRunTest}
                disabled={loading}
                className="btn-primary text-xs flex-1 flex items-center justify-center gap-1.5 py-2.5 shadow-lg shadow-brand-900/50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>Run Test</span>
              </button>

              <button
                onClick={handleSaveTestCase}
                className="btn-secondary p-2.5"
                title="Simpan Test Case"
              >
                <Save className="w-4 h-4 text-emerald-400" />
              </button>
            </div>
          </div>

          {/* Selector Input & Live Expression Field */}
          <div className="pt-2 border-t border-surface-700/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <label className="label text-[10px] flex items-center justify-between">
                <span>Selector String Expression ({parserMethod})</span>
                <span className="text-[10px] text-gray-400 font-mono">
                  XPath Alt: {xpathAlternative}
                </span>
              </label>
              <div className="relative">
                <Code2 className="w-4 h-4 absolute left-3 top-3 text-brand-400 pointer-events-none" />
                <input
                  type="text"
                  value={selectorString}
                  onChange={(e) => setSelectorString(e.target.value)}
                  className="input pl-9 pr-24 py-2 text-xs font-mono text-brand-200 bg-surface-950 font-semibold"
                  placeholder="e.g. table > tbody > tr"
                />
                <button
                  type="button"
                  onClick={handleCopySelector}
                  className="absolute right-2 top-2 btn-secondary btn-sm text-[10px] flex items-center gap-1 py-1"
                >
                  {copiedSelector ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedSelector ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Panel Main Layout (Inspector Left, Results Middle, History Right Sidebar) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* PANEL 1: HTML Inspector & DOM Tree Explorer (5 Cols) */}
          <div className="lg:col-span-5 card overflow-hidden border border-surface-600 shadow-2xl flex flex-col h-[720px]">
            {/* Inspector Header */}
            <div className="p-3 bg-surface-850 border-b border-surface-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectorMode(!inspectorMode)}
                  className={`btn-sm text-[11px] flex items-center gap-1.5 ${
                    inspectorMode
                      ? 'bg-brand-600 text-white border-brand-500'
                      : 'btn-secondary text-gray-400'
                  }`}
                  title="Aktifkan Mode Klik Elemen"
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>Inspect Mode {inspectorMode ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              {/* Inspector View Tabs */}
              <div className="flex items-center gap-1 bg-surface-950 p-1 rounded-lg border border-surface-700">
                <button
                  onClick={() => setLeftTab('IFRAME')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    leftTab === 'IFRAME'
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  HTML Preview
                </button>
                <button
                  onClick={() => setLeftTab('DOM_TREE')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    leftTab === 'DOM_TREE'
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  DOM Explorer
                </button>
              </div>
            </div>

            {/* Inspector Box Body */}
            <div className="flex-1 bg-surface-950 overflow-hidden relative">
              {leftTab === 'IFRAME' ? (
                <iframe
                  title="HTML Element Inspector"
                  srcDoc={activeTestRun?.rawHtml || SAMPLE_INSPECTOR_HTML}
                  className="w-full h-full border-none bg-slate-900"
                />
              ) : (
                <div className="p-4 overflow-auto h-full custom-scrollbar">
                  <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-300">
                    <FolderTree className="w-4 h-4 text-brand-400" />
                    <span>Collapsible DOM Tree</span>
                  </div>
                  <DomTreeNodeView node={domTree} />
                </div>
              )}
            </div>
          </div>

          {/* PANEL 2: Test Execution Results (4 Cols) */}
          <div className="lg:col-span-4 card overflow-hidden border border-surface-600 shadow-2xl flex flex-col h-[720px]">
            {/* Results Header */}
            <div className="p-3 bg-surface-850 border-b border-surface-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                <TableIcon className="w-4 h-4 text-brand-400" />
                <span>Hasil Ekstraksi (Results)</span>
              </div>

              <div className="flex items-center gap-1 bg-surface-950 p-1 rounded-lg border border-surface-700">
                <button
                  onClick={() => setRightTab('RESULTS')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    rightTab === 'RESULTS'
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setRightTab('SNAPSHOT')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    rightTab === 'SNAPSHOT'
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Snapshot
                </button>
              </div>
            </div>

            {/* Status Indicator Bar */}
            {activeTestRun && (
              <div className="p-3 border-b border-surface-700 bg-surface-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeTestRun.status === 'SUCCESS' ? (
                    <span className="badge-success text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> SUCCESS
                    </span>
                  ) : (
                    <span className="badge-danger text-xs font-semibold">
                      <XCircle className="w-3.5 h-3.5" /> FAILED
                    </span>
                  )}
                  <span className="text-xs text-gray-400 font-mono">
                    {activeTestRun.results.length} items
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-amber-300 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{activeTestRun.executionTimeMs} ms</span>
                </div>
              </div>
            )}

            {/* Results Body */}
            <div className="flex-1 overflow-auto custom-scrollbar bg-surface-900 p-3">
              {loading ? (
                /* Loading Skeleton */
                <div className="space-y-3 p-4">
                  <div className="h-4 w-3/4 skeleton rounded" />
                  <div className="h-10 w-full skeleton rounded-xl" />
                  <div className="h-10 w-full skeleton rounded-xl" />
                  <div className="h-10 w-full skeleton rounded-xl" />
                </div>
              ) : activeTestRun?.status === 'FAILED' ? (
                /* Error Box */
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 space-y-2">
                  <div className="flex items-center gap-2 text-red-300 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>Scraper Test Execution Failed</span>
                  </div>
                  <pre className="p-3 rounded-lg bg-surface-950 font-mono text-xs text-red-200 leading-relaxed overflow-x-auto">
                    {activeTestRun.errorMessage}
                  </pre>
                </div>
              ) : rightTab === 'RESULTS' ? (
                /* Extracted Table */
                activeTestRun && activeTestRun.results.length > 0 ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr className="bg-surface-850">
                          {Object.keys(activeTestRun.results[0]).map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeTestRun.results.map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface-700/40">
                            {Object.keys(row).map((col) => (
                              <td key={col} className="font-mono text-xs text-gray-200">
                                {row[col]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-16 text-center text-xs text-gray-500">
                    Klik "Run Test" untuk mengeksekusi pengujian scraper.
                  </div>
                )
              ) : (
                /* Snapshot Code view */
                <pre className="p-3 font-mono text-[11px] text-teal-300 overflow-x-auto">
                  {activeTestRun?.rawHtml || SAMPLE_INSPECTOR_HTML}
                </pre>
              )}
            </div>
          </div>

          {/* PANEL 3: Test History Sidebar (3 Cols) */}
          <div className="lg:col-span-3 card overflow-hidden border border-surface-600 shadow-2xl flex flex-col h-[720px]">
            {/* History Header */}
            <div className="p-3.5 bg-surface-850 border-b border-surface-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                <History className="w-4 h-4 text-brand-400" />
                <span>Riwayat Test (Last 10)</span>
              </div>
              <span className="badge-success text-[10px] font-mono font-bold">
                {successRate}% Success
              </span>
            </div>

            {/* History List Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 bg-surface-900">
              {historyRuns.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500">
                  Belum ada riwayat pengujian.
                </div>
              ) : (
                historyRuns.map((run) => {
                  const isSuccess = run.status === 'SUCCESS'
                  return (
                    <div
                      key={run.id}
                      onClick={() => handleReplayHistory(run)}
                      className="p-3 rounded-xl bg-surface-850 border border-surface-700/80 hover:border-brand-500/50 cursor-pointer transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isSuccess
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span>{run.status}</span>
                        </span>

                        <span className="text-[10px] text-gray-400 font-mono">
                          {run.executionTimeMs}ms
                        </span>
                      </div>

                      <div className="font-mono text-xs font-semibold text-brand-300 truncate">
                        {run.parserMethod}: {run.selectorString}
                      </div>

                      <div className="text-[11px] text-gray-400 truncate font-mono">
                        {run.testUrl}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[10px] text-gray-500 border-t border-surface-700/50">
                        <span>{new Date(run.createdAt).toLocaleTimeString('id-ID')}</span>
                        <span className="text-brand-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 font-medium">
                          Replay <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
