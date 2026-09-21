import type { Method, MethodParam } from '../types'

export const FALLBACK_GOOGLE_NEWS_PARAMS: MethodParam[] = [
  {
    name: 'query',
    label: 'Search Query',
    type: 'text',
    required: true,
    placeholder: 'e.g. Pertanian Sulawesi Utara 2026',
  },
  {
    name: 'domain_filter',
    label: 'Domain Filter (Optional)',
    type: 'text',
    required: false,
    placeholder: 'e.g. bps.go.id, antaranews.com',
  },
  {
    name: 'start_date',
    label: 'Start Date (Tanggal Awal)',
    type: 'date',
    required: false,
    placeholder: 'YYYY-MM-DD',
    description: 'Tanggal awal publikasi berita (contoh: 2026-01-01).',
  },
  {
    name: 'end_date',
    label: 'End Date (Tanggal Akhir)',
    type: 'date',
    required: false,
    placeholder: 'YYYY-MM-DD',
    description: 'Tanggal akhir publikasi berita (contoh: 2026-09-16).',
  },
  {
    name: 'max_results',
    label: 'Max Results',
    type: 'number',
    required: false,
    default: 10,
  },
  {
    name: 'ai_instruction',
    label: 'AI Instruction',
    type: 'textarea',
    required: false,
    placeholder: 'e.g. Ringkas dan ekstrak hanya data mengenai komoditas Pertanian',
  },
  {
    name: 'deduplicate',
    label: 'Hindari Duplikasi',
    type: 'boolean',
    required: false,
    default: true,
  },
]

export function getMethodParams(methodCode: string, methods: Method[]): MethodParam[] {
  const foundMethod = methods.find((m) => m.code === methodCode)
  if (foundMethod && foundMethod.parameters && foundMethod.parameters.length > 0) {
    return foundMethod.parameters
  }

  if (methodCode === 'google_news') {
    return FALLBACK_GOOGLE_NEWS_PARAMS
  }

  return []
}

export function buildParametersPayload(
  methodCode: string,
  _targetUrlUX: 'keyword' | 'visual',
  targetUrl: string,
  technique: 'css' | 'keyword_find',
  selector: string,
  keyword: string,
  dynamicParamValues: Record<string, any>,
  methods: Method[]
): { parameter_name: string; parameter_value: unknown }[] {
  if (methodCode === 'target_url') {
    const payload = [
      { parameter_name: 'url', parameter_value: targetUrl },
      { parameter_name: 'technique', parameter_value: technique },
    ]
    if (technique === 'css') {
      payload.push({ parameter_name: 'selector', parameter_value: selector })
    } else {
      payload.push({ parameter_name: 'keyword', parameter_value: keyword })
    }
    return payload
  }

  const paramsList = getMethodParams(methodCode, methods)
  const payload: { parameter_name: string; parameter_value: unknown }[] = []

  if (paramsList.length > 0) {
    paramsList.forEach((p, i) => {
      const pName = p.Name || p.name || `param_${i}`
      if (pName) {
        payload.push({
          parameter_name: pName,
          parameter_value: dynamicParamValues[pName] ?? '',
        })
      }
    })
  } else {
    Object.entries(dynamicParamValues).forEach(([k, v]) => {
      payload.push({ parameter_name: k, parameter_value: v })
    })
  }

  return payload
}
