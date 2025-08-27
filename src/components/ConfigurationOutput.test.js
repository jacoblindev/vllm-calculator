import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ConfigurationOutput from './ConfigurationOutput.vue'
import { useGpuStore } from '../stores/gpuStore.js'
import { useModelStore } from '../stores/modelStore.js'
import { useConfigStore } from '../stores/configStore.js'

// Mock navigator.clipboard for happy-dom
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
})

describe('ConfigurationOutput.vue', () => {
  let pinia
  let gpuStore
  let modelStore
  let configStore

  const mockGPUs = [{ gpu: { name: 'NVIDIA A100', vram: 80 }, quantity: 2 }]

  const mockModels = [
    {
      name: 'Llama 2 7B',
      hf_id: 'meta-llama/Llama-2-7b-hf',
      size: 13.5,
      quantization: 'fp16',
      memory_factor: 1.0,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a fresh Pinia instance for each test
    pinia = createPinia()
    setActivePinia(pinia)
    
    // Initialize stores
    gpuStore = useGpuStore()
    modelStore = useModelStore()
    configStore = useConfigStore()
  })

  it('renders component correctly', () => {
    const wrapper = mount(ConfigurationOutput)

    expect(wrapper.find('h2').text()).toBe('vLLM Configuration Recommendations')
    expect(wrapper.exists()).toBe(true)
  })

  it('shows placeholder when no configuration', () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: [],
        selectedModels: [],
      },
    })

    expect(wrapper.text()).toContain('Select GPUs and models to see configuration recommendations')
    expect(wrapper.vm.hasConfiguration).toBe(false)
  })

  it('shows configurations when GPUs and models are selected', async () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
      },
    })

    expect(wrapper.vm.hasConfiguration).toBe(true)
    expect(wrapper.vm.configurations.length).toBe(3)

    // Check that all three configuration types exist
    const configTypes = wrapper.vm.configurations.map(c => c.type)
    expect(configTypes).toContain('throughput')
    expect(configTypes).toContain('latency')
    expect(configTypes).toContain('balanced')
  })

  it('calculates total VRAM correctly', () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
      },
    })

    expect(wrapper.vm.totalVRAM).toBe(160) // 80 * 2
  })

  it('calculates total model size correctly', () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
      },
    })

    expect(wrapper.vm.totalModelSize).toBe(13.5) // 13.5 * 1.0
  })

  it('generates different parameters for each configuration type', () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
      },
    })

    const configs = wrapper.vm.configurations
    const throughputConfig = configs.find(c => c.type === 'throughput')
    const latencyConfig = configs.find(c => c.type === 'latency')
    const balancedConfig = configs.find(c => c.type === 'balanced')

    expect(throughputConfig).toBeDefined()
    expect(latencyConfig).toBeDefined()
    expect(balancedConfig).toBeDefined()

    // Each config should have 6 parameters
    expect(throughputConfig.parameters.length).toBe(6)
    expect(latencyConfig.parameters.length).toBe(6)
    expect(balancedConfig.parameters.length).toBe(6)
  })

  it('switches between configuration tabs', async () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
      },
    })

    // Default should be throughput
    expect(wrapper.vm.activeTab).toBe('throughput')

    // Switch to latency tab
    wrapper.vm.activeTab = 'latency'
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.activeTab).toBe('latency')
  })

  it('generates valid command line strings', () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
      },
    })

    const configs = wrapper.vm.configurations

    configs.forEach(config => {
      expect(config.command).toBeTruthy()
      expect(config.command).toContain('python -m vllm.entrypoints.openai.api_server')
      expect(config.command).toContain('--model')
      expect(config.command).toContain('--gpu-memory-utilization')
      expect(config.command).toContain('--max-model-len')
      expect(config.command).toContain('--max-num-seqs')
    })
  })

  it('includes tensor parallel for multiple GPUs', () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: mockGPUs, // 2 GPUs
        selectedModels: mockModels,
      },
    })

    const configs = wrapper.vm.configurations

    configs.forEach(config => {
      expect(config.command).toContain('--tensor-parallel-size 2')
    })
  })

  it('does not include tensor parallel for single GPU', () => {
    const singleGPU = [{ gpu: { name: 'NVIDIA A100', vram_gb: 80 }, quantity: 1 }]

    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: singleGPU,
        selectedModels: mockModels,
      },
    })

    const configs = wrapper.vm.configurations

    configs.forEach(config => {
      expect(config.command).not.toContain('--tensor-parallel-size')
    })
  })

  it('copies command to clipboard', async () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
      },
    })

    const testCommand = 'test command'
    navigator.clipboard.writeText.mockResolvedValue()

    await wrapper.vm.copyCommand(testCommand)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testCommand)
    expect(wrapper.vm.copiedCommand).toBe(testCommand)
  })

  it('resets active tab when configuration changes', async () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: [],
        selectedModels: [],
      },
    })

    wrapper.vm.activeTab = 'latency'

    // Update props to trigger configuration
    await wrapper.setProps({
      selectedGPUs: mockGPUs,
      selectedModels: mockModels,
    })

    expect(wrapper.vm.activeTab).toBe('throughput')
  })

  it('validates parameter structure', () => {
    const wrapper = mount(ConfigurationOutput, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
      },
    })

    const configs = wrapper.vm.configurations

    configs.forEach(config => {
      config.parameters.forEach(param => {
        expect(param).toHaveProperty('name')
        expect(param).toHaveProperty('value')
        expect(param).toHaveProperty('explanation')
        expect(typeof param.name).toBe('string')
        expect(typeof param.value).toBe('string')
        expect(typeof param.explanation).toBe('string')
      })
    })
  })
})
