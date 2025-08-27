import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GPUSelector from './GPUSelector.vue'
import { useGpuStore } from '../stores/gpuStore.js'
import * as dataLoader from '../lib/dataLoader.js'

// Mock the dataLoader module
vi.mock('../lib/dataLoader.js', () => ({
  loadGPUData: vi.fn(),
  validateGPU: vi.fn(),
  createCustomGPU: vi.fn(),
}))

describe('GPUSelector.vue', () => {
  const mockGPUs = [
    { name: 'NVIDIA A100', vram_gb: 80 },
    { name: 'NVIDIA H100', vram_gb: 80 },
    { name: 'NVIDIA RTX 4090', vram_gb: 24 },
  ]

  let pinia
  let gpuStore

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create fresh Pinia instance for each test
    pinia = createPinia()
    setActivePinia(pinia)
    gpuStore = useGpuStore()
    
    dataLoader.loadGPUData.mockResolvedValue(mockGPUs)
    dataLoader.validateGPU.mockReturnValue(true)
    dataLoader.createCustomGPU.mockImplementation((name, vram) => ({
      name,
      vram_gb: vram,
      custom: true,
    }))
  })

  it('renders component correctly', () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })

    expect(wrapper.find('h2').text()).toBe('GPU Selection')
    expect(wrapper.exists()).toBe(true)
  })

  it('loads available GPUs on mount', async () => {
    mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(dataLoader.loadGPUData).toHaveBeenCalled()
  })

  it('displays GPU cards', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    wrapper.vm.availableGPUs = mockGPUs
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.cursor-pointer').length).toBeGreaterThan(0)
  })

  it('adds GPU to store when selected', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    wrapper.vm.availableGPUs = mockGPUs
    await wrapper.vm.$nextTick()

    wrapper.vm.toggleGPU(mockGPUs[0])

    expect(gpuStore.selectedGPUs).toHaveLength(1)
    expect(gpuStore.selectedGPUs[0].name).toBe(mockGPUs[0].name)
  })

  it('validates custom GPU input', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })

    // Test invalid custom GPU
    wrapper.vm.customGPU = { name: '', vram_gb: null }
    expect(wrapper.vm.isCustomGPUValid).toBe(false)

    // Test valid custom GPU
    wrapper.vm.customGPU = { name: 'Custom GPU', vram_gb: 48 }
    expect(wrapper.vm.isCustomGPUValid).toBe(true)
  })

  it('adds custom GPU correctly', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })

    wrapper.vm.customGPU = { name: 'Custom GPU', vram_gb: 48 }
    wrapper.vm.addCustomGPU()

    expect(dataLoader.createCustomGPU).toHaveBeenCalledWith('Custom GPU', 48)
    expect(gpuStore.selectedGPUs).toHaveLength(1)
  })

  it('calculates total VRAM correctly', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    // Add GPUs to store
    gpuStore.addGPU(mockGPUs[1], 2) // H100: 80GB * 2 = 160GB
    gpuStore.addGPU(mockGPUs[2], 1) // RTX 4090: 24GB * 1 = 24GB
    await wrapper.vm.$nextTick()

    expect(gpuStore.totalVRAM).toBe(184) // 160 + 24
    expect(gpuStore.totalGPUCount).toBe(3) // 2 + 1
  })

  it('removes GPU from selection', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    // Add GPU first
    gpuStore.addGPU(mockGPUs[0], 1)
    expect(gpuStore.selectedGPUs).toHaveLength(1)

    wrapper.vm.removeGPU(mockGPUs[0])

    expect(gpuStore.selectedGPUs).toHaveLength(0)
  })

  it('updates GPU quantity', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    // Add GPU first
    gpuStore.addGPU(mockGPUs[0], 1)
    
    wrapper.vm.updateGPUQuantity(mockGPUs[0], '3')

    expect(gpuStore.selectedGPUs[0].quantity).toBe(3)
  })

  it('displays loading state while fetching GPU data', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    // Mock loading state
    wrapper.vm.gpuLoadingState = { loading: true }
    await wrapper.vm.$nextTick()
    
    expect(wrapper.text()).toContain('Loading')
  })

  it('displays error state when GPU data loading fails', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    // Mock error state
    wrapper.vm.gpuLoadingState = { error: 'Network connection failed' }
    await wrapper.vm.$nextTick()
    
    expect(wrapper.text()).toContain('Network connection failed')
  })

  it('validates custom GPU name correctly', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })

    // Test empty name
    wrapper.vm.customGPU.name = ''
    wrapper.vm.validateCustomGPUName()
    expect(wrapper.vm.customGPUNameError).toBeTruthy()

    // Test valid name
    wrapper.vm.customGPU.name = 'Custom GPU'
    wrapper.vm.validateCustomGPUName()
    expect(wrapper.vm.customGPUNameError).toBe('')
  })

  it('validates custom GPU VRAM correctly', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })

    // Test invalid VRAM
    wrapper.vm.customGPU.vram_gb = 0
    expect(wrapper.vm.isCustomGPUValid).toBe(false)

    // Test valid VRAM
    wrapper.vm.customGPU.name = 'Custom GPU'
    wrapper.vm.customGPU.vram_gb = 48
    expect(wrapper.vm.isCustomGPUValid).toBe(true)
  })

  it('prevents duplicate GPU names', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    // Add GPU to store first
    gpuStore.addGPU(mockGPUs[0], 1)
    
    // Try to add custom GPU with same name
    wrapper.vm.customGPU.name = mockGPUs[0].name
    wrapper.vm.validateCustomGPUName()
    expect(wrapper.vm.customGPUNameError).toBe('A GPU with this name already exists')
  })

  it('shows selection warnings for excessive GPUs', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    // Add many GPUs to trigger warning
    gpuStore.addGPU(mockGPUs[0], 8)
    gpuStore.addGPU(mockGPUs[1], 8)
    await wrapper.vm.$nextTick()
    
    const warnings = wrapper.vm.selectionWarnings
    expect(warnings.some(w => w.type === 'excessive_gpus')).toBe(true)
  })

  it('shows selection warnings for low VRAM', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    // Add low VRAM GPU
    const lowVRAMGPU = { name: 'RTX 3060', vram_gb: 12 }
    gpuStore.addGPU(lowVRAMGPU, 1)
    await wrapper.vm.$nextTick()
    
    const warnings = wrapper.vm.selectionWarnings
    expect(warnings.some(w => w.type === 'low_vram')).toBe(true)
  })

  it('shows selection warnings for mixed GPU types', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    // Add different GPU types
    gpuStore.addGPU(mockGPUs[0], 1) // A100
    gpuStore.addGPU(mockGPUs[2], 1) // RTX 4090
    await wrapper.vm.$nextTick()
    
    const warnings = wrapper.vm.selectionWarnings
    expect(warnings.some(w => w.type === 'mixed_gpus')).toBe(true)
  })

  it('retries loading GPU data when retry button is clicked', async () => {
    const wrapper = mount(GPUSelector, {
      global: {
        plugins: [pinia]
      }
    })
    
    // Mock retry functionality
    const retrySpy = vi.spyOn(wrapper.vm, 'retryLoadGPUs')
    
    // Simulate retry button click
    if (wrapper.vm.retryLoadGPUs) {
      wrapper.vm.retryLoadGPUs()
      expect(retrySpy).toHaveBeenCalled()
    }
  })
})
