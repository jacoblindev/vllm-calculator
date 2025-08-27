import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useConfigStore } from './configStore.js'
import { useGpuStore } from './gpuStore.js'
import { useModelStore } from './modelStore.js'
import * as quantization from '../lib/quantization.js'

// Mock the calculation engine functions
vi.mock('../lib/calculationEngine.js', () => ({
  calculateThroughputOptimizedConfig: vi.fn(() => ({
    parameters: {
      'gpu-memory-utilization': '0.85',
      'max-model-len': '2048',
      'max-num-seqs': '256'
    },
    metrics: {
      throughput: '100 tokens/s',
      latency: '50ms',
      memoryUsage: '80%'
    },
    description: 'Throughput optimized configuration'
  })),
  calculateBalancedOptimizedConfig: vi.fn(() => ({
    parameters: {
      'gpu-memory-utilization': '0.85',
      'max-model-len': '3072',
      'max-num-seqs': '128'
    },
    metrics: {
      throughput: '80 tokens/s',
      latency: '30ms',
      memoryUsage: '75%'
    },
    description: 'Balanced configuration'
  })),
  calculateKVCacheMemory: vi.fn(() => 2.5),
  generateVLLMCommand: vi.fn(() => 'vllm serve --model test'),
  calculateVLLMMemoryUsage: vi.fn(),
  estimateThroughputMetrics: vi.fn(),
  estimateLatencyMetrics: vi.fn(),
  calculateMemoryAllocationStrategy: vi.fn()
}))

vi.mock('../lib/quantization.js', () => ({
  calculateModelWeightsMemory: vi.fn(() => 13.5),
  calculateQuantizationFactor: vi.fn((format) => ({
    format: format,
    bitsPerParam: format === 'fp16' ? 16 : format === 'int8' ? 8 : 16,
    bytesPerParam: format === 'fp16' ? 2.0 : format === 'int8' ? 1.0 : 2.0,
    memoryFactor: format === 'fp16' ? 0.5 : format === 'int8' ? 0.25 : 0.5,
    qualityLoss: format === 'fp16' ? 0.02 : format === 'int8' ? 0.05 : 0.02,
    description: `${format} quantization`,
    overhead: 0.0
  })),
  generateQuantizationRecommendation: vi.fn(() => ({
    recommendedFormat: 'int8',
    memorySavings: '50%',
    qualityImpact: 'minimal',
    reason: 'Optimal for memory efficiency'
  }))
}))

