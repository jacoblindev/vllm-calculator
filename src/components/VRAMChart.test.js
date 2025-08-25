import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VRAMChart from './VRAMChart.vue'

// Mock the calculation engine
vi.mock('../lib/calculationEngine.js', () => ({
  calculateVRAMBreakdown: vi.fn(() => ({
    breakdown: {
      modelWeights: { sizeGB: 13.5, percentage: 40 },
      kvCache: { sizeGB: 8.0, percentage: 24 },
      activations: { sizeGB: 2.5, percentage: 7 },
      systemOverhead: { sizeGB: 1.5, percentage: 4 },
      fragmentation: { sizeGB: 1.0, percentage: 3 },
      swap: { sizeGB: 4.0, percentage: 12 },
      reserved: { sizeGB: 3.5, percentage: 10 },
    }
  }))
}))

describe('VRAMChart.vue', () => {
  const mockGPUs = [{ gpu: { name: 'NVIDIA A100', vram: 80 }, quantity: 1 }]
  const mockModels = [{
    name: 'Llama 2 7B',
    size: 13.5,
    quantization: 'fp16',
  }]
  const mockConfigurations = [{
    type: 'throughput',
    title: 'Maximum Throughput',
    parameters: [
      { name: '--max-num-seqs', value: '32' },
      { name: '--max-model-len', value: '2048' },
      { name: '--swap-space', value: '4' },
    ],
  }]

  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders chart component', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        title: 'Test Chart',
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('uses default props when not provided', () => {
    const wrapper = mount(VRAMChart)

    expect(wrapper.exists()).toBe(true)
  })

  it('accepts custom title prop', () => {
    const customTitle = 'Custom VRAM Chart'
    const wrapper = mount(VRAMChart, {
      props: {
        title: customTitle,
      },
    })

    expect(wrapper.props('title')).toBe(customTitle)
  })

  it('renders with bar chart component', () => {
    const wrapper = mount(VRAMChart)

    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(true)
  })

  it('generates stacked bar chart data for VRAM breakdown', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    // Check that chartData computed property generates proper structure
    const chartData = wrapper.vm.chartData
    
    expect(chartData.labels).toContain('Maximum Throughput')
    expect(chartData.datasets).toHaveLength(7) // 7 memory components
    expect(chartData.datasets[0].label).toBe('Model Weights')
    expect(chartData.datasets[1].label).toBe('KV Cache')
  })

  it('handles missing GPU/model data gracefully', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: [],
        selectedModels: [],
        configurations: [],
        showBreakdown: true,
      },
    })

    const chartData = wrapper.vm.chartData
    expect(chartData.labels).toContain('No Configuration')
    expect(chartData.datasets[0].label).toBe('No Data')
  })

  it('supports backward compatibility with simple data prop', () => {
    const simpleData = {
      labels: ['Test GPU'],
      datasets: [{
        label: 'VRAM (GB)',
        backgroundColor: '#3B82F6',
        data: [24],
      }],
    }

    const wrapper = mount(VRAMChart, {
      props: {
        data: simpleData,
        showBreakdown: false,
      },
    })

    const chartData = wrapper.vm.chartData
    expect(chartData.labels).toContain('Test GPU')
    expect(chartData.datasets[0].label).toBe('VRAM (GB)')
  })

  it('configures chart options for stacked bars when breakdown is enabled', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        showBreakdown: true,
      },
    })

    const options = wrapper.vm.chartOptions
    expect(options.scales.x.stacked).toBe(true)
    expect(options.scales.y.stacked).toBe(true)
  })

  it('uses proper memory component colors', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    const chartData = wrapper.vm.chartData
    const modelWeightsDataset = chartData.datasets.find(d => d.label === 'Model Weights')
    const kvCacheDataset = chartData.datasets.find(d => d.label === 'KV Cache')
    
    expect(modelWeightsDataset.backgroundColor).toBe('#EF4444') // Red
    expect(kvCacheDataset.backgroundColor).toBe('#3B82F6') // Blue
  })

  it('has loading state management functionality', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    // Verify the reactive state properties exist
    expect(wrapper.vm.isUpdating).toBeDefined()
    expect(wrapper.vm.updateKey).toBeDefined()
    expect(wrapper.vm.lastUpdateTime).toBeDefined()
    
    // Verify the throttledUpdate method exists
    expect(typeof wrapper.vm.throttledUpdate).toBe('function')
  })

  it('has dynamic update functionality', async () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    const initialUpdateKey = wrapper.vm.updateKey

    // Wait a bit to ensure throttling window has passed
    vi.advanceTimersByTime(150)

    // Manually trigger the update method
    wrapper.vm.throttledUpdate()

    // Wait for nextTick to complete
    await wrapper.vm.$nextTick()

    // Should have updated after manual trigger
    expect(wrapper.vm.updateKey).toBeGreaterThan(initialUpdateKey)
  })

  it('includes animation configuration in chart options', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        showBreakdown: true,
      },
    })

    const options = wrapper.vm.chartOptions
    expect(options.animation).toBeDefined()
    expect(options.animation.duration).toBeGreaterThan(0)
    expect(options.transitions).toBeDefined()
  })

  it('displays last update time when not updating', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    // Wait for initial update to complete
    vi.runAllTimers()

    expect(wrapper.vm.lastUpdateTime).toBeGreaterThan(0)
    expect(wrapper.vm.isUpdating).toBe(false)
  })
})
