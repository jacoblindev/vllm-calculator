import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchModelInfo, extractModelSize, detectQuantizationType, getQuantizationFactor } from './huggingfaceApi.js'

// Mock fetch globally
global.fetch = vi.fn()

describe('huggingfaceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchModelInfo', () => {
    it('successfully fetches model info', async () => {
      const mockModelInfo = {
        id: 'test-model',
        tags: ['pytorch', 'text-generation']
      }
      const mockConfig = {
        n_parameters: 7000000000
      }

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockModelInfo)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig)
        })

      const result = await fetchModelInfo('test-model')

      expect(result.success).toBe(true)
      expect(result.id).toBe('test-model')
      expect(result.config).toEqual(mockConfig)
    })

    it('handles API failures gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const result = await fetchModelInfo('nonexistent-model')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('handles network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await fetchModelInfo('test-model')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('extractModelSize', () => {
    it('extracts size from n_parameters', () => {
      const modelInfo = {
        success: true,
        config: { n_parameters: 7000000000 }
      }

      const size = extractModelSize(modelInfo)
      expect(size).toBe(7)
    })

    it('extracts size from num_parameters', () => {
      const modelInfo = {
        success: true,
        config: { num_parameters: 13000000000 }
      }

      const size = extractModelSize(modelInfo)
      expect(size).toBe(13)
    })

    it('extracts size from model name', () => {
      const modelInfo = {
        success: true,
        config: {},
        id: 'llama-7b-chat'
      }

      const size = extractModelSize(modelInfo)
      expect(size).toBe(7)
    })

    it('returns null for unsuccessful requests', () => {
      const modelInfo = { success: false }

      const size = extractModelSize(modelInfo)
      expect(size).toBe(null)
    })
  })

  describe('detectQuantizationType', () => {
    it('detects AWQ from tags', () => {
      const modelInfo = {
        success: true,
        tags: ['awq', 'pytorch']
      }

      const type = detectQuantizationType(modelInfo)
      expect(type).toBe('awq')
    })

    it('detects GPTQ from model name', () => {
      const modelInfo = {
        success: true,
        id: 'llama-7b-gptq',
        tags: []
      }

      const type = detectQuantizationType(modelInfo)
      expect(type).toBe('gptq')
    })

    it('defaults to fp16 for standard models', () => {
      const modelInfo = {
        success: true,
        id: 'llama-7b-chat',
        tags: ['pytorch']
      }

      const type = detectQuantizationType(modelInfo)
      expect(type).toBe('fp16')
    })

    it('returns unknown for failed requests', () => {
      const modelInfo = { success: false }

      const type = detectQuantizationType(modelInfo)
      expect(type).toBe('unknown')
    })
  })

  describe('getQuantizationFactor', () => {
    it('returns correct factors for different quantization types', () => {
      expect(getQuantizationFactor('fp16')).toBe(1.0)
      expect(getQuantizationFactor('fp32')).toBe(1.0)
      expect(getQuantizationFactor('awq')).toBe(0.5)
      expect(getQuantizationFactor('gptq')).toBe(0.5)
      expect(getQuantizationFactor('ggml')).toBe(0.5)
      expect(getQuantizationFactor('unknown')).toBe(1.0)
    })

    it('returns 1.0 for unknown quantization types', () => {
      expect(getQuantizationFactor('custom-quantization')).toBe(1.0)
    })
  })
})
