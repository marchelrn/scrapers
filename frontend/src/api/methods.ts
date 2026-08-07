import { apiClient } from './client'
import type { Method } from '../types'

export const methodsApi = {
  getAll: () =>
    apiClient.get<Method[]>('/methods').then((r) => r.data),
}

export const proxyApi = {
  getHtml: (url: string) =>
    apiClient.get<string>('/proxy', { params: { url }, responseType: 'text' }).then((r) => r.data),
}
