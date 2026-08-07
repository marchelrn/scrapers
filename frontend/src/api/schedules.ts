import { apiClient } from './client'
import type { Schedule, CreateScheduleRequest, UpdateScheduleRequest } from '../types'

export const schedulesApi = {
  getAll: () =>
    apiClient.get<Schedule[]>('/schedules').then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<Schedule>(`/schedules/${id}`).then((r) => r.data),

  create: (data: CreateScheduleRequest) =>
    apiClient.post<Schedule>('/schedules', data).then((r) => r.data),

  update: (id: number, data: UpdateScheduleRequest) =>
    apiClient.put<Schedule>(`/schedules/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/schedules/${id}`).then((r) => r.data),
}
