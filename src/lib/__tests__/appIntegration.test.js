/**
 * App Integration Tests: Full Application Flow
 * 
 * These tests verify the complete integration of the App.vue component
 * with all child components and the calculation engine for end-to-end
 * user flows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// Mock all external dependencies
vi.mock('../dataLoader.js', () => ({
  loadGPUData: vi.fn(),
  loadModelData: vi.fn(),
  validateGPU: vi.fn(),
  validateModel: vi.fn()
}))

vi.mock('../calculationEngine.js', () => ({
  calculateVLLMMemoryUsage: vi.fn(),
  checkModelGPUCompatibility: vi.fn(),
  calculateThroughputOptimizedConfig: vi.fn(),
  calculateBalancedOptimizedConfig: vi.fn(),
  estimateThroughputMetrics: vi.fn(),
  estimateLatencyMetrics: vi.fn(),
  calculateMemoryAllocationStrategy: vi.fn(),
  getSupportedQuantizationFormats: vi.fn()
}))

vi.mock('../memory/vramBreakdown.js', () => ({
  calculateVRAMBreakdown: vi.fn()
}))

vi.mock('../quantization.js', () => ({
  recommendQuantization: vi.fn()
}))

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
    architecture: 'llama2'
  },
  { 
    name: 'meta-llama/Llama-2-13b-hf', 
    size: 26.0, 
    parameters: 13000000000,
    quantization: 'fp16',
    architecture: 'llama2'
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

  beforeEach(async () => {
    vi.clearAllMocks()
    
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

  describe('Complete User Flow: GPU + Model → Configuration', () => {
    it('should handle the complete selection → configuration flow', async () => {
      const wrapper = mount(App)
      
      // Wait for initial load
      await wrapper.vm.$nextTick()
      
      // Simulate GPU selection
      const gpuSelection = [{ gpu: mockGPUs[0], quantity: 1 }]
      wrapper.vm.selectedGPUs = gpuSelection
      await wrapper.vm.$nextTick()
      
      // Simulate model selection
      const modelSelection = [mockModels[0]]
      wrapper.vm.selectedModels = modelSelection
      await wrapper.vm.$nextTick()
      
      // Verify computed properties
      expect(wrapper.vm.totalVRAM).toBe(80)
      expect(wrapper.vm.totalModelSize).toBe(13.5)
      expect(wrapper.vm.hasValidConfiguration).toBe(true)
      
      // Verify configurations are generated
      expect(wrapper.vm.configurations).toHaveLength(3)
      
      // Verify configuration types
      const configTypes = wrapper.vm.configurations.map(c => c.type)
      expect(configTypes).toContain('throughput')
      expect(configTypes).toContain('latency')
      expect(configTypes).toContain('balanced')
    })

    it('should calculate VRAM breakdown correctly', async () => {
      const wrapper = mount(App)
      
      // Set up configuration
      wrapper.vm.selectedGPUs = [{ gpu: mockGPUs[0], quantity: 1 }]
      wrapper.vm.selectedModels = [mockModels[0]]
      await wrapper.vm.$nextTick()
      
      // Check VRAM breakdown
      const breakdown = wrapper.vm.vramBreakdown
      expect(breakdown).toBeDefined()
      expect(breakdown.breakdown).toHaveProperty('modelWeights')
      expect(breakdown.breakdown).toHaveProperty('kvCache')
      expect(breakdown.breakdown).toHaveProperty('activations')
      expect(breakdown.breakdown).toHaveProperty('systemOverhead')
      
      expect(breakdown.summary.usedMemory).toBeGreaterThan(0)
      expect(breakdown.compatibility.supportsModel).toBe(true)
    })

    it('should provide quantization recommendations', async () => {
      const wrapper = mount(App)
      
      // Set up configuration with memory pressure
      wrapper.vm.selectedGPUs = [{ gpu: mockGPUs[1], quantity: 1 }] // RTX 4090
      wrapper.vm.selectedModels = [mockModels[1]] // Llama-2-13B (larger model)
      await wrapper.vm.$nextTick()
      
      const recommendations = wrapper.vm.quantizationRecommendations
      expect(recommendations).toHaveLength(1)
      expect(recommendations[0]).toHaveProperty('recommendedFormat')
      expect(recommendations[0]).toHaveProperty('memorySavings')
    })
  })

  describe('Multi-GPU Scenarios', () => {
    it('should handle multi-GPU configurations correctly', async () => {
      const wrapper = mount(App)
      
      // Set up multi-GPU configuration
      const multiGPUSelection = [{ gpu: mockGPUs[0], quantity: 4 }]
      wrapper.vm.selectedGPUs = multiGPUSelection
      wrapper.vm.selectedModels = [mockModels[1]] // Larger model for multi-GPU
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.totalVRAM).toBe(320) // 4 * 80GB
      expect(wrapper.vm.hasValidConfiguration).toBe(true)
      
      // Configurations should include tensor parallelism
      const configs = wrapper.vm.configurations
      configs.forEach(config => {
        if (config.command) {
          expect(config.command).toContain('tensor-parallel-size')
        }
      })
    })

    it('should handle mixed GPU types', async () => {
      const wrapper = mount(App)
      
      // Set up mixed GPU configuration
      const mixedGPUSelection = [
        { gpu: mockGPUs[0], quantity: 2 }, // 2x A100
        { gpu: mockGPUs[1], quantity: 1 }  // 1x RTX 4090
      ]
      wrapper.vm.selectedGPUs = mixedGPUSelection
      wrapper.vm.selectedModels = [mockModels[0]]
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.totalVRAM).toBe(184) // (80*2) + 24
      expect(wrapper.vm.hasValidConfiguration).toBe(true)
      
      // Should generate configurations despite mixed setup
      expect(wrapper.vm.configurations.length).toBeGreaterThan(0)
    })
  })

  describe('State Management and Persistence', () => {
    it('should maintain state consistency across selections', async () => {
      const wrapper = mount(App)
      
      // Initial state
      expect(wrapper.vm.selectedGPUs).toEqual([])
      expect(wrapper.vm.selectedModels).toEqual([])
      expect(wrapper.vm.hasValidConfiguration).toBe(false)
      
      // Add GPU
      wrapper.vm.selectedGPUs = [{ gpu: mockGPUs[0], quantity: 1 }]
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.hasValidConfiguration).toBe(false) // No models yet
      
      // Add model
      wrapper.vm.selectedModels = [mockModels[0]]
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.hasValidConfiguration).toBe(true) // Now complete
      
      // Remove GPU
      wrapper.vm.selectedGPUs = []
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.hasValidConfiguration).toBe(false) // Incomplete again
    })

    it('should calculate state analysis correctly', async () => {
      const wrapper = mount(App)
      
      wrapper.vm.selectedGPUs = [{ gpu: mockGPUs[0], quantity: 2 }]
      wrapper.vm.selectedModels = [mockModels[0], mockModels[1]]
      await wrapper.vm.$nextTick()
      
      const analysis = wrapper.vm.stateAnalysis
      expect(analysis.gpuCount).toBe(2)
      expect(analysis.modelCount).toBe(2)
      expect(analysis.isComplete).toBe(true)
      expect(analysis.hasMultipleModels).toBe(true)
      expect(analysis.memoryEfficiency).toBeGreaterThan(0)
    })

    it('should detect memory pressure correctly', async () => {
      const wrapper = mount(App)
      
      // Low memory pressure scenario
      wrapper.vm.selectedGPUs = [{ gpu: mockGPUs[0], quantity: 4 }] // 320GB
      wrapper.vm.selectedModels = [mockModels[0]] // 13.5GB
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.memoryPressure).toBe('low')
      
      // High memory pressure scenario
      wrapper.vm.selectedGPUs = [{ gpu: mockGPUs[1], quantity: 1 }] // 24GB
      wrapper.vm.selectedModels = [mockModels[1]] // 26GB
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.memoryPressure).toBe('critical')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle calculation engine errors gracefully', async () => {
      calculationEngine.calculateThroughputOptimizedConfig.mockImplementation(() => {
        throw new Error('Calculation failed')
      })
      
      const wrapper = mount(App)
      
      wrapper.vm.selectedGPUs = [{ gpu: mockGPUs[0], quantity: 1 }]
      wrapper.vm.selectedModels = [mockModels[0]]
      await wrapper.vm.$nextTick()
      
      // Should still have configurations (fallback)
      expect(wrapper.vm.configurations).toBeDefined()
      // May be empty or fallback configurations
    })

    it('should handle invalid GPU/model combinations', async () => {
      calculationEngine.checkModelGPUCompatibility.mockReturnValue({
        compatible: false,
        utilizationPercent: 150,
        recommendations: ['Consider using quantization or a larger GPU']
      })
      
      const wrapper = mount(App)
      
      wrapper.vm.selectedGPUs = [{ gpu: { name: 'Tiny GPU', vram_gb: 4 }, quantity: 1 }]
      wrapper.vm.selectedModels = [mockModels[1]] // Large model
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.hasValidConfiguration).toBe(true) // Still valid for UI
      expect(wrapper.vm.memoryPressure).toBe('critical')
      
      const health = wrapper.vm.configurationHealth
      expect(health.status).toBe('critical')
      expect(health.issues.length).toBeGreaterThan(0)
    })

    it('should handle empty selections gracefully', async () => {
      const wrapper = mount(App)
      
      // No selections
      expect(wrapper.vm.totalVRAM).toBe(0)
      expect(wrapper.vm.totalModelSize).toBe(0)
      expect(wrapper.vm.hasValidConfiguration).toBe(false)
      expect(wrapper.vm.configurations).toEqual([])
      expect(wrapper.vm.memoryPressure).toBe('unknown')
    })
  })

  describe('Performance and Optimization', () => {
    it('should generate different optimization strategies', async () => {
      const wrapper = mount(App)
      
      wrapper.vm.selectedGPUs = [{ gpu: mockGPUs[0], quantity: 1 }]
      wrapper.vm.selectedModels = [mockModels[0]]
      await wrapper.vm.$nextTick()
      
      const configs = wrapper.vm.configurations
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
      const wrapper = mount(App)
      
      // Healthy configuration
      wrapper.vm.selectedGPUs = [{ gpu: mockGPUs[0], quantity: 1 }]
      wrapper.vm.selectedModels = [mockModels[0]]
      await wrapper.vm.$nextTick()
      
      let health = wrapper.vm.configurationHealth
      expect(health.status).toBe('healthy')
      expect(health.issues).toHaveLength(0)
      
      // Problematic configuration
      wrapper.vm.selectedGPUs = Array(20).fill({ gpu: mockGPUs[1], quantity: 1 })
      await wrapper.vm.$nextTick()
      
      health = wrapper.vm.configurationHealth
      expect(health.status).toBe('critical')
      expect(health.issues.length).toBeGreaterThan(0)
    })
  })
})
