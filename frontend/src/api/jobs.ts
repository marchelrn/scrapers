import { apiClient } from './client'
import type { ScrapingJob } from '../types'

export interface JobListParams {
  page?: number
  limit?: number
  config_id?: string
}

export const jobsApi = {
  getAll: (params?: JobListParams) =>
    apiClient.get<ScrapingJob[]>('/jobs', { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ScrapingJob>(`/jobs/${id}`).then((r) => r.data),

  create: (config_id: string) =>
    apiClient.post<ScrapingJob>('/jobs', { config_id }).then((r) => r.data),
}
