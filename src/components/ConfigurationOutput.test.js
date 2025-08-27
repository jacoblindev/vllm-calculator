import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import ConfigurationOutput from './ConfigurationOutput.vue'
import { useConfigStore } from '../stores/configStore.js'
import { useGpuStore } from '../stores/gpuStore.js'
import { useModelStore } from '../stores/modelStore.js'

// Mock the modules
vi.mock('../composables/useLoadingState.js', () => ({
  useLoadingWithRetry: () => ({
    isLoading: ref(false),
    executeWithRetry: vi.fn((fn) => fn()),
  }),
}))

describe('ConfigurationOutput.vue', () => {
  let pinia
  let configStore
  let gpuStore
  let modelStore

  const mockGPUs = [
    { gpu: { name: 'RTX 4090', vram: 24 }, quantity: 2 }
  ]
  
  const mockModels = [
    { name: 'Llama 2 7B', size: 13.5, quantization: 'fp16' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    configStore = useConfigStore()
    gpuStore = useGpuStore()
    modelStore = useModelStore()
    
    // Reset store states
    configStore.$patch({
      selectedGPUs: [],
      selectedModels: [],
      configurations: []
    })
    gpuStore.$patch({
      selectedGPUs: []
    })
    modelStore.$patch({
      selectedModels: []
    })
  })

  describe('Component Initialization', () => {
    it('should render configuration output component', async () => {
      const wrapper = mount(ConfigurationOutput, {
        global: {
          plugins: [pinia]
        }
      })
      
      expect(wrapper.find('.bg-white.rounded-lg.shadow-lg').exists()).toBe(true)
    })

    it('should show placeholder when no configuration exists', async () => {
      const wrapper = mount(ConfigurationOutput, {
        global: {
          plugins: [pinia]
        }
      })
      
      expect(wrapper.text()).toContain('Select GPUs and models to see configuration recommendations')
    })
  })

  describe('Configuration Display', () => {
    it('should display configurations when valid setup exists', async () => {
      // Set up both GPUs and models for valid configuration
      gpuStore.$patch({ 
        selectedGPUs: [{ gpu: { vram_gb: 24 }, quantity: 1 }]
      })
      modelStore.$patch({ 
        selectedModels: [{ size: 13.5 }]
      })
      configStore.$patch({
        configurations: [
          {
            type: 'throughput',
            title: 'Throughput Optimized',
            parameters: [{ name: '--max-num-seqs', value: '32' }],
            command: 'test command'
          }
        ]
      })
      
      const wrapper = mount(ConfigurationOutput, {
        global: {
          plugins: [pinia]
        }
      })
      
      await wrapper.vm.$nextTick()
      
      // Should show configuration tabs
      expect(wrapper.vm.hasConfiguration).toBe(true)
    })

    it('should calculate total VRAM correctly', async () => {
      gpuStore.$patch({ 
        selectedGPUs: [{ gpu: { vram_gb: 24 }, quantity: 2 }] // 2 x 24GB = 48GB total
      })
      
      const wrapper = mount(ConfigurationOutput, {
        global: {
          plugins: [pinia]
        }
      })
      
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.totalVRAM).toBe(48)
    })

    it('should calculate total model size correctly', async () => {
      modelStore.$patch({ 
        selectedModels: [{ size: 13.5 }] // Single model with 13.5GB size
      })
      
      const wrapper = mount(ConfigurationOutput, {
        global: {
          plugins: [pinia]
        }
      })
      
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.totalModelSize).toBe(13.5)
    })
  })

  describe('Reactive Updates', () => {
    it('should update when store changes', async () => {
      const wrapper = mount(ConfigurationOutput, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Initially should be 0
      expect(wrapper.vm.totalVRAM).toBe(0)
      
      // Update GPU store with selectedGPUs
      gpuStore.$patch({ 
        selectedGPUs: [{ gpu: { vram_gb: 24 }, quantity: 2 }] // 2 x 24GB = 48GB total
      })
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.totalVRAM).toBe(48)
    })

    it('should reflect hasValidConfiguration changes', async () => {
      const wrapper = mount(ConfigurationOutput, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Initially false
      expect(wrapper.vm.hasConfiguration).toBe(false)
      
      // Set valid configuration by adding both GPUs and models
      gpuStore.$patch({ 
        selectedGPUs: [{ gpu: { vram_gb: 24 }, quantity: 1 }]
      })
      modelStore.$patch({ 
        selectedModels: [{ size: 13.5 }]
      })
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.hasConfiguration).toBe(true)
    })
  })
})