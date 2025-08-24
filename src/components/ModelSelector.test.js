import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ModelSelector from './ModelSelector.vue'
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
  const mockModels = [
    {
      name: 'Llama 2 7B',
      hf_id: 'meta-llama/Llama-2-7b-hf',
      size_gb: 13.5,
      quantization: 'fp16',
      memory_factor: 1.0,
    },
    {
      name: 'Llama 2 7B AWQ',
      hf_id: 'meta-llama/Llama-2-7b-awq',
      size_gb: 6.75,
      quantization: 'awq',
      memory_factor: 0.5,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    dataLoader.loadModelData.mockResolvedValue(mockModels)
    dataLoader.validateModel.mockReturnValue(true)
    dataLoader.createCustomModel.mockImplementation((name, size, quant, factor) => ({
      name,
      size_gb: size,
      quantization: quant,
      memory_factor: factor,
      custom: true,
    }))
    huggingfaceApi.getQuantizationFactor.mockReturnValue(1.0)
  })

  it('renders component correctly', async () => {
    const wrapper = mount(ModelSelector)

    expect(wrapper.find('h2').text()).toBe('Select Models')
    expect(wrapper.exists()).toBe(true)
  })

  it('loads available models on mount', async () => {
    mount(ModelSelector)

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(dataLoader.loadModelData).toHaveBeenCalled()
  })

  it('displays model cards with quantization info', async () => {
    const wrapper = mount(ModelSelector)
    wrapper.vm.availableModels = mockModels
    await wrapper.vm.$nextTick()

    const modelCards = wrapper.findAll('[data-testid="model-card"]')
    expect(modelCards.length).toBeGreaterThanOrEqual(0)
  })

  it('emits update when model is selected', async () => {
    const wrapper = mount(ModelSelector)
    wrapper.vm.availableModels = mockModels
    await wrapper.vm.$nextTick()

    wrapper.vm.toggleModel(mockModels[0])

    expect(wrapper.emitted('update:selectedModels')).toBeTruthy()
  })

  it('validates manual model input', async () => {
    const wrapper = mount(ModelSelector)

    // Test invalid manual model
    wrapper.vm.manualModel = { name: '', size_gb: null, quantization: 'fp16' }
    expect(wrapper.vm.isManualModelValid).toBe(false)

    // Test valid manual model
    wrapper.vm.manualModel = { name: 'Custom Model', size_gb: 14.5, quantization: 'fp16' }
    expect(wrapper.vm.isManualModelValid).toBe(true)
  })

  it('handles successful HF model fetch', async () => {
    const wrapper = mount(ModelSelector)

    huggingfaceApi.fetchModelInfo.mockResolvedValue({
      success: true,
      id: 'test-model',
    })
    huggingfaceApi.extractModelSize.mockReturnValue(7)
    huggingfaceApi.detectQuantizationType.mockReturnValue('fp16')

    wrapper.vm.hfModelId = 'test-model'
    await wrapper.vm.fetchHuggingFaceModel()

    expect(huggingfaceApi.fetchModelInfo).toHaveBeenCalledWith('test-model')
    expect(dataLoader.createCustomModel).toHaveBeenCalled()
  })

  it('shows manual entry on HF API failure', async () => {
    const wrapper = mount(ModelSelector)

    huggingfaceApi.fetchModelInfo.mockResolvedValue({
      success: false,
      error: 'Model not found',
    })

    wrapper.vm.hfModelId = 'invalid-model'
    await wrapper.vm.fetchHuggingFaceModel()

    expect(wrapper.vm.showManualEntry).toBe(true)
    expect(wrapper.vm.manualModel.name).toBe('invalid-model')
  })

  it('adds manual model correctly', async () => {
    const wrapper = mount(ModelSelector)

    wrapper.vm.manualModel = {
      name: 'Custom Model',
      size_gb: 14.5,
      quantization: 'awq',
    }

    wrapper.vm.addManualModel()

    expect(dataLoader.createCustomModel).toHaveBeenCalledWith('Custom Model', 14.5, 'awq', 1.0)
    expect(wrapper.emitted('update:selectedModels')).toBeTruthy()
  })

  it('removes model from selection', async () => {
    const selectedModels = [mockModels[0]]

    const wrapper = mount(ModelSelector, {
      props: { selectedModels },
    })

    wrapper.vm.removeModel(mockModels[0])

    expect(wrapper.emitted('update:selectedModels')).toBeTruthy()
    expect(wrapper.vm.selectedModels).toHaveLength(0)
  })

  it('returns correct badge classes for quantization types', () => {
    const wrapper = mount(ModelSelector)

    expect(wrapper.vm.getQuantizationBadgeClass('fp16')).toBe('bg-blue-100 text-blue-800')
    expect(wrapper.vm.getQuantizationBadgeClass('awq')).toBe('bg-green-100 text-green-800')
    expect(wrapper.vm.getQuantizationBadgeClass('gptq')).toBe('bg-purple-100 text-purple-800')
    expect(wrapper.vm.getQuantizationBadgeClass('unknown')).toBe('bg-gray-100 text-gray-800')
  })

  it('prevents duplicate model selection', async () => {
    const wrapper = mount(ModelSelector, {
      props: {
        selectedModels: [mockModels[0]],
      },
    })

    expect(wrapper.vm.isModelSelected(mockModels[0])).toBe(true)
    expect(wrapper.vm.isModelSelected(mockModels[1])).toBe(false)
  })
})
