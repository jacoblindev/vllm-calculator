/**
 * Component Integration Tests: UI Flow Testing
 * 
 * These tests verify the integration between Vue components
 * in the critical user flow:
 * 
 * GPUSelector → ModelSelector → ConfigurationOutput → VRAMChart
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GPUSelector from '../../components/GPUSelector.vue'
import ModelSelector from '../../components/ModelSelector.vue'
import ConfigurationOutput from '../../components/ConfigurationOutput.vue'
import VRAMChart from '../../components/VRAMChart.vue'

// Mock the data loader modules
vi.mock('../../lib/dataLoader.js', () => ({
  loadGPUData: vi.fn(),
  loadModelData: vi.fn(),
  validateGPU: vi.fn(),
  validateModel: vi.fn(),
  createCustomGPU: vi.fn(),
  createCustomModel: vi.fn()
}))

// Mock the calculation engine
vi.mock('../../lib/calculationEngine.js', () => ({
  calculateVLLMMemoryUsage: vi.fn(),
  checkModelGPUCompatibility: vi.fn(),
  calculateThroughputOptimizedConfig: vi.fn(),
  calculateBalancedOptimizedConfig: vi.fn()
}))

// Test data
const mockGPUs = [
  { name: 'NVIDIA A100', vram_gb: 80, memory_bandwidth: 1935 },
  { name: 'NVIDIA H100', vram_gb: 80, memory_bandwidth: 3350 },
  { name: 'NVIDIA RTX 4090', vram_gb: 24, memory_bandwidth: 1008 }
]

const mockModels = [
  { 
    name: 'meta-llama/Llama-2-7b-hf', 
    size: 13.5, 
    parameters: 7000000000,
    quantization: 'fp16'
  },
  { 
    name: 'meta-llama/Llama-2-13b-hf', 
    size: 26.0, 
    parameters: 13000000000,
    quantization: 'fp16'
  }
]

describe('Component Integration Tests: UI Flow Testing', () => {
  let dataLoader, calculationEngine

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Import and setup mocks
    dataLoader = await import('../../lib/dataLoader.js')
    calculationEngine = await import('../../lib/calculationEngine.js')
    
    dataLoader.loadGPUData.mockResolvedValue(mockGPUs)
    dataLoader.loadModelData.mockResolvedValue(mockModels)
    dataLoader.validateGPU.mockReturnValue(true)
    dataLoader.validateModel.mockReturnValue(true)
    dataLoader.createCustomGPU.mockImplementation((name, vram) => ({
      name, vram_gb: vram, custom: true
    }))
    
    calculationEngine.calculateThroughputOptimizedConfig.mockReturnValue({
      parameters: {
        'gpu-memory-utilization': '0.90',
        'max-model-len': '2048',
        'max-num-seqs': '256',
        'tensor-parallel-size': '1'
      },
      metrics: {
        estimatedThroughput: 100,
        memoryUtilization: 0.85
      }
    })
    
    calculationEngine.calculateBalancedOptimizedConfig.mockReturnValue({
      parameters: {
        'gpu-memory-utilization': '0.85',
        'max-model-len': '2048',
        'max-num-seqs': '128',
        'tensor-parallel-size': '1'
      },
      metrics: {
        estimatedThroughput: 80,
        memoryUtilization: 0.75
      }
    })
    
    calculationEngine.checkModelGPUCompatibility.mockReturnValue({
      compatible: true,
      utilizationPercent: 65,
      recommendations: ['Configuration looks good']
    })
  })

  describe('Flow 1: GPU Selection Integration', () => {
    it('should handle GPU selection and emit updates correctly', async () => {
      const wrapper = mount(GPUSelector, {
        props: {
          selectedGPUs: []
        }
      })

      // Wait for component to load GPUs
      await wrapper.vm.$nextTick()
      wrapper.vm.availableGPUs = mockGPUs
      await wrapper.vm.$nextTick()

      // Simulate GPU selection
      wrapper.vm.toggleGPU(mockGPUs[0])
      await wrapper.vm.$nextTick()

      // Verify emission
      expect(wrapper.emitted('update:selectedGPUs')).toBeTruthy()
      const emittedValue = wrapper.emitted('update:selectedGPUs')[0][0]
      expect(emittedValue).toHaveLength(1)
      expect(emittedValue[0].gpu.name).toBe('NVIDIA A100')
      expect(emittedValue[0].quantity).toBe(1)
    })

    it('should calculate totals correctly with multiple GPU selections', async () => {
      const selectedGPUs = [
        { gpu: mockGPUs[0], quantity: 2 }, // 2x A100 (160GB total)
        { gpu: mockGPUs[2], quantity: 1 }  // 1x RTX 4090 (24GB)
      ]

      const wrapper = mount(GPUSelector, {
        props: { selectedGPUs }
      })

      expect(wrapper.vm.totalVRAM).toBe(184) // (80*2) + 24
      expect(wrapper.vm.totalGPUs).toBe(3)   // 2 + 1
    })

    it('should provide appropriate warnings for GPU selections', async () => {
      const lowVRAMSelection = [
        { gpu: { name: 'Low VRAM GPU', vram_gb: 8 }, quantity: 1 }
      ]

      const wrapper = mount(GPUSelector, {
        props: { selectedGPUs: lowVRAMSelection }
      })

      const warnings = wrapper.vm.selectionWarnings
      expect(warnings.some(w => w.type === 'low_vram')).toBe(true)
    })
  })

  describe('Flow 2: Model Selection Integration', () => {
    it('should handle model selection and emit updates correctly', async () => {
      const wrapper = mount(ModelSelector, {
        props: {
          selectedModels: []
        }
      })

      // Wait for component to load models
      await wrapper.vm.$nextTick()
      wrapper.vm.availableModels = mockModels
      await wrapper.vm.$nextTick()

      // Simulate model selection
      wrapper.vm.toggleModel(mockModels[0])
      await wrapper.vm.$nextTick()

      // Verify emission
      expect(wrapper.emitted('update:selectedModels')).toBeTruthy()
      const emittedValue = wrapper.emitted('update:selectedModels')[0][0]
      expect(emittedValue).toHaveLength(1)
      expect(emittedValue[0].name).toBe('meta-llama/Llama-2-7b-hf')
    })

    it('should calculate total model size correctly', async () => {
      const selectedModels = [
        mockModels[0], // 13.5GB
        mockModels[1]  // 26.0GB
      ]

      const wrapper = mount(ModelSelector, {
        props: { selectedModels }
      })

      expect(wrapper.vm.totalModelSize).toBe(39.5) // 13.5 + 26.0
    })
  })

  describe('Flow 3: Configuration Output Integration', () => {
    it('should generate configurations when GPUs and models are selected', async () => {
      const selectedGPUs = [{ gpu: mockGPUs[0], quantity: 1 }]
      const selectedModels = [mockModels[0]]

      const wrapper = mount(ConfigurationOutput, {
        props: {
          selectedGPUs,
          selectedModels
        }
      })

      expect(wrapper.vm.hasConfiguration).toBe(true)
      expect(wrapper.vm.configurations).toHaveLength(3) // throughput, latency, balanced

      // Verify configuration types
      const configTypes = wrapper.vm.configurations.map(c => c.type)
      expect(configTypes).toContain('throughput')
      expect(configTypes).toContain('latency')
      expect(configTypes).toContain('balanced')
    })

    it('should show placeholder when no valid configuration exists', async () => {
      const wrapper = mount(ConfigurationOutput, {
        props: {
          selectedGPUs: [],
          selectedModels: []
        }
      })

      expect(wrapper.vm.hasConfiguration).toBe(false)
      expect(wrapper.text()).toContain('Select GPUs and models to see configuration recommendations')
    })

    it('should calculate resource totals correctly', async () => {
      const selectedGPUs = [
        { gpu: mockGPUs[0], quantity: 2 } // 2x A100
      ]
      const selectedModels = [mockModels[0]] // Llama-2-7B

      const wrapper = mount(ConfigurationOutput, {
        props: {
          selectedGPUs,
          selectedModels
        }
      })

      expect(wrapper.vm.totalVRAM).toBe(160)    // 80 * 2
      expect(wrapper.vm.totalModelSize).toBe(13.5) // Single model
    })

    it('should include tensor parallel settings for multi-GPU configurations', async () => {
      const multiGPUSelection = [
        { gpu: mockGPUs[0], quantity: 4 } // 4x A100
      ]
      const selectedModels = [mockModels[0]]

      const wrapper = mount(ConfigurationOutput, {
        props: {
          selectedGPUs: multiGPUSelection,
          selectedModels
        }
      })

      expect(wrapper.vm.configurations).toHaveLength(3)
      
      // All configurations should include tensor parallelism
      wrapper.vm.configurations.forEach(config => {
        expect(config.command).toContain('--tensor-parallel-size 4')
      })
    })
  })

  describe('Flow 4: VRAM Chart Integration', () => {
    it('should display VRAM breakdown when valid configuration is provided', async () => {
      const gpuSpecs = { name: 'NVIDIA A100', vram_gb: 80 }
      const configuration = {
        type: 'throughput',
        parameters: {
          'gpu-memory-utilization': '0.85',
          'max-model-len': '2048'
        }
      }

      const wrapper = mount(VRAMChart, {
        props: {
          gpuSpecs,
          configuration,
          modelSize: 13.5
        }
      })

      // Component should calculate and display breakdown
      expect(wrapper.vm.vramBreakdown).toBeDefined()
      expect(wrapper.vm.vramBreakdown.breakdown).toBeDefined()
    })

    it('should handle multiple GPU configurations', async () => {
      const multiGPUSpecs = [
        { name: 'NVIDIA A100', vram_gb: 80, quantity: 2 }
      ]
      const configuration = {
        type: 'balanced',
        parameters: {
          'gpu-memory-utilization': '0.80',
          'tensor-parallel-size': '2'
        }
      }

      const wrapper = mount(VRAMChart, {
        props: {
          gpuSpecs: multiGPUSpecs,
          configuration,
          modelSize: 26.0
        }
      })

      // Should handle multi-GPU setup
      expect(wrapper.vm.totalVRAM).toBe(160) // 80 * 2
    })
  })

  describe('Flow 5: End-to-End Component Integration', () => {
    it('should maintain data consistency across component chain', async () => {
      // Step 1: GPU Selection
      const gpuSelector = mount(GPUSelector, {
        props: { selectedGPUs: [] }
      })
      
      gpuSelector.vm.availableGPUs = mockGPUs
      gpuSelector.vm.toggleGPU(mockGPUs[0])
      await gpuSelector.vm.$nextTick()
      
      const selectedGPUs = gpuSelector.emitted('update:selectedGPUs')[0][0]
      
      // Step 2: Model Selection
      const modelSelector = mount(ModelSelector, {
        props: { selectedModels: [] }
      })
      
      modelSelector.vm.availableModels = mockModels
      modelSelector.vm.toggleModel(mockModels[0])
      await modelSelector.vm.$nextTick()
      
      const selectedModels = modelSelector.emitted('update:selectedModels')[0][0]
      
      // Step 3: Configuration Output
      const configOutput = mount(ConfigurationOutput, {
        props: {
          selectedGPUs,
          selectedModels
        }
      })
      
      // Verify data flows correctly
      expect(configOutput.vm.totalVRAM).toBe(80)
      expect(configOutput.vm.totalModelSize).toBe(13.5)
      expect(configOutput.vm.hasConfiguration).toBe(true)
      expect(configOutput.vm.configurations).toHaveLength(3)
      
      // Step 4: VRAM Chart
      const vramChart = mount(VRAMChart, {
        props: {
          gpuSpecs: selectedGPUs[0].gpu,
          configuration: configOutput.vm.configurations[0],
          modelSize: selectedModels[0].size
        }
      })
      
      expect(vramChart.vm.vramBreakdown).toBeDefined()
    })

    it('should handle error states gracefully across components', async () => {
      // Test with invalid data
      dataLoader.loadGPUData.mockRejectedValue(new Error('Network error'))
      dataLoader.loadModelData.mockRejectedValue(new Error('API error'))
      
      const gpuSelector = mount(GPUSelector, {
        props: { selectedGPUs: [] }
      })
      
      const modelSelector = mount(ModelSelector, {
        props: { selectedModels: [] }
      })
      
      // Wait for error states
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Components should handle errors gracefully
      expect(gpuSelector.vm.loadError).toBeTruthy()
      expect(modelSelector.vm.loadError).toBeTruthy()
      
      // Configuration output should show placeholder
      const configOutput = mount(ConfigurationOutput, {
        props: {
          selectedGPUs: [],
          selectedModels: []
        }
      })
      
      expect(configOutput.vm.hasConfiguration).toBe(false)
    })

    it('should validate memory constraints end-to-end', async () => {
      // Test memory-constrained scenario
      const smallGPU = [{ gpu: { name: 'Small GPU', vram_gb: 12 }, quantity: 1 }]
      const largeModel = [{ name: 'Large Model', size: 50, quantization: 'fp16' }]
      
      calculationEngine.checkModelGPUCompatibility.mockReturnValue({
        compatible: false,
        utilizationPercent: 400, // Over capacity
        recommendations: ['Consider using quantization or a larger GPU']
      })
      
      const configOutput = mount(ConfigurationOutput, {
        props: {
          selectedGPUs: smallGPU,
          selectedModels: largeModel
        }
      })
      
      // Should still generate configurations but with warnings
      expect(configOutput.vm.totalVRAM).toBe(12)
      expect(configOutput.vm.totalModelSize).toBe(50)
      
      // Configurations may be generated with aggressive settings
      if (configOutput.vm.configurations.length > 0) {
        const config = configOutput.vm.configurations[0]
        expect(config.parameters).toBeDefined()
        // Should suggest high memory utilization
        expect(parseFloat(config.parameters['gpu-memory-utilization'])).toBeGreaterThan(0.9)
      }
    })
  })
})
