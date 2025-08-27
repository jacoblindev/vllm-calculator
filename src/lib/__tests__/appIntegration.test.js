/**
 * App Integration Tests: Full Application Flow
 * 
 * These tests verify the complete integration of the App.vue component
 * with all child components, Pinia stores, and the calculation engine for 
 * end-to-end user flows. Updated for modular component architecture.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Mock all external dependencies
vi.mock('../dataLoader.js', () => ({
  loadGPUData: vi.fn(),
  loadModelData: vi.fn(),
  validateGPU: vi.fn(),
  validateModel: vi.fn()
}))

// Mock calculation engine for predictable test results
vi.mock('../calculationEngine.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    generateConfiguration: vi.fn((gpus, models, workloadType = 'balanced') => {
      const gpuCount = Array.isArray(gpus) ? gpus.reduce((sum, g) => sum + (g.quantity || 1), 0) : 1
      return {
        config: {
          gpu_memory_utilization: 0.85,
          max_model_len: 8192,
          enforce_eager: false,
          disable_sliding_window: false,
          swap_space: 4,
          gpu_memory_threshold: 0.9,
          tensor_parallel_size: gpuCount,
          quantization: 'fp16'
        },
        parameters: [
          { name: '--tensor-parallel-size', value: gpuCount.toString() },
          { name: '--gpu-memory-utilization', value: '0.85' },
          { name: '--max-model-len', value: '8192' }
        ],
        vramBreakdown: {
          modelWeights: 8000,
          kvCache: 4000,
          activations: 2000,
          overhead: 1000,
          total: 15000
        },
        performance: {
          expectedThroughput: 25.5,
          expectedLatency: 120
        },
        warnings: [],
        workloadOptimizations: {
          type: workloadType,
          adjustments: ['memory_efficient']
        },
        command: gpuCount > 1 ? 
          `vllm serve --model test-model --gpu-memory-utilization 0.85 --tensor-parallel-size ${gpuCount}` :
          'vllm serve --model test-model --gpu-memory-utilization 0.85'
      }
    }),
    calculateVLLMMemoryUsage: vi.fn(() => ({
      modelWeights: 8000,
      kvCache: 4000,
      activations: 2000,
      overhead: 1000,
      total: 15000
    })),
    validateConfiguration: vi.fn(() => ({
      isValid: true,
      warnings: [],
      errors: []
    })),
    estimateModelArchitecture: vi.fn(() => ({
      architecture: 'transformer',
      estimated: true,
      confidence: 0.85
    })),
    generateVLLMCommand: vi.fn((config) => {
      const baseCommand = 'vllm serve --model test-model --gpu-memory-utilization 0.85'
      // Check for tensor_parallel_size in config or extract from context
      const tpSize = config?.tensor_parallel_size || 
                   (config?.parameters?.find?.(p => p.name === '--tensor-parallel-size')?.value) ||
                   1
      if (tpSize > 1) {
        return `${baseCommand} --tensor-parallel-size ${tpSize}`
      }
      return baseCommand
    }),
    // Legacy functions for backward compatibility with tests
    calculateThroughputOptimizedConfig: vi.fn(() => ({
      config: { tensor_parallel_size: 2, gpu_memory_utilization: 0.9 },
      performance: { expectedThroughput: 35.0 }
    })),
    calculateBalancedOptimizedConfig: vi.fn(() => ({
      config: { tensor_parallel_size: 1, gpu_memory_utilization: 0.85 },
      performance: { expectedThroughput: 25.0 }
    })),
    checkModelGPUCompatibility: vi.fn(() => ({
      isCompatible: true,
      warnings: [],
      recommendations: []
    }))
  }
})

vi.mock('../memory/vramBreakdown.js', () => ({
  calculateVRAMBreakdown: vi.fn()
}))

vi.mock('../memory/kvCache.js', () => ({
  calculateKVCacheMemory: vi.fn(() => 4000)
}))

vi.mock('../memory/activations.js', () => ({
  calculateActivationMemory: vi.fn(() => 2000)
}))

vi.mock('../quantization.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    generateQuantizationRecommendation: vi.fn(() => ({
      recommendedFormat: 'awq',
      memorySavings: 0.65,
      qualityImpact: 'minimal',
      compatibility: true,
      recommendation: {
        format: 'awq',
        expectedSavings: '65%',
        quality: 'minimal degradation'
      }
    })),
    calculateModelWeightsMemory: vi.fn(() => 8000),
    recommendQuantization: vi.fn(() => ({
      recommendedFormat: 'awq',
      memorySavings: 0.65,
      qualityImpact: 'minimal'
    })),
    QUANTIZATION_FORMATS: actual.QUANTIZATION_FORMATS || {
      fp16: { bitsPerParam: 16, bytesPerParam: 2.0, memoryEfficiency: 0.5, qualityLoss: 0.02 },
      awq: { bitsPerParam: 4, bytesPerParam: 0.5, memoryEfficiency: 0.125, qualityLoss: 0.05 }
    }
  }
})

// Test data
const mockGPUs = [
  { name: 'NVIDIA A100', vram_gb: 80, memory_bandwidth: 1935 },
  { name: 'NVIDIA RTX 4090', vram_gb: 24, memory_bandwidth: 1008 }
]

const mockModels = [
  { 
    name: 'meta-llama/Llama-2-7b-hf', 
    size: 13.5, 
    parameters: 7000000000,
    quantization: 'fp16',
    architecture: 'llama2',
    hiddenSize: 4096,
    numAttentionHeads: 32,
    numKeyValueHeads: 32,
    numLayers: 32,
    intermediateSize: 11008,
    maxPositionEmbeddings: 4096,
    vocabSize: 32000
  },
  { 
    name: 'meta-llama/Llama-2-13b-hf', 
    size: 26.0, 
    parameters: 13000000000,
    quantization: 'fp16',
    architecture: 'llama2',
    hiddenSize: 5120,
    numAttentionHeads: 40,
    numKeyValueHeads: 40,
    numLayers: 40,
    intermediateSize: 13824,
    maxPositionEmbeddings: 4096,
    vocabSize: 32000
  }
]

const mockThroughputConfig = {
  parameters: {
    'gpu-memory-utilization': '0.90',
    'max-model-len': '2048',
    'max-num-seqs': '256',
    'tensor-parallel-size': '1'
  },
  metrics: {
    estimatedThroughput: 120,
    memoryUtilization: 0.85
  },
  command: 'python -m vllm.entrypoints.openai.api_server --model meta-llama/Llama-2-7b-hf --gpu-memory-utilization 0.90'
}

const mockBalancedConfig = {
  parameters: {
    'gpu-memory-utilization': '0.85',
    'max-model-len': '2048',
    'max-num-seqs': '128',
    'tensor-parallel-size': '1'
  },
  metrics: {
    estimatedThroughput: 100,
    memoryUtilization: 0.75
  },
  command: 'python -m vllm.entrypoints.openai.api_server --model meta-llama/Llama-2-7b-hf --gpu-memory-utilization 0.85'
}

const mockVRAMBreakdown = {
  breakdown: {
    modelWeights: { sizeGB: 13.5, percentage: 45 },
    kvCache: { sizeGB: 15.2, percentage: 51 },
    activations: { sizeGB: 0.8, percentage: 3 },
    systemOverhead: { sizeGB: 0.5, percentage: 1 }
  },
  summary: {
    usedMemory: 30.0,
    totalAllocated: 32.0,
    utilizationPercent: 40
  },
  compatibility: {
    supportsModel: true,
    memoryPressure: 'low'
  }
}

describe('App Integration Tests: Full Application Flow', () => {
  let App, dataLoader, calculationEngine, vramBreakdown, quantization
  let wrapper
  let pinia

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Create fresh Pinia instance for each test
    pinia = createPinia()
    setActivePinia(pinia)
    
    // Import modules
    dataLoader = await import('../dataLoader.js')
    calculationEngine = await import('../calculationEngine.js')
    vramBreakdown = await import('../memory/vramBreakdown.js')
    quantization = await import('../quantization.js')
    
    // Setup mock returns
    dataLoader.loadGPUData.mockResolvedValue(mockGPUs)
    dataLoader.loadModelData.mockResolvedValue(mockModels)
    dataLoader.validateGPU.mockReturnValue(true)
    dataLoader.validateModel.mockReturnValue(true)
    
    calculationEngine.calculateThroughputOptimizedConfig.mockReturnValue(mockThroughputConfig)
    calculationEngine.calculateBalancedOptimizedConfig.mockReturnValue(mockBalancedConfig)
    calculationEngine.checkModelGPUCompatibility.mockReturnValue({
      compatible: true,
      utilizationPercent: 65,
      recommendations: ['Configuration looks good']
    })
    
    vramBreakdown.calculateVRAMBreakdown.mockReturnValue(mockVRAMBreakdown)
    
    quantization.recommendQuantization.mockReturnValue({
      recommendedFormat: 'awq',
      memorySavings: 30,
      qualityImpact: 'minimal',
      reason: 'Optimal balance of memory and quality'
    })
    
    // Import App component after mocks are set up
    App = (await import('../../App.vue')).default
  })

  const mountAppWithStores = () => {
    return mount(App, {
      global: {
        plugins: [pinia]
      }
    })
  }

  describe('Complete User Flow: GPU + Model → Configuration', () => {
    it('should handle the complete selection → configuration flow', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      // Wait for initial load
      await wrapper.vm.$nextTick()
      
      // Simulate GPU selection through store actions
      const gpuSelection = [{ gpu: mockGPUs[0], quantity: 1 }]
      gpuStore.updateSelectedGPUs(gpuSelection)
      await wrapper.vm.$nextTick()
      
      // Simulate model selection through store actions
      const modelSelection = [mockModels[0]]
      modelStore.updateSelectedModels(modelSelection)
      await wrapper.vm.$nextTick()
      
      // Verify store state
      expect(gpuStore.totalVRAM).toBe(80)
      expect(modelStore.totalModelSize).toBe(13.5)
      expect(configStore.hasValidConfiguration).toBe(true)
      
      // Verify configurations are generated via store getters
      const configurations = configStore.configurations
      expect(configurations).toHaveLength(3)
      
      // Verify configuration types
      const configTypes = configurations.map(c => c.type)
      expect(configTypes).toContain('throughput')
      expect(configTypes).toContain('latency')
      expect(configTypes).toContain('balanced')
    })

    it('should calculate VRAM breakdown correctly through stores', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      // Set up configuration
      gpuStore.updateSelectedGPUs([{ gpu: mockGPUs[0], quantity: 1 }])
      modelStore.updateSelectedModels([mockModels[0]])
      await wrapper.vm.$nextTick()
      
      // Check VRAM breakdown from store
      const breakdown = configStore.vramBreakdown
      expect(breakdown).toBeDefined()
      expect(breakdown).toHaveProperty('modelWeights')
      expect(breakdown).toHaveProperty('kvCache')
      expect(breakdown).toHaveProperty('activations')
      expect(breakdown).toHaveProperty('systemOverhead')
      
      expect(breakdown.modelWeights).toBeGreaterThan(0)
      expect(breakdown.kvCache).toBeGreaterThan(0)
    })

    it('should provide quantization recommendations through stores', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      // Set up configuration with memory pressure
      gpuStore.updateSelectedGPUs([{ gpu: mockGPUs[1], quantity: 1 }]) // RTX 4090
      modelStore.updateSelectedModels([mockModels[1]]) // Llama-2-13B (larger model)
      await wrapper.vm.$nextTick()
      
      const recommendations = configStore.quantizationRecommendations
      expect(recommendations).toHaveLength(1)
      expect(recommendations[0]).toHaveProperty('recommendedFormat')
      expect(recommendations[0]).toHaveProperty('memorySavings')
    })
  })

  describe('Multi-GPU Scenarios', () => {
    it('should handle multi-GPU configurations correctly', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      // Set up multi-GPU configuration
      const multiGPUSelection = [{ gpu: mockGPUs[0], quantity: 4 }]
      gpuStore.updateSelectedGPUs(multiGPUSelection)
      modelStore.updateSelectedModels([mockModels[1]]) // Larger model for multi-GPU
      await wrapper.vm.$nextTick()
      
      expect(gpuStore.totalVRAM).toBe(320) // 4 * 80GB
      expect(configStore.hasValidConfiguration).toBe(true)
      
      // Configurations should include tensor parallelism
      const configs = configStore.configurations
      configs.forEach(config => {
        if (config.command) {
          expect(config.command).toContain('tensor-parallel-size')
        }
      })
    })

    it('should handle mixed GPU types', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      // Set up mixed GPU configuration
      const mixedGPUSelection = [
        { gpu: mockGPUs[0], quantity: 2 }, // 2x A100
        { gpu: mockGPUs[1], quantity: 1 }  // 1x RTX 4090
      ]
      gpuStore.updateSelectedGPUs(mixedGPUSelection)
      modelStore.updateSelectedModels([mockModels[0]])
      await wrapper.vm.$nextTick()
      
      expect(gpuStore.totalVRAM).toBe(184) // (80*2) + 24
      expect(configStore.hasValidConfiguration).toBe(true)
      
      // Should generate configurations despite mixed setup
      expect(configStore.configurations.length).toBeGreaterThan(0)
    })
  })

  describe('State Management and Persistence', () => {
    it('should maintain state consistency across selections', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      // Initial state
      expect(gpuStore.selectedGPUs).toEqual([])
      expect(modelStore.selectedModels).toEqual([])
      expect(configStore.hasValidConfiguration).toBe(false)
      
      // Add GPU
      gpuStore.updateSelectedGPUs([{ gpu: mockGPUs[0], quantity: 1 }])
      await wrapper.vm.$nextTick()
      expect(configStore.hasValidConfiguration).toBe(false) // No models yet
      
      // Add model
      modelStore.updateSelectedModels([mockModels[0]])
      await wrapper.vm.$nextTick()
      expect(configStore.hasValidConfiguration).toBe(true) // Now complete
      
      // Remove GPU
      gpuStore.clearAllGPUs()
      await wrapper.vm.$nextTick()
      expect(configStore.hasValidConfiguration).toBe(false) // Incomplete again
    })

    it('should calculate state analysis correctly', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      gpuStore.updateSelectedGPUs([{ gpu: mockGPUs[0], quantity: 2 }])
      modelStore.updateSelectedModels([mockModels[0], mockModels[1]])
      await wrapper.vm.$nextTick()
      
      const analysis = configStore.stateAnalysis
      expect(analysis.gpuCount).toBe(2)
      expect(analysis.modelCount).toBe(2)
      expect(analysis.isComplete).toBe(true)
      expect(analysis.hasMultipleModels).toBe(true)
      expect(analysis.memoryEfficiency).toBeGreaterThan(0)
    })

    it('should detect memory pressure correctly', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      // Low memory pressure scenario
      gpuStore.updateSelectedGPUs([{ gpu: mockGPUs[0], quantity: 4 }]) // 320GB
      modelStore.updateSelectedModels([mockModels[0]]) // 13.5GB
      await wrapper.vm.$nextTick()
      
      expect(configStore.memoryPressure).toBe('low')
      
      // High memory pressure scenario
      gpuStore.updateSelectedGPUs([{ gpu: mockGPUs[1], quantity: 1 }]) // 24GB
      modelStore.updateSelectedModels([mockModels[1]]) // 26GB
      await wrapper.vm.$nextTick()
      
      expect(configStore.memoryPressure).toBe('critical')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle calculation engine errors gracefully', async () => {
      calculationEngine.calculateThroughputOptimizedConfig.mockImplementation(() => {
        throw new Error('Calculation failed')
      })
      
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      gpuStore.updateSelectedGPUs([{ gpu: mockGPUs[0], quantity: 1 }])
      modelStore.updateSelectedModels([mockModels[0]])
      await wrapper.vm.$nextTick()
      
      // Should still have configurations (fallback)
      expect(configStore.configurations).toBeDefined()
      // May be empty or fallback configurations
    })

    it('should handle invalid GPU/model combinations', async () => {
      calculationEngine.checkModelGPUCompatibility.mockReturnValue({
        compatible: false,
        utilizationPercent: 150,
        recommendations: ['Consider using quantization or a larger GPU']
      })
      
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      gpuStore.updateSelectedGPUs([{ gpu: { name: 'Tiny GPU', vram_gb: 4 }, quantity: 1 }])
      modelStore.updateSelectedModels([mockModels[1]]) // Large model
      await wrapper.vm.$nextTick()
      
      expect(configStore.hasValidConfiguration).toBe(true) // Still valid for UI
      expect(configStore.memoryPressure).toBe('critical')
      
      const health = configStore.configurationHealth
      expect(health.status).toBe('critical')
      expect(health.issues.length).toBeGreaterThan(0)
    })

    it('should handle empty selections gracefully', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      // No selections
      expect(gpuStore.totalVRAM).toBe(0)
      expect(modelStore.totalModelSize).toBe(0)
      expect(configStore.hasValidConfiguration).toBe(false)
      expect(configStore.configurations).toEqual([])
      expect(configStore.memoryPressure).toBe('unknown')
    })
  })

  describe('Performance and Optimization', () => {
    it('should generate different optimization strategies', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      gpuStore.updateSelectedGPUs([{ gpu: mockGPUs[0], quantity: 1 }])
      modelStore.updateSelectedModels([mockModels[0]])
      await wrapper.vm.$nextTick()
      
      const configs = configStore.configurations
      expect(configs).toHaveLength(3)
      
      const throughputConfig = configs.find(c => c.type === 'throughput')
      const balancedConfig = configs.find(c => c.type === 'balanced')
      const latencyConfig = configs.find(c => c.type === 'latency')
      
      expect(throughputConfig).toBeDefined()
      expect(balancedConfig).toBeDefined()
      expect(latencyConfig).toBeDefined()
      
      // Configs should have different characteristics
      expect(throughputConfig.parameters).not.toEqual(balancedConfig.parameters)
    })

    it('should provide appropriate configuration health assessment', async () => {
      const wrapper = mountAppWithStores()
      
      // Import and access Pinia stores
      const { useGpuStore } = await import('../../stores/gpuStore.js')
      const { useModelStore } = await import('../../stores/modelStore.js')
      const { useConfigStore } = await import('../../stores/configStore.js')
      
      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      // Healthy configuration
      gpuStore.updateSelectedGPUs([{ gpu: mockGPUs[0], quantity: 1 }])
      modelStore.updateSelectedModels([mockModels[0]])
      await wrapper.vm.$nextTick()
      
      let health = configStore.configurationHealth
      expect(health.status).toBe('healthy')
      expect(health.issues).toHaveLength(0)
      
      // Problematic configuration
      gpuStore.updateSelectedGPUs(Array(20).fill({ gpu: mockGPUs[1], quantity: 1 }))
      await wrapper.vm.$nextTick()
      
      health = configStore.configurationHealth
      expect(health.status).toBe('critical')
      expect(health.issues.length).toBeGreaterThan(0)
    })
  })
})
