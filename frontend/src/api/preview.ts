import { apiClient } from './client'
import type { PreviewResult, ValidationRule } from '../types'

export const previewApi = {
  /**
   * POST /api/configs/:id/preview?testUrl=
   */
  runPreview: async (configId: string, testUrl: string): Promise<PreviewResult> => {
    const res = await apiClient.post<PreviewResult>(
      `/configs/${configId}/preview`,
      {},
      { params: { testUrl } },
    )
    return res.data
  },

  /**
   * POST /api/configs/:id/validate
   */
  validateData: async (
    configId: string,
    rules: ValidationRule[],
    sampleData: Record<string, any>[],
  ): Promise<{ validationPassed: number; validationFailed: number; validationErrors: any[] }> => {
    const res = await apiClient.post<any>(`/configs/${configId}/validate`, {
      rules,
      sampleData,
    })
    return res.data
  },
}
