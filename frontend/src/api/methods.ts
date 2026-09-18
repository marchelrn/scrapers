import axios from 'axios'
import { apiClient } from './client'
import type { Method } from '../types'

export const methodsApi = {
  getAll: () =>
    apiClient.get<Method[]>('/methods').then((r) => r.data),
}

export interface ProxyHtmlResult {
  html: string
  /** Alamat akhir setelah pengalihan, dari header X-Proxy-Final-Url. */
  finalUrl: string
}

/**
 * Kegagalan proxy yang sudah diklasifikasikan oleh backend.
 *
 * `code` memisahkan "isian saya salah" (VALIDATION_ERROR, NOT_FOUND) dari
 * "situs target menolak kita" (BLOCKED_403, RATE_LIMITED_429,
 * CHALLENGE_DETECTED) sehingga UI dapat menyarankan tindakan yang berbeda.
 */
export class ProxyError extends Error {
  code: string
  targetStatus?: number

  constructor(code: string, message: string, targetStatus?: number) {
    super(message)
    this.name = 'ProxyError'
    this.code = code
    this.targetStatus = targetStatus
  }
}

// Karena permintaan proxy memakai responseType 'text', badan respons galat pun
// tiba sebagai string. Tanpa penguraian ini, pesan terperinci dari backend
// hilang dan frontend hanya bisa menampilkan galat generik.
function parseProxyErrorBody(data: unknown): { code?: string; error?: string; target_status?: number } {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      return {}
    }
  }
  if (typeof data === 'object' && data !== null) {
    return data as { code?: string; error?: string; target_status?: number }
  }
  return {}
}

function toProxyError(err: unknown): ProxyError {
  if (axios.isAxiosError(err)) {
    const body = parseProxyErrorBody(err.response?.data)
    if (body.error) {
      return new ProxyError(body.code || 'UPSTREAM_ERROR', body.error, body.target_status)
    }
    if (err.code === 'ECONNABORTED') {
      return new ProxyError(
        'CLIENT_TIMEOUT',
        'Permintaan melewati batas 30 detik di peramban sebelum backend selesai mengambil halaman. Coba muat ulang, atau pakai teknik yang tidak memerlukan pratinjau.',
      )
    }
    if (!err.response) {
      return new ProxyError(
        'NETWORK_ERROR',
        'Backend tidak dapat dihubungi dari peramban. Periksa apakah server backend sedang berjalan.',
      )
    }
    return new ProxyError('UPSTREAM_ERROR', `Proxy gagal dengan status HTTP ${err.response.status}.`)
  }
  return new ProxyError('UNKNOWN_ERROR', err instanceof Error ? err.message : 'Galat tidak dikenal saat memanggil proxy.')
}

export const proxyApi = {
  getHtml: (url: string): Promise<ProxyHtmlResult> =>
    apiClient
      .get<string>('/proxy', { params: { url }, responseType: 'text' })
      .then((r) => ({
        html: r.data,
        finalUrl: (r.headers['x-proxy-final-url'] as string | undefined) || url,
      }))
      .catch((err) => {
        throw toProxyError(err)
      }),
}
