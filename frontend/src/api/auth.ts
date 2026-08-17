import { apiClient } from './client'
import type { LoginRequest, RegisterRequest, LoginResponse, UserResponse, ApiMessage } from '../types'

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterRequest) =>
    apiClient.post<ApiMessage>('/auth/register', data).then((r) => r.data),

  me: () =>
    apiClient.get<UserResponse>('/auth/me').then((r) => r.data),
}
