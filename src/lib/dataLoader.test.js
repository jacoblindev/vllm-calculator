import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  loadGPUData, 
  loadModelData, 
  validateGPU, 
  validateModel, 
  createCustomGPU, 
  createCustomModel 
} from './dataLoader.js'

// Mock fetch globally
global.fetch = vi.fn()

describe('dataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadGPUData', () => {
    it('successfully loads GPU data', async () => {
      const mockGPUs = [
        { name: "NVIDIA A100", vram_gb: 80 },
        { name: "NVIDIA H100", vram_gb: 80 }
      ]

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGPUs)
      })

      const result = await loadGPUData()
      expect(result).toEqual(mockGPUs)
    })

    it('returns fallback data on fetch failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const result = await loadGPUData()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('name')
      expect(result[0]).toHaveProperty('vram_gb')
    })
  })

  describe('loadModelData', () => {
    it('successfully loads model data', async () => {
      const mockModels = [
        {
          name: "Llama 2 7B",
          hf_id: "meta-llama/Llama-2-7b-hf",
          size_gb: 13.5,
          quantization: "fp16",
          memory_factor: 1.0
        }
      ]

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockModels)
      })

      const result = await loadModelData()
      expect(result).toEqual(mockModels)
    })

    it('returns fallback data on fetch failure', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await loadModelData()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('name')
      expect(result[0]).toHaveProperty('size_gb')
    })
  })

  describe('validateGPU', () => {
    it('validates correct GPU object', () => {
      const gpu = { name: "NVIDIA A100", vram_gb: 80 }
      expect(validateGPU(gpu)).toBe(true)
    })

    it('rejects GPU with missing name', () => {
      const gpu = { vram_gb: 80 }
      expect(validateGPU(gpu)).toBe(false)
    })

    it('rejects GPU with empty name', () => {
      const gpu = { name: "   ", vram_gb: 80 }
      expect(validateGPU(gpu)).toBe(false)
    })

    it('rejects GPU with invalid VRAM', () => {
      const gpu = { name: "NVIDIA A100", vram_gb: -1 }
      expect(validateGPU(gpu)).toBe(false)
    })

    it('rejects null/undefined GPU', () => {
      expect(validateGPU(null)).toBe(false)
      expect(validateGPU(undefined)).toBe(false)
    })
  })

  describe('validateModel', () => {
    it('validates correct model object', () => {
      const model = {
        name: "Llama 2 7B",
        size_gb: 13.5,
        memory_factor: 1.0
      }
      expect(validateModel(model)).toBe(true)
    })

    it('rejects model with missing properties', () => {
      const model = { name: "Llama 2 7B" }
      expect(validateModel(model)).toBe(false)
    })

    it('rejects model with invalid size', () => {
      const model = {
        name: "Llama 2 7B",
        size_gb: -1,
        memory_factor: 1.0
      }
      expect(validateModel(model)).toBe(false)
    })

    it('rejects model with invalid memory factor', () => {
      const model = {
        name: "Llama 2 7B",
        size_gb: 13.5,
        memory_factor: 1.5
      }
      expect(validateModel(model)).toBe(false)
    })
  })

  describe('createCustomGPU', () => {
    it('creates custom GPU object', () => {
      const gpu = createCustomGPU("Custom GPU", 48)
      
      expect(gpu.name).toBe("Custom GPU")
      expect(gpu.vram_gb).toBe(48)
      expect(gpu.custom).toBe(true)
    })

    it('trims whitespace from name', () => {
      const gpu = createCustomGPU("  Custom GPU  ", 48)
      expect(gpu.name).toBe("Custom GPU")
    })
  })

  describe('createCustomModel', () => {
    it('creates custom model object with defaults', () => {
      const model = createCustomModel("Custom Model", 14.5)
      
      expect(model.name).toBe("Custom Model")
      expect(model.size_gb).toBe(14.5)
      expect(model.quantization).toBe("fp16")
      expect(model.memory_factor).toBe(1.0)
      expect(model.custom).toBe(true)
    })

    it('creates custom model with specified quantization', () => {
      const model = createCustomModel("Custom Model", 7.25, "awq", 0.5)
      
      expect(model.quantization).toBe("awq")
      expect(model.memory_factor).toBe(0.5)
    })

    it('trims whitespace from name', () => {
      const model = createCustomModel("  Custom Model  ", 14.5)
      expect(model.name).toBe("Custom Model")
    })
  })
})
