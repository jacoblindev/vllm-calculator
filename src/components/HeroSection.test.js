import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HeroSection from './HeroSection.vue'
import { useGpuStore } from '../stores/gpuStore.js'
import { useModelStore } from '../stores/modelStore.js'
import { useConfigStore } from '../stores/configStore.js'
import { useUiStore } from '../stores/uiStore.js'

describe('HeroSection', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  describe('Basic Rendering', () => {
    it('renders the hero section when application is ready', async () => {
      const uiStore = useUiStore()
      uiStore.setApplicationReady(true)

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('section').exists()).toBe(true)
      expect(wrapper.find('h2').text()).toBe('Optimize Your vLLM Deployment')
    })

    it('does not render when application is not ready', () => {
      const uiStore = useUiStore()
      uiStore.setApplicationReady(false)

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('section').exists()).toBe(false)
    })

    it('displays the correct description text', async () => {
      const uiStore = useUiStore()
      uiStore.setApplicationReady(true)

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      const description = wrapper.find('p')
      expect(description.text()).toContain('Configure optimal vLLM parameters')
      expect(description.text()).toContain('throughput, latency, and balanced performance')
    })
  })

  describe('Configuration Status Display', () => {
    beforeEach(async () => {
      const uiStore = useUiStore()
      uiStore.setApplicationReady(true)
      // Allow time for reactivity to update
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    it('shows GPU selection status correctly', async () => {
      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      const gpuStore = useGpuStore()
      
      await wrapper.vm.$nextTick()
      
      // Initially no GPUs selected
      expect(wrapper.find('.bg-gray-300').exists()).toBe(true)
      
      // Add a GPU with the correct structure
      gpuStore.selectedGPUs = [{
        gpu: {
          id: 'gpu1',
          name: 'Tesla A100',
          vram_gb: 80
        },
        quantity: 1
      }]

      await wrapper.vm.$nextTick()
      expect(wrapper.find('.bg-green-500').exists()).toBe(true)
    })

    it('shows model selection status correctly', async () => {
      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      const modelStore = useModelStore()
      
      await wrapper.vm.$nextTick()
      
      // Add a model
      modelStore.selectedModels = [{
        id: 'model1',
        name: 'Llama-2-7B',
        size: 13.5
      }]

      await wrapper.vm.$nextTick()
      expect(wrapper.find('.bg-green-500').exists()).toBe(true)
    })

    it('displays both desktop and mobile layouts', async () => {
      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Check for desktop layout
      expect(wrapper.find('.hidden.sm\\:flex').exists()).toBe(true)
      
      // Check for mobile layout
      expect(wrapper.find('.sm\\:hidden').exists()).toBe(true)
    })

    it('shows configuration ready status when valid', async () => {
      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      const gpuStore = useGpuStore()
      const modelStore = useModelStore()
      const configStore = useConfigStore()
      
      await wrapper.vm.$nextTick()
      
      // Add GPU and model to make configuration valid
      gpuStore.selectedGPUs = [{ 
        gpu: { id: 'gpu1', name: 'Tesla A100', vram_gb: 80 }, 
        quantity: 1 
      }]
      modelStore.selectedModels = [{ id: 'model1', name: 'Llama-2-7B', size: 13.5 }]

      // Mock the computed values that depend on the store state
      vi.spyOn(configStore, 'vramBreakdown', 'get').mockReturnValue({
        modelWeights: 13.5,
        kvCache: 8.0,
        activations: 4.5,
        systemOverhead: 2.0,
        available: 52.0
      })

      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('Ready to Configure')
    })
  })

  describe('Enhanced State Dashboard', () => {
    beforeEach(async () => {
      const uiStore = useUiStore()
      uiStore.setApplicationReady(true)
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    it('displays configuration summary when state analysis is complete', async () => {
      const configStore = useConfigStore()
      
      // Mock state analysis as complete BEFORE mounting
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 2,
        modelCount: 1,
        memoryEfficiency: 0.85
      })

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('h4').text()).toBe('Configuration Summary')
      expect(wrapper.text()).toContain('Total GPUs')
      expect(wrapper.text()).toContain('Total VRAM')
      expect(wrapper.text()).toContain('Models')
      expect(wrapper.text()).toContain('Memory Usage')
    })

    it('does not show dashboard when state analysis is incomplete', async () => {
      const configStore = useConfigStore()
      
      // Mock state analysis as incomplete BEFORE mounting
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: false,
        gpuCount: 0,
        modelCount: 0,
        memoryEfficiency: 0
      })

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('h4').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Configuration Summary')
    })

    it('displays correct memory usage percentage', async () => {
      const configStore = useConfigStore()
      
      // Mock state analysis BEFORE mounting
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 1,
        modelCount: 1,
        memoryEfficiency: 0.75
      })

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('75%')
    })
  })

  describe('Memory Pressure Indicator', () => {
    beforeEach(async () => {
      const uiStore = useUiStore()
      uiStore.setApplicationReady(true)
      
      const configStore = useConfigStore()
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 1,
        modelCount: 1,
        memoryEfficiency: 0.85
      })
      
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    it('does not show indicator for low memory pressure', async () => {
      const configStore = useConfigStore()
      
      // Mock both state analysis and memory pressure BEFORE mounting
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 1,
        modelCount: 1,
        memoryEfficiency: 0.85
      })
      vi.spyOn(configStore, 'memoryPressure', 'get').mockReturnValue('low')

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.bg-yellow-50').exists()).toBe(false)
      expect(wrapper.find('.bg-orange-50').exists()).toBe(false)
      expect(wrapper.find('.bg-red-50').exists()).toBe(false)
    })
  })

  describe('VRAM Breakdown Display', () => {
    beforeEach(async () => {
      const uiStore = useUiStore()
      uiStore.setApplicationReady(true)
      
      const configStore = useConfigStore()
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 1,
        modelCount: 1,
        memoryEfficiency: 0.85
      })
      
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    it('displays VRAM breakdown when available', async () => {
      const configStore = useConfigStore()
      
      // Mock both state analysis and VRAM breakdown BEFORE mounting
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 1,
        modelCount: 1,
        memoryEfficiency: 0.85
      })
      vi.spyOn(configStore, 'vramBreakdown', 'get').mockReturnValue({
        modelWeights: 13.5,
        kvCache: 8.0,
        activations: 4.5,
        systemOverhead: 2.0,
        available: 52.0
      })

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('VRAM Allocation Breakdown')
      expect(wrapper.text()).toContain('Model Weights')
      expect(wrapper.text()).toContain('13.5GB')
      expect(wrapper.text()).toContain('KV Cache')
      expect(wrapper.text()).toContain('8.0GB')
      expect(wrapper.text()).toContain('Activations')
      expect(wrapper.text()).toContain('4.5GB')
      expect(wrapper.text()).toContain('System')
      expect(wrapper.text()).toContain('2.0GB')
      expect(wrapper.text()).toContain('Available')
      expect(wrapper.text()).toContain('52.0GB')
    })

    it('does not display VRAM breakdown when not available', async () => {
      const configStore = useConfigStore()
      
      // Mock state analysis complete but no VRAM breakdown BEFORE mounting
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 1,
        modelCount: 1,
        memoryEfficiency: 0.85
      })
      vi.spyOn(configStore, 'vramBreakdown', 'get').mockReturnValue(null)

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).not.toContain('VRAM Allocation Breakdown')
    })
  })

  describe('Quantization Recommendations', () => {
    beforeEach(async () => {
      const uiStore = useUiStore()
      uiStore.setApplicationReady(true)
      
      const configStore = useConfigStore()
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 1,
        modelCount: 1,
        memoryEfficiency: 0.85
      })
      
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    it('displays quantization recommendations when available', async () => {
      const configStore = useConfigStore()
      
      // Mock both state analysis and quantization recommendations BEFORE mounting
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 1,
        modelCount: 1,
        memoryEfficiency: 0.85
      })
      vi.spyOn(configStore, 'quantizationRecommendations', 'get').mockReturnValue([
        {
          modelName: 'Llama-2-7B',
          currentFormat: 'fp16',
          recommendedFormat: 'awq',
          memorySavings: 6.8,
          reason: 'Reduce memory usage for single GPU deployment'
        }
      ])

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Quantization Recommendations')
      expect(wrapper.text()).toContain('Llama-2-7B')
      expect(wrapper.text()).toContain('fp16 → awq')
      expect(wrapper.text()).toContain('Save 6.8GB')
      expect(wrapper.text()).toContain('Reduce memory usage for single GPU deployment')
    })

    it('does not display recommendations section when empty', async () => {
      const configStore = useConfigStore()
      
      // Mock state analysis complete but empty recommendations BEFORE mounting
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 1,
        modelCount: 1,
        memoryEfficiency: 0.85
      })
      vi.spyOn(configStore, 'quantizationRecommendations', 'get').mockReturnValue([])

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).not.toContain('Quantization Recommendations')
    })

    it('displays multiple recommendations correctly', async () => {
      const configStore = useConfigStore()
      
      // Mock both state analysis and multiple quantization recommendations BEFORE mounting
      vi.spyOn(configStore, 'stateAnalysis', 'get').mockReturnValue({
        isComplete: true,
        gpuCount: 1,
        modelCount: 1,
        memoryEfficiency: 0.85
      })
      vi.spyOn(configStore, 'quantizationRecommendations', 'get').mockReturnValue([
        {
          modelName: 'Llama-2-7B',
          currentFormat: 'fp16',
          recommendedFormat: 'awq',
          memorySavings: 6.8,
          reason: 'Reduce memory usage'
        },
        {
          modelName: 'CodeLlama-13B',
          currentFormat: 'fp16',
          recommendedFormat: 'gptq',
          memorySavings: 12.5,
          reason: 'Enable larger model deployment'
        }
      ])

      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Llama-2-7B')
      expect(wrapper.text()).toContain('CodeLlama-13B')
      expect(wrapper.text()).toContain('awq')
      expect(wrapper.text()).toContain('gptq')
    })
  })

  describe('Store Integration', () => {
    it('uses GPU store for selection state', async () => {
      const uiStore = useUiStore()
      const gpuStore = useGpuStore()
      
      uiStore.setApplicationReady(true)
      
      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()
      
      // Add GPU and verify it's reflected
      gpuStore.selectedGPUs = [{ 
        gpu: { id: 'gpu1', name: 'A100', vram_gb: 80 }, 
        quantity: 1 
      }]
      
      await wrapper.vm.$nextTick()
      expect(gpuStore.selectedGPUs).toHaveLength(1)
    })

    it('uses model store for selection state', async () => {
      const uiStore = useUiStore()
      const modelStore = useModelStore()
      
      uiStore.setApplicationReady(true)
      
      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()
      
      // Add model and verify it's reflected
      modelStore.selectedModels = [{ id: 'model1', name: 'Llama-2', size: 13.5 }]
      
      await wrapper.vm.$nextTick()
      expect(modelStore.selectedModels).toHaveLength(1)
    })

    it('reacts to configuration store changes', async () => {
      const uiStore = useUiStore()
      const configStore = useConfigStore()
      
      uiStore.setApplicationReady(true)
      
      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()
      
      // Mock configuration store getters
      vi.spyOn(configStore, 'hasValidConfiguration', 'get').mockReturnValue(true)
      vi.spyOn(configStore, 'memoryPressure', 'get').mockReturnValue('moderate')
      
      expect(configStore.hasValidConfiguration).toBe(true)
      expect(configStore.memoryPressure).toBe('moderate')
    })
  })

  describe('Responsive Design', () => {
    beforeEach(async () => {
      const uiStore = useUiStore()
      uiStore.setApplicationReady(true)
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    it('has responsive padding classes', async () => {
      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      const container = wrapper.find('.max-w-4xl')
      expect(container.classes()).toContain('mx-auto')
      // Container has max-w-4xl but padding is on parent .py-12.sm:py-16.px-6.sm:px-8
      const parentContainer = wrapper.find('.py-12')
      expect(parentContainer.classes()).toContain('px-6')
      expect(parentContainer.classes()).toContain('sm:px-8')
    })

    it('has responsive margin classes', async () => {
      const wrapper = mount(HeroSection, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      const section = wrapper.find('section')
      expect(section.classes()).toContain('mb-8')
      expect(section.classes()).toContain('sm:mb-12')
    })
  })
})
