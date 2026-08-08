import { apiClient } from './client'
import type { TestRun, ParserMethodType } from '../types'

export interface RunTestParams {
  url: string
  parserMethod: ParserMethodType
  selectorString: string
}

export const testRunnerApi = {
  /**
   * POST /api/configs/:id/test?url=
   */
  runTest: async (configId: string, params: RunTestParams): Promise<TestRun> => {
    const res = await apiClient.post<TestRun>(
      `/configs/${configId}/test`,
      {
        parserMethod: params.parserMethod,
        selectorString: params.selectorString,
      },
      { params: { url: params.url } },
    )
    return res.data
  },

  /**
   * GET /api/test-runs/:configId
   */
  getTestHistory: async (configId: string): Promise<TestRun[]> => {
    const res = await apiClient.get<any>(`/test-runs/${configId}`)
    if (Array.isArray(res.data)) return res.data
    return res.data?.data || res.data?.items || []
  },

  /**
   * POST /api/test-runs/save
   */
  saveTestCase: async (testRun: Partial<TestRun>): Promise<{ id: string }> => {
    const res = await apiClient.post<{ id: string }>('/test-runs/save', testRun)
    return res.data
  },
}
