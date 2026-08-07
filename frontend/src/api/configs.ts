import { apiClient } from './client'
import type { ScrapingConfig, CreateConfigRequest, UpdateConfigRequest, ScrapingJob } from '../types'

export const configsApi = {
  getAll: () =>
    apiClient.get<ScrapingConfig[]>('/configs').then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ScrapingConfig>(`/configs/${id}`).then((r) => r.data),

  create: (data: CreateConfigRequest) =>
    apiClient.post<ScrapingConfig>('/configs', data).then((r) => r.data),

  update: (id: string, data: UpdateConfigRequest) =>
    apiClient.put<ScrapingConfig>(`/configs/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/configs/${id}`).then((r) => r.data),

  run: (id: string, params?: { parameter_name: string; parameter_value: unknown }[]) =>
    apiClient
      .post<ScrapingJob>(`/configs/${id}/run`, params ? { parameters: params } : {})
      .then((r) => r.data),
}
