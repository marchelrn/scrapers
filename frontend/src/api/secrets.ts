import { apiClient } from './client'
import type { Secret, CreateSecretRequest } from '../types'

export const secretsApi = {
  getAll: () =>
    apiClient.get<Secret[]>('/secrets').then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Secret>(`/secrets/${id}`).then((r) => r.data),

  create: (data: CreateSecretRequest) =>
    apiClient.post<Secret>('/secrets', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateSecretRequest>) =>
    apiClient.put<Secret>(`/secrets/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/secrets/${id}`).then((r) => r.data),
}
