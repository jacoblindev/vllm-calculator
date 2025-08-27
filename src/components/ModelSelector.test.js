import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import ModelSelector from './ModelSelector.vue'
import { useModelStore } from '../stores/modelStore.js'
import * as dataLoader from '../lib/dataLoader.js'
import * as huggingfaceApi from '../lib/huggingfaceApi.js'

// Mock the modules
vi.mock('../lib/dataLoader.js', () => ({
  loadModels: vi.fn(),
}))

vi.mock('../lib/huggingfaceApi.js', () => ({
  fetchModelInfo: vi.fn(),
}))

vi.mock('../composables/useLoadingState.js', () => ({
  useLoadingWithRetry: () => ({
    isLoading: ref(false),
    executeWithRetry: vi.fn((fn) => fn()),
    lastError: ref(null),
  }),
  useDataLoadingState: () => ({
    model: {
      isLoading: ref(false),
      startLoading: vi.fn(),
      stopLoading: vi.fn(),
    },
    huggingface: {
      isLoading: ref(false),
      startLoading: vi.fn(),
      stopLoading: vi.fn(),
    }
  }),
}))

describe('ModelSelector.vue', () => {
  let pinia
  let modelStore

  const mockModels = [
    { 
      name: 'Llama 2 7B', 
      size: 13, 
      quantization: 'fp16',
      memory_factor: 1.0,
      huggingface_id: 'meta-llama/Llama-2-7b'
    },
    { 
      name: 'Llama 2 7B AWQ', 
      size: 13, 
      quantization: 'awq',
      memory_factor: 0.25,
      huggingface_id: 'meta-llama/Llama-2-7b-awq'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    modelStore = useModelStore()
    
    // Reset store state
    modelStore.$patch({
      selectedModels: []
    })
    
    // Mock dataLoader to return test models
    dataLoader.loadModels.mockResolvedValue(mockModels)
  })

  describe('Component Initialization', () => {
    it('should render model selector component', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      expect(wrapper.find('.bg-white').exists()).toBe(true)
    })

    it('should mount successfully', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      expect(wrapper.exists()).toBe(true)
      // Check for the actual component content
      expect(wrapper.find('.grid').exists()).toBe(true)
    })
  })

  describe('Model Store Integration', () => {
    it('should use store methods for model selection', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Test store integration by adding model directly
      modelStore.addModel(mockModels[0])
      await wrapper.vm.$nextTick()
      
      expect(modelStore.selectedModels).toHaveLength(1)
      expect(modelStore.selectedModels[0].name).toBe('Llama 2 7B')
    })

    it('should reflect store changes in component', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Initially empty
      expect(wrapper.vm.selectedModels).toHaveLength(0)
      
      // Add model through store
      modelStore.addModel(mockModels[0])
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.selectedModels).toHaveLength(1)
      expect(wrapper.vm.selectedModels[0].name).toBe('Llama 2 7B')
    })

    it('should handle basic model selection', async () => {
      const wrapper = mount(ModelSelector, {
        global: {
          plugins: [pinia]
        }
      })
      
      expect(wrapper.vm.selectedModels).toHaveLength(0)
      expect(modelStore.selectedModels).toHaveLength(0)
    })
  })
})
