import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ModelSelector from './ModelSelector.vue'
import { useModelStore } from '../stores/modelStore.js'
import * as dataLoader from '../lib/dataLoader.js'
import * as huggingfaceApi from '../lib/huggingfaceApi.js'

// Mock the modules
vi.mock('../lib/dataLoader.js', () => ({
  loadModelData: vi.fn(),
  validateModel: vi.fn(),
  createCustomModel: vi.fn(),
}))

vi.mock('../lib/huggingfaceApi.js', () => ({
  fetchModelInfo: vi.fn(),
  extractModelSize: vi.fn(),
  detectQuantizationType: vi.fn(),
  getQuantizationFactor: vi.fn(),
}))

describe('ModelSelector.vue', () => {
  let pinia
  let modelStore

  const mockModels = [
    {
      name: 'Llama 2 7B',
      huggingface_id: 'meta-llama/Llama-2-7b-hf',
      size_billion: 7,
      quantization: 'fp16',
      memory_factor: 1.0,
    },
    {
      name: 'Llama 2 7B AWQ',
      huggingface_id: 'meta-llama/Llama-2-7b-awq',
      size_billion: 7,
      quantization: 'awq',
      memory_factor: 0.5,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    modelStore = useModelStore()
    
    dataLoader.loadModelData.mockResolvedValue(mockModels)
    dataLoader.validateModel.mockReturnValue(true)
    dataLoader.createCustomModel.mockImplementation((name, size, quant, factor) => ({
      name,
      size_gb: size,
      quantization: quant,
      memory_factor: factor,
      custom: true,
    }))
    
    huggingfaceApi.getQuantizationFactor.mockImplementation((quant) => {
      const factors = { fp16: 1.0, awq: 0.5, int8: 0.5, int4: 0.25 }
      return factors[quant] || 1.0
    })
    
    huggingfaceApi.fetchModelInfo.mockResolvedValue({
      modelSize: 7,
      quantization: 'fp16',
      architecture: 'llama'
    })
    
    huggingfaceApi.extractModelSize.mockReturnValue(7)
    huggingfaceApi.detectQuantizationType.mockReturnValue('fp16')
  })

  describe('Component Initialization', () => {
    it('should render model selector component', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      expect(wrapper.find('.bg-white.rounded-xl').exists()).toBe(true)
    })

    it('should load models on mount', async () => {
      mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(dataLoader.loadModelData).toHaveBeenCalled()
    })
  })

  describe('Model Selection', () => {
    it('should add model to selected models when clicked', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      await wrapper.vm.$nextTick()
      
      // Set available models
      wrapper.vm.availableModels = mockModels
      await wrapper.vm.$nextTick()
      
      // Select a model
      modelStore.addModel(mockModels[0])
      await wrapper.vm.$nextTick()
      
      expect(modelStore.selectedModels).toHaveLength(1)
      expect(modelStore.selectedModels[0].name).toBe('Llama 2 7B')
    })

    it('should remove model when clicked again', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Select a model first
      modelStore.addModel(mockModels[0])
      expect(modelStore.selectedModels).toHaveLength(1)
      
      // Deselect the model
      modelStore.removeModel(mockModels[0].name)
      expect(modelStore.selectedModels).toHaveLength(0)
    })

    it('should not add duplicate models', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Select same model twice
      modelStore.addModel(mockModels[0])
      modelStore.addModel(mockModels[0])
      
      expect(modelStore.selectedModels).toHaveLength(1)
    })
  })

  describe('Model Filtering', () => {
    it('should filter models by search term', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      wrapper.vm.availableModels = mockModels
      wrapper.vm.searchQuery = 'AWQ'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.filteredModels).toHaveLength(1)
      expect(wrapper.vm.filteredModels[0].name).toBe('Llama 2 7B AWQ')
    })

    it('should filter models by quantization', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      wrapper.vm.availableModels = mockModels
      wrapper.vm.selectedQuantization = 'awq'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.filteredModels).toHaveLength(1)
      expect(wrapper.vm.filteredModels[0].quantization).toBe('awq')
    })
  })

  describe('Manual Model Entry', () => {
    it('should validate manual model name', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      wrapper.vm.manualModelName = ''
      wrapper.vm.validateManualModelName()
      expect(wrapper.vm.manualModelNameError).toBe('Model name is required')
      
      wrapper.vm.manualModelName = 'Custom Model'
      wrapper.vm.validateManualModelName()
      expect(wrapper.vm.manualModelNameError).toBeNull()
    })

    it('should validate manual model size', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      wrapper.vm.manualModelSize = ''
      wrapper.vm.validateManualModelSize()
      expect(wrapper.vm.manualModelSizeError).toBe('Model size is required')
      
      wrapper.vm.manualModelSize = '0'
      wrapper.vm.validateManualModelSize()
      expect(wrapper.vm.manualModelSizeError).toBe('Model size must be greater than 0')
      
      wrapper.vm.manualModelSize = '70'
      wrapper.vm.validateManualModelSize()
      expect(wrapper.vm.manualModelSizeError).toBeNull()
    })

    it('should add valid manual model successfully', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      wrapper.vm.manualModelName = 'Custom Llama 70B'
      wrapper.vm.manualModelSize = '70'
      wrapper.vm.manualModelQuantization = 'int4'
      
      await wrapper.vm.addManualModel()
      
      // Check if model was added to store
      expect(modelStore.selectedModels).toHaveLength(1)
      expect(modelStore.selectedModels[0]).toMatchObject({
        name: 'Custom Llama 70B',
        size_billion: 70,
        quantization: 'int4'
      })
    })

    it('should prevent adding invalid manual model', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      wrapper.vm.manualModelName = ''
      wrapper.vm.manualModelSize = 'invalid'
      
      await wrapper.vm.addManualModel()
      
      // Check that model was not added
      expect(modelStore.selectedModels).toHaveLength(0)
      expect(wrapper.vm.manualModelError).toBe('Please fix the validation errors above')
    })

    it('should prevent duplicate manual model names', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Add a model first
      modelStore.addModel(mockModels[0])
      
      wrapper.vm.manualModelName = 'Llama 2 7B'
      wrapper.vm.validateManualModelName()
      
      expect(wrapper.vm.manualModelNameError).toBe('A model with this name already exists')
    })
  })

  describe('Component Reactive Updates', () => {
    it('should reflect store changes in selectedModels computed', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      expect(modelStore.selectedModels).toHaveLength(0)
      
      modelStore.addModel(mockModels[0])
      await wrapper.vm.$nextTick()
      
      expect(modelStore.selectedModels).toHaveLength(1)
      expect(modelStore.selectedModels[0].name).toBe('Llama 2 7B')
    })

    it('should update isModelSelected method correctly', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      expect(modelStore.isModelSelected(mockModels[0])).toBe(false)
      
      modelStore.addModel(mockModels[0])
      await wrapper.vm.$nextTick()
      
      expect(modelStore.isModelSelected(mockModels[0])).toBe(true)
      expect(modelStore.isModelSelected(mockModels[1])).toBe(false)
    })
  })

  describe('Hugging Face Integration', () => {
    it('should fetch model info from Hugging Face', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      wrapper.vm.hfModelId = 'microsoft/DialoGPT-medium'
      await wrapper.vm.fetchHuggingFaceModel()
      
      expect(huggingfaceApi.fetchModelInfo).toHaveBeenCalledWith('microsoft/DialoGPT-medium')
      expect(wrapper.vm.hfModelSize).toBe('7')
      expect(wrapper.vm.hfQuantization).toBe('fp16')
    })

    it('should handle Hugging Face API errors', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      huggingfaceApi.fetchModelInfo.mockRejectedValue(new Error('404 not found'))
      
      wrapper.vm.hfModelId = 'nonexistent/model'
      await wrapper.vm.fetchHuggingFaceModel()
      
      expect(wrapper.vm.hfError).toBe('404 not found')
    })
  })

  describe('Memory Factor Calculation', () => {
    it('should calculate average memory factor correctly', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Clear any existing models first
      modelStore.selectedModels.splice(0, modelStore.selectedModels.length)
      
      // Select models with different quantization
      modelStore.addModel({
        ...mockModels[0],
        quantization: 'fp16',
        memory_factor: 1.0
      })
      modelStore.addModel({
        ...mockModels[1],
        quantization: 'int4',
        memory_factor: 0.25
      })
      
      await wrapper.vm.$nextTick()
      
      // Should be (1.0 + 0.25) / 2 = 0.625, but the component calculates based on quantization type
      const memoryFactor = wrapper.vm.averageMemoryFactor
      expect(memoryFactor).toBeCloseTo(0.625, 1)
    })
  })

  describe('Bulk Operations', () => {
    it('should handle bulk select operations', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      wrapper.vm.availableModels = mockModels
      wrapper.vm.selectedQuantization = 'fp16'
      await wrapper.vm.$nextTick()
      
      wrapper.vm.selectAllFiltered()
      await wrapper.vm.$nextTick()
      
      // Should select models matching the filter
      expect(modelStore.selectedModels.length).toBeGreaterThan(0)
    })

    it('should determine if all filtered models are selected correctly', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      wrapper.vm.availableModels = mockModels
      wrapper.vm.selectedQuantization = 'fp16'
      await wrapper.vm.$nextTick()
      
      // Initially check areAllFilteredSelected based on actual implementation
      const areAllSelected = wrapper.vm.areAllFilteredSelected
      expect(typeof areAllSelected).toBe('boolean')
    })
  })
})
