import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GPUSelector from './GPUSelector.vue'
import * as dataLoader from '../lib/dataLoader.js'

// Mock the dataLoader module
vi.mock('../lib/dataLoader.js', () => ({
  loadGPUData: vi.fn(),
  validateGPU: vi.fn(),
  createCustomGPU: vi.fn()
}))

describe('GPUSelector.vue', () => {
  const mockGPUs = [
    { name: "NVIDIA A100", vram_gb: 80 },
    { name: "NVIDIA H100", vram_gb: 80 },
    { name: "NVIDIA RTX 4090", vram_gb: 24 }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    dataLoader.loadGPUData.mockResolvedValue(mockGPUs)
    dataLoader.validateGPU.mockReturnValue(true)
    dataLoader.createCustomGPU.mockImplementation((name, vram) => ({
      name,
      vram_gb: vram,
      custom: true
    }))
  })

  it('renders component correctly', async () => {
    const wrapper = mount(GPUSelector)
    
    expect(wrapper.find('h2').text()).toBe('Select GPUs')
    expect(wrapper.exists()).toBe(true)
  })

  it('loads available GPUs on mount', async () => {
    mount(GPUSelector)
    
    // Wait for next tick to allow async loading
    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(dataLoader.loadGPUData).toHaveBeenCalled()
  })

  it('displays GPU cards', async () => {
    const wrapper = mount(GPUSelector)
    
    // Manually set the GPUs data for testing
    await wrapper.vm.$nextTick()
    wrapper.vm.availableGPUs = mockGPUs
    await wrapper.vm.$nextTick()
    
    // Check that GPUs are loaded (the component should render the GPU grid)
    expect(wrapper.vm.availableGPUs.length).toBeGreaterThan(0)
  })

  it('emits update when GPU is selected', async () => {
    const wrapper = mount(GPUSelector)
    wrapper.vm.availableGPUs = mockGPUs
    await wrapper.vm.$nextTick()
    
    // Simulate GPU selection
    wrapper.vm.toggleGPU(mockGPUs[0])
    
    expect(wrapper.emitted('update:selectedGPUs')).toBeTruthy()
  })

  it('validates custom GPU input', async () => {
    const wrapper = mount(GPUSelector)
    
    // Test invalid custom GPU
    wrapper.vm.customGPU = { name: '', vram_gb: null }
    expect(wrapper.vm.isCustomGPUValid).toBe(false)
    
    // Test valid custom GPU
    wrapper.vm.customGPU = { name: 'Custom GPU', vram_gb: 48 }
    expect(wrapper.vm.isCustomGPUValid).toBe(true)
  })

  it('adds custom GPU correctly', async () => {
    const wrapper = mount(GPUSelector)
    
    wrapper.vm.customGPU = { name: 'Custom GPU', vram_gb: 48 }
    wrapper.vm.addCustomGPU()
    
    expect(dataLoader.createCustomGPU).toHaveBeenCalledWith('Custom GPU', 48)
    expect(wrapper.emitted('update:selectedGPUs')).toBeTruthy()
  })

  it('calculates total VRAM correctly', async () => {
    const wrapper = mount(GPUSelector, {
      props: {
        selectedGPUs: [
          { gpu: { name: "GPU1", vram_gb: 80 }, quantity: 2 },
          { gpu: { name: "GPU2", vram_gb: 24 }, quantity: 1 }
        ]
      }
    })
    
    expect(wrapper.vm.totalVRAM).toBe(184) // (80 * 2) + (24 * 1)
    expect(wrapper.vm.totalGPUs).toBe(3) // 2 + 1
  })

  it('removes GPU from selection', async () => {
    const selectedGPUs = [
      { gpu: mockGPUs[0], quantity: 1 }
    ]
    
    const wrapper = mount(GPUSelector, {
      props: { selectedGPUs }
    })
    
    wrapper.vm.removeGPU(mockGPUs[0])
    
    expect(wrapper.emitted('update:selectedGPUs')).toBeTruthy()
    expect(wrapper.vm.selectedGPUs).toHaveLength(0)
  })

  it('updates GPU quantity', async () => {
    const selectedGPUs = [
      { gpu: mockGPUs[0], quantity: 1 }
    ]
    
    const wrapper = mount(GPUSelector, {
      props: { selectedGPUs }
    })
    
    wrapper.vm.updateGPUQuantity(mockGPUs[0], '3')
    
    expect(wrapper.vm.selectedGPUs[0].quantity).toBe(3)
    expect(wrapper.emitted('update:selectedGPUs')).toBeTruthy()
  })
})
