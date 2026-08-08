import { apiClient } from './client'
import type { ErrorLog, ErrorLogQueryParams, PaginatedErrorLogs } from '../types'

export const errorsApi = {
  /**
   * GET /api/errors?limit=50&offset=0&errorType=&severity=&dateFrom=&dateTo=
   */
  getErrors: async (params: ErrorLogQueryParams): Promise<PaginatedErrorLogs> => {
    const queryParams: Record<string, any> = {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    }

    if (params.errorType) queryParams.errorType = params.errorType
    if (params.severity) {
      queryParams.severity = Array.isArray(params.severity)
        ? params.severity.join(',')
        : params.severity
    }
    if (params.dateFrom) queryParams.dateFrom = params.dateFrom
    if (params.dateTo) queryParams.dateTo = params.dateTo
    if (params.search) queryParams.search = params.search
    if (params.isResolved !== undefined) queryParams.isResolved = params.isResolved

    try {
      const res = await apiClient.get<any>('/errors', { params: queryParams })

      // Normalize array or envelope responses
      if (Array.isArray(res.data)) {
        return {
          data: res.data,
          total: res.data.length,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
        }
      }

      return {
        data: res.data?.data || res.data?.items || [],
        total: res.data?.total || res.data?.count || (res.data?.data?.length ?? 0),
        limit: res.data?.limit || params.limit || 50,
        offset: res.data?.offset || params.offset || 0,
      }
    } catch (error) {
      console.warn('API /api/errors error, returning empty dataset', error)
      throw error
    }
  },

  /**
   * Bulk action: Mark as resolved
   * PATCH /api/errors/resolve
   */
  resolveErrors: async (ids: string[]): Promise<{ count: number }> => {
    const res = await apiClient.patch<{ count: number }>('/errors/resolve', { ids })
    return res.data
  },

  /**
   * GET /api/errors/:id
   */
  getErrorById: async (id: string): Promise<ErrorLog> => {
    const res = await apiClient.get<ErrorLog>(`/errors/${id}`)
    return res.data
  },
}