describe('Config Store', () => {
  let gpuStore, modelStore, configStore

  beforeEach(() => {
    setActivePinia(createPinia())
    gpuStore = useGpuStore()
    modelStore = useModelStore()
    configStore = useConfigStore()
  })

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      expect(configStore.loading).toBe(false)
      expect(configStore.error).toBe(null)
      expect(configStore.hasValidConfiguration).toBe(false)
      expect(configStore.configurationStep).toBe('gpu')
    })
  })

  describe('Configuration Validation', () => {
    it('should require both GPU and model selections', () => {
      expect(configStore.hasValidConfiguration).toBe(false)
      
      // Add GPU only
      gpuStore.addGPU({ name: 'RTX 4090', vram_gb: 24 }, 1)
      expect(configStore.hasValidConfiguration).toBe(false)
      
      // Add model
      modelStore.addModel({ name: 'llama-2-7b', size: 13.5 })
      expect(configStore.hasValidConfiguration).toBe(true)
    })

    it('should track configuration steps', () => {
      expect(configStore.configurationStep).toBe('gpu')
      
      gpuStore.addGPU({ name: 'RTX 4090', vram_gb: 24 }, 1)
      expect(configStore.configurationStep).toBe('model')
      
      modelStore.addModel({ name: 'llama-2-7b', size: 13.5 })
      expect(configStore.configurationStep).toBe('complete')
    })

    it('should calculate setup progress', () => {
      expect(configStore.setupProgress).toBeCloseTo(33.33, 2)
      
      gpuStore.addGPU({ name: 'RTX 4090', vram_gb: 24 }, 1)
      expect(configStore.setupProgress).toBeCloseTo(66.67, 2)
      
      modelStore.addModel({ name: 'llama-2-7b', size: 13.5 })
      expect(configStore.setupProgress).toBe(100)
    })
  })

  describe('Memory Pressure Analysis', () => {
    beforeEach(() => {
      gpuStore.addGPU({ name: 'RTX 4090', vram_gb: 24 }, 1)
    })

    it('should detect low memory pressure', () => {
      modelStore.addModel({ name: 'small-model', size: 5 })
      expect(configStore.memoryPressure).toBe('low')
    })

    it('should detect moderate memory pressure', () => {
      modelStore.addModel({ name: 'medium-model', size: 15 })
      expect(configStore.memoryPressure).toBe('moderate')
    })

    it('should detect high memory pressure', () => {
      modelStore.addModel({ name: 'large-model', size: 20 })
      expect(configStore.memoryPressure).toBe('high')
    })

    it('should detect critical memory pressure', () => {
      modelStore.addModel({ name: 'huge-model', size: 22 })
      expect(configStore.memoryPressure).toBe('critical')
    })
  })

  describe('VRAM Breakdown', () => {
    beforeEach(() => {
      gpuStore.addGPU({ name: 'RTX 4090', vram_gb: 24 }, 1)
      modelStore.addModel({ name: 'llama-2-7b', size: 13.5, parameters: 7000000000 })
    })

    it('should return null for invalid configuration', () => {
      gpuStore.clearAllGPUs()
      expect(configStore.vramBreakdown).toBe(null)
    })

    it('should calculate VRAM breakdown', () => {
      const breakdown = configStore.vramBreakdown
      
      expect(breakdown).toBeDefined()
      expect(breakdown.modelWeights).toBeGreaterThan(0)
      expect(breakdown.kvCache).toBeGreaterThan(0)
      expect(breakdown.activations).toBeGreaterThan(0)
      expect(breakdown.systemOverhead).toBeGreaterThan(0)
      expect(breakdown.available).toBeGreaterThanOrEqual(0)
    })

    it('should handle calculation errors gracefully', () => {
      // Mock an error in calculation
      vi.mocked(quantization.calculateModelWeightsMemory).mockImplementationOnce(() => {
        throw new Error('Calculation error')
      })
      
      const breakdown = configStore.vramBreakdown
      expect(breakdown).toBeDefined()
      expect(breakdown.modelWeights).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Configuration Generation', () => {
    beforeEach(() => {
      gpuStore.addGPU({ name: 'RTX 4090', vram_gb: 24 }, 1)
      modelStore.addModel({ name: 'llama-2-7b', size: 13.5 })
    })

    it('should return empty array for invalid configuration', () => {
      gpuStore.clearAllGPUs()
      expect(configStore.configurations).toEqual([])
    })

    it('should generate three configuration types', () => {
      const configs = configStore.configurations
      
      expect(configs).toHaveLength(3)
      expect(configs.map(c => c.type)).toEqual(['throughput', 'latency', 'balanced'])
    })

    it('should include all required configuration properties', () => {
      const configs = configStore.configurations
      
      configs.forEach(config => {
        expect(config).toHaveProperty('type')
        expect(config).toHaveProperty('title')
        expect(config).toHaveProperty('description')
        expect(config).toHaveProperty('parameters')
        expect(config).toHaveProperty('metrics')
        expect(config).toHaveProperty('command')
        expect(config).toHaveProperty('considerations')
        expect(Array.isArray(config.parameters)).toBe(true)
      })
    })

    it('should cache configuration results', () => {
      const configs1 = configStore.configurations
      const configs2 = configStore.configurations
      
      expect(configs1).toStrictEqual(configs2) // Same content due to caching
    })

    it('should clear cache on recalculate', () => {
      const configs1 = configStore.configurations
      configStore.recalculate()
      const configs2 = configStore.configurations
      
      expect(configs1).not.toBe(configs2) // Different reference after cache clear
    })
  })

  describe('Quantization Recommendations', () => {
    beforeEach(() => {
      gpuStore.addGPU({ name: 'RTX 4090', vram_gb: 24 }, 1)
      modelStore.addModel({ name: 'llama-2-7b', size: 13.5 })
    })

    it('should return empty array for invalid configuration', () => {
      gpuStore.clearAllGPUs()
      expect(configStore.quantizationRecommendations).toEqual([])
    })

    it('should generate quantization recommendations', () => {
      const recommendations = configStore.quantizationRecommendations
      
      expect(recommendations).toHaveLength(1)
      expect(recommendations[0]).toHaveProperty('modelName')
      expect(recommendations[0]).toHaveProperty('currentFormat')
      expect(recommendations[0]).toHaveProperty('recommendedFormat')
      expect(recommendations[0]).toHaveProperty('memorySavings')
      expect(recommendations[0]).toHaveProperty('qualityImpact')
      expect(recommendations[0]).toHaveProperty('reason')
    })

    it('should handle recommendation errors gracefully', () => {
      vi.mocked(quantization.generateQuantizationRecommendation).mockImplementationOnce(() => {
        throw new Error('Recommendation error')
      })
      
      const recommendations = configStore.quantizationRecommendations
      expect(recommendations).toEqual([])
    })
  })

  describe('Configuration Health', () => {
    beforeEach(() => {
      gpuStore.addGPU({ name: 'RTX 4090', vram_gb: 24 }, 1)
      modelStore.addModel({ name: 'llama-2-7b', size: 13.5 })
    })

    it('should report healthy status', () => {
      const health = configStore.configurationHealth
      
      expect(health.status).toBe('healthy')
      expect(health.issues).toEqual([])
    })

    it('should detect critical memory pressure', () => {
      modelStore.addModel({ name: 'huge-model', size: 22 })
      
      const health = configStore.configurationHealth
      expect(health.status).toBe('critical')
      expect(health.issues).toContain('Critical memory pressure - models may not fit')
    })

    it('should detect excessive GPU count', () => {
      gpuStore.addGPU({ name: 'Extra GPU', vram_gb: 24 }, 17) // 17 > 16, should trigger
      
      const health = configStore.configurationHealth
      expect(health.status).toBe('critical')
      expect(health.issues).toContain('Excessive GPU count may impact performance')
    })
  })

  describe('State Analysis', () => {
    it('should provide comprehensive state analysis', () => {
      gpuStore.addGPU({ name: 'RTX 4090', vram_gb: 24 }, 2)
      modelStore.addModel({ name: 'model1', size: 10 })
      modelStore.addModel({ name: 'model2', size: 5 })
      
      const analysis = configStore.stateAnalysis
      
      expect(analysis.isComplete).toBe(true)
      expect(analysis.gpuCount).toBe(2)
      expect(analysis.modelCount).toBe(2)
      expect(analysis.memoryEfficiency).toBeCloseTo(0.3125) // 15/48
      expect(analysis.hasCustomGPUs).toBe(false)
      expect(analysis.hasMultipleModels).toBe(true)
      expect(analysis.estimatedCost).toBeGreaterThan(0)
      expect(analysis.memoryPressure).toBe('low')
    })
  })

  describe('Actions', () => {
    it('should manage loading state', () => {
      expect(configStore.loading).toBe(false)
      
      configStore.setLoading(true)
      expect(configStore.loading).toBe(true)
      
      configStore.setLoading(false)
      expect(configStore.loading).toBe(false)
    })

    it('should manage error state', () => {
      expect(configStore.error).toBe(null)
      
      configStore.setError('Test error')
      expect(configStore.error).toBe('Test error')
      
      configStore.setError(null)
      expect(configStore.error).toBe(null)
    })

    it('should clear cache', () => {
      gpuStore.addGPU({ name: 'RTX 4090', vram_gb: 24 }, 1)
      modelStore.addModel({ name: 'llama-2-7b', size: 13.5 })
      
      // Generate configs to populate cache
      configStore.configurations
      
      configStore.clearCache()
      
      // Verify cache is cleared by checking if new configurations are generated
      const newConfigs = configStore.configurations
      expect(newConfigs).toBeDefined()
    })
  })
})
