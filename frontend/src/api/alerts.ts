import { apiClient } from './client'
import type { AlertRule, CreateAlertRuleRequest } from '../types'

export const alertsApi = {
  getAll: async (): Promise<AlertRule[]> => {
    const res = await apiClient.get<any>('/alerts')
    if (Array.isArray(res.data)) return res.data
    return res.data?.data || res.data?.items || []
  },

  getById: async (id: string): Promise<AlertRule> => {
    const res = await apiClient.get<AlertRule>(`/alerts/${id}`)
    return res.data
  },

  create: async (data: CreateAlertRuleRequest): Promise<AlertRule> => {
    const res = await apiClient.post<AlertRule>('/alerts', data)
    return res.data
  },

  update: async (id: string, data: Partial<CreateAlertRuleRequest>): Promise<AlertRule> => {
    const res = await apiClient.put<AlertRule>(`/alerts/${id}`, data)
    return res.data
  },

  toggleStatus: async (id: string, enabled: boolean): Promise<AlertRule> => {
    const res = await apiClient.patch<AlertRule>(`/alerts/${id}/toggle`, { enabled })
    return res.data
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const res = await apiClient.delete<{ success: boolean }>(`/alerts/${id}`)
    return res.data
  },

  /**
   * POST /api/alerts/:id/test
   */
  testAlert: async (id: string): Promise<{ message: string; status: string }> => {
    const res = await apiClient.post<{ message: string; status: string }>(`/alerts/${id}/test`)
    return res.data
  },
}
