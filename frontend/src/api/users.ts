import { apiClient } from './client'
import type { UserResponse } from '../types'

export const usersApi = {
  getAll: () =>
    apiClient.get<UserResponse[]>('/users').then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<UserResponse>(`/users/${id}`).then((r) => r.data),

  updateAsAdmin: (id: string, data: { name?: string; email?: string; password?: string; role?: string }) =>
    apiClient.patch<UserResponse>(`/users/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/users/${id}`).then((r) => r.data),

  updateProfile: (data: { name?: string; email?: string; password?: string }) =>
    apiClient.patch<UserResponse>('/profile', data).then((r) => r.data),
}
