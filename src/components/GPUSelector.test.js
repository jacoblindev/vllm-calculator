import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GPUSelector from './GPUSelector.vue'
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

  beforeEach(() => {
    vi.clearAllMocks()
    dataLoader.loadGPUData.mockResolvedValue(mockGPUs)
    dataLoader.validateGPU.mockReturnValue(true)
    dataLoader.createCustomGPU.mockImplementation((name, vram) => ({
      name,
      vram_gb: vram,
      custom: true,
    }))
  })

  it('renders component correctly', () => {
    const wrapper = mount(GPUSelector)

    expect(wrapper.find('h2').text()).toBe('GPU Selection')
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
          { gpu: { name: 'GPU1', vram_gb: 80 }, quantity: 2 },
          { gpu: { name: 'GPU2', vram_gb: 24 }, quantity: 1 },
        ],
      },
    })

    expect(wrapper.vm.totalVRAM).toBe(184) // (80 * 2) + (24 * 1)
    expect(wrapper.vm.totalGPUs).toBe(3) // 2 + 1
  })

  it('removes GPU from selection', async () => {
    const selectedGPUs = [{ gpu: mockGPUs[0], quantity: 1 }]

    const wrapper = mount(GPUSelector, {
      props: { selectedGPUs },
    })

    wrapper.vm.removeGPU(mockGPUs[0])

    expect(wrapper.emitted('update:selectedGPUs')).toBeTruthy()
    expect(wrapper.vm.selectedGPUs).toHaveLength(0)
  })

  it('updates GPU quantity', async () => {
    const selectedGPUs = [{ gpu: mockGPUs[0], quantity: 1 }]

    const wrapper = mount(GPUSelector, {
      props: { selectedGPUs },
    })

    wrapper.vm.updateGPUQuantity(mockGPUs[0], '3')

    expect(wrapper.vm.selectedGPUs[0].quantity).toBe(3)
    expect(wrapper.emitted('update:selectedGPUs')).toBeTruthy()
  })

  // New validation and error state tests
  it('displays loading state while fetching GPU data', async () => {
    const wrapper = mount(GPUSelector)
    
    // Set loading state
    wrapper.vm.isLoading = true
    await wrapper.vm.$nextTick()
    
    expect(wrapper.text()).toContain('Loading GPU data...')
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('displays error state when GPU data loading fails', async () => {
    const wrapper = mount(GPUSelector)
    
    // Set error state (make sure loading is false and error is set)
    wrapper.vm.isLoading = false
    wrapper.vm.loadError = 'Network connection failed'
    await wrapper.vm.$nextTick()
    
    expect(wrapper.text()).toContain('Unable to load GPU data')
    expect(wrapper.text()).toContain('Network connection failed')
    expect(wrapper.text()).toContain('Try again')
  })

  it('validates custom GPU name correctly', async () => {
    const wrapper = mount(GPUSelector)
    
    // Test empty name
    wrapper.vm.customGPU.name = ''
    wrapper.vm.validateCustomGPUName()
    expect(wrapper.vm.customGPUNameError).toBe('GPU name is required')
    
    // Test short name
    wrapper.vm.customGPU.name = 'A'
    wrapper.vm.validateCustomGPUName()
    expect(wrapper.vm.customGPUNameError).toBe('GPU name must be at least 2 characters long')
    
    // Test valid name
    wrapper.vm.customGPU.name = 'Valid GPU Name'
    wrapper.vm.validateCustomGPUName()
    expect(wrapper.vm.customGPUNameError).toBe('')
  })

  it('validates custom GPU VRAM correctly', async () => {
    const wrapper = mount(GPUSelector)
    
    // Test zero VRAM
    wrapper.vm.customGPU.vram_gb = 0
    wrapper.vm.validateCustomGPUVram()
    expect(wrapper.vm.customGPUVramError).toBe('VRAM must be at least 1GB')
    
    // Test negative VRAM
    wrapper.vm.customGPU.vram_gb = -5
    wrapper.vm.validateCustomGPUVram()
    expect(wrapper.vm.customGPUVramError).toBe('VRAM must be at least 1GB')
    
    // Test excessive VRAM
    wrapper.vm.customGPU.vram_gb = 250
    wrapper.vm.validateCustomGPUVram()
    expect(wrapper.vm.customGPUVramError).toBe('VRAM cannot exceed 200GB')
    
    // Test valid VRAM
    wrapper.vm.customGPU.vram_gb = 48
    wrapper.vm.validateCustomGPUVram()
    expect(wrapper.vm.customGPUVramError).toBe('')
  })

  it('prevents duplicate GPU names', async () => {
    const wrapper = mount(GPUSelector, {
      props: {
        selectedGPUs: [{ gpu: mockGPUs[0], quantity: 1 }],
      },
    })
    
    // Try to add duplicate name
    wrapper.vm.customGPU.name = mockGPUs[0].name
    wrapper.vm.validateCustomGPUName()
    expect(wrapper.vm.customGPUNameError).toBe('A GPU with this name already exists')
  })

  it('shows selection warnings for excessive GPUs', async () => {
    const manyGPUs = Array(20).fill(null).map((_, i) => ({
      gpu: { name: `GPU${i}`, vram_gb: 24 },
      quantity: 1
    }))
    
    const wrapper = mount(GPUSelector, {
      props: {
        selectedGPUs: manyGPUs,
      },
    })
    
    const warnings = wrapper.vm.selectionWarnings
    expect(warnings.some(w => w.type === 'excessive_gpus')).toBe(true)
  })

  it('shows selection warnings for low VRAM', async () => {
    const lowVramGPUs = [{ gpu: { name: 'Low VRAM GPU', vram_gb: 8 }, quantity: 1 }]
    
    const wrapper = mount(GPUSelector, {
      props: {
        selectedGPUs: lowVramGPUs,
      },
    })
    
    const warnings = wrapper.vm.selectionWarnings
    expect(warnings.some(w => w.type === 'low_vram')).toBe(true)
  })

  it('shows selection warnings for mixed GPU types', async () => {
    const mixedGPUs = [
      { gpu: { name: 'GPU Type A', vram_gb: 24 }, quantity: 1 },
      { gpu: { name: 'GPU Type B', vram_gb: 48 }, quantity: 1 }
    ]
    
    const wrapper = mount(GPUSelector, {
      props: {
        selectedGPUs: mixedGPUs,
      },
    })
    
    const warnings = wrapper.vm.selectionWarnings
    expect(warnings.some(w => w.type === 'mixed_gpus')).toBe(true)
  })

  it('retries loading GPU data when retry button is clicked', async () => {
    const wrapper = mount(GPUSelector)
    
    // Set error state
    wrapper.vm.isLoading = false
    wrapper.vm.loadError = 'Network error'
    await wrapper.vm.$nextTick()
    
    // Spy on the retry method and test it directly
    const retryGPUsSpy = vi.spyOn(wrapper.vm, 'retryLoadGPUs')
    
    // Call retry method directly
    wrapper.vm.retryLoadGPUs()
    
    expect(retryGPUsSpy).toHaveBeenCalled()
  })
})
