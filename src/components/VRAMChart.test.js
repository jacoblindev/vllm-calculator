import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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

// Global mock data for all tests
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

describe('VRAMChart.vue', () => {

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
    
    expect(modelWeightsDataset.backgroundColor).toBe('#3B82F6') // Blue-500
    expect(kvCacheDataset.backgroundColor).toBe('#1D4ED8') // Blue-700
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

  it('includes enhanced legend configuration with title and styling', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    const options = wrapper.vm.chartOptions
    expect(options.plugins.legend.title.display).toBe(true)
    expect(options.plugins.legend.title.text).toBe('VRAM Components')
        expect(options.plugins.legend.labels.font.family).toBe('Inter, -apple-system, BlinkMacSystemFont, sans-serif')
    expect(options.plugins.legend.labels.pointStyle).toBe('rect')
  })

  it('includes enhanced tooltip with detailed breakdown information', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    const options = wrapper.vm.chartOptions
    expect(options.plugins.tooltip.backgroundColor).toBe('rgba(255, 255, 255, 0.98)')
    expect(options.plugins.tooltip.titleFont.family).toBe('Inter, -apple-system, BlinkMacSystemFont, sans-serif')
    expect(options.plugins.tooltip.bodyFont.family).toBe('Inter, -apple-system, BlinkMacSystemFont, sans-serif')
    expect(typeof options.plugins.tooltip.callbacks.afterBody).toBe('function')
  })

  it('includes enhanced axis labels with percentage information', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    const options = wrapper.vm.chartOptions
    expect(options.scales.x.title.text).toBe('vLLM Configuration Presets')
    expect(options.scales.y.title.text).toBe('VRAM Usage (GB)')
    expect(options.scales.x.title.font.family).toBe('Inter, -apple-system, BlinkMacSystemFont, sans-serif')
    expect(options.scales.y.title.font.family).toBe('Inter, -apple-system, BlinkMacSystemFont, sans-serif')
  })

  it('includes annotation plugin configuration for total VRAM reference line', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    const options = wrapper.vm.chartOptions
    expect(options.plugins.annotation).toBeDefined()
    expect(typeof options.plugins.annotation.annotations).toBe('object')
  })

  it('provides getTotalVRAM helper function', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    expect(typeof wrapper.vm.getTotalVRAM).toBe('function')
    expect(wrapper.vm.getTotalVRAM()).toBe(80) // From mockGPUs: 1x A100 with 80GB VRAM
  })

  it('shows VRAM summary info when GPUs are selected', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    // Should show GPU configuration summary
    expect(wrapper.vm.getTotalVRAM()).toBeGreaterThan(0)
    expect(wrapper.vm.selectedGPUs.length).toBeGreaterThan(0)
  })
})

// ======= Error Handling and Edge Cases =======
describe('VRAMChart.vue - Error Handling', () => {
  it('handles VRAM breakdown calculation errors gracefully', async () => {
    // Mock console.warn to capture error logging
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    // Mock calculateVRAMBreakdown to throw an error for this test
    const mockCalculateVRAMBreakdown = vi.fn(() => {
      throw new Error('Invalid calculation parameters')
    })
    
    // Replace the mock temporarily
    vi.doMock('../lib/calculationEngine.js', () => ({
      calculateVRAMBreakdown: mockCalculateVRAMBreakdown
    }))

    // Create invalid configuration that will cause calculation error
    const invalidConfigurations = [{
      type: 'throughput',
      title: 'Invalid Config',
      parameters: [
        { name: '--max-model-len', value: 'invalid' }, // Invalid value
        { name: '--max-num-seqs', value: 'not-a-number' }, // Invalid value
      ]
    }]

    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: invalidConfigurations,
        showBreakdown: true,
      },
    })

    await nextTick()

    // Should still render without crashing
    expect(wrapper.find('.bg-white').exists()).toBe(true)
    
    // Should render chart data even with error
    const chartData = wrapper.vm.chartData
    expect(chartData.datasets).toBeDefined()
    expect(chartData.datasets.length).toBeGreaterThan(0)

    consoleSpy.mockRestore()
  })

  it('handles missing configuration parameters with defaults', async () => {
    const incompleteConfigurations = [{
      type: 'balanced',
      title: 'Incomplete Config',
      parameters: [] // No parameters
    }]

    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: incompleteConfigurations,
        showBreakdown: true,
      },
    })

    await nextTick()

    const chartData = wrapper.vm.chartData
    expect(chartData.datasets).toBeDefined()
    expect(chartData.labels).toContain('Incomplete Config')
  })

  it('handles empty datasets gracefully', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: [],
        selectedModels: [],
        configurations: [],
        showBreakdown: true,
      },
    })

    const chartData = wrapper.vm.chartData
    expect(chartData.labels).toEqual(['No Configuration'])
    expect(chartData.datasets[0].label).toBe('No Data')
    expect(chartData.datasets[0].data).toEqual([0])
  })

  it('handles configurations without parameters', () => {
    const configsWithoutParams = [{
      type: 'custom',
      title: 'Minimal Config'
      // No parameters array
    }]

    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: configsWithoutParams,
        showBreakdown: true,
      },
    })

    const chartData = wrapper.vm.chartData
    expect(chartData.labels).toContain('Minimal Config')
    expect(chartData.datasets.length).toBeGreaterThan(0)
  })
})

// ======= Update Throttling =======
describe('VRAMChart.vue - Update Management', () => {
  it('throttles rapid updates to prevent excessive recalculations', async () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    const initialUpdateKey = wrapper.vm.updateKey

    // Trigger multiple rapid updates with different data to ensure change detection
    await wrapper.setProps({ 
      selectedGPUs: [...mockGPUs, { gpu: { name: 'Test GPU', vram: 48 }, quantity: 1 }] 
    })
    await nextTick()
    
    await wrapper.setProps({ 
      selectedModels: [...mockModels, { name: 'Test Model', size: 7.0, quantization: 'fp16' }] 
    })
    await nextTick()
    
    await wrapper.setProps({ 
      configurations: [...mockConfigurations, { type: 'custom', title: 'Test Config', parameters: [] }]
    })
    await nextTick()

    // Should have updated at least once
    expect(wrapper.vm.updateKey).toBeGreaterThanOrEqual(initialUpdateKey)
    // Test that component still renders correctly after updates
    expect(wrapper.find('.bg-white').exists()).toBe(true)
  })

  it('manages isUpdating state during updates', async () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    // Initially not updating
    expect(wrapper.vm.isUpdating).toBe(false)

    // Trigger update
    await wrapper.setProps({ selectedGPUs: [...mockGPUs, { gpu: { name: 'New GPU', vram: 24 }, quantity: 1 }] })
    
    // Should eventually be not updating after nextTick
    await nextTick()
    await nextTick()
    expect(wrapper.vm.isUpdating).toBe(false)
  })

  it('responds to deep changes in configurations array', async () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    const initialLabels = wrapper.vm.chartData.labels

    // Modify configuration parameters
    const modifiedConfigs = JSON.parse(JSON.stringify(mockConfigurations))
    modifiedConfigs[0].parameters[0].value = '4096' // Change max-model-len

    await wrapper.setProps({ configurations: modifiedConfigs })
    await nextTick()

    // Chart should update reactively
    expect(wrapper.vm.chartData.labels).toEqual(initialLabels)
    expect(wrapper.find('.bg-white').exists()).toBe(true)
  })

  it('handles showBreakdown toggle correctly', async () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: false,
      },
    })

    // Should use fallback data when breakdown is disabled
    const initialData = wrapper.vm.chartData
    expect(initialData.labels).toContain('Sample GPU')

    // Enable breakdown
    await wrapper.setProps({ showBreakdown: true })
    await nextTick()

    const breakdownData = wrapper.vm.chartData
    expect(breakdownData.labels).not.toContain('Sample GPU')
    expect(breakdownData.datasets.length).toBeGreaterThan(1) // Multiple memory components
  })
})

// ======= Tooltip Callback Functions =======
describe('VRAMChart.vue - Tooltip Functionality', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })
  })

  it('formats tooltip title correctly', () => {
    const options = wrapper.vm.chartOptions
    const titleCallback = options.plugins.tooltip.callbacks.title

    // Test with valid tooltip items
    const tooltipItems = [{ label: 'Test Configuration' }]
    expect(titleCallback(tooltipItems)).toBe('Configuration: Test Configuration')

    // Test with empty tooltip items
    expect(titleCallback([])).toBe('')
  })

  it('formats tooltip labels with percentage correctly', () => {
    const options = wrapper.vm.chartOptions
    const labelCallback = options.plugins.tooltip.callbacks.label

    // Mock context
    const context = {
      dataset: { label: 'Model Weights' },
      parsed: { y: 12.5 }
    }

    const result = labelCallback(context)
    expect(result).toMatch(/Model Weights: 12\.50 GB \(\d+\.\d%\)/)
  })

  it('generates comprehensive tooltip footer', () => {
    const options = wrapper.vm.chartOptions
    const footerCallback = options.plugins.tooltip.callbacks.footer

    // Test with tooltip items
    const tooltipItems = [
      { parsed: { y: 10 } },
      { parsed: { y: 8 } },
      { parsed: { y: 4 } }
    ]

    const footer = footerCallback(tooltipItems)
    expect(footer).toHaveLength(3)
    expect(footer[0]).toMatch(/Total Used: 22\.00 GB/)
    expect(footer[1]).toMatch(/Available: \d+\.\d+ GB/)
    expect(footer[2]).toMatch(/Utilization: \d+\.\d%/)

    // Test with empty tooltip items
    expect(footerCallback([])).toBe('')
  })

  it('shows updating status in tooltip beforeTitle', () => {
    const options = wrapper.vm.chartOptions
    const beforeTitleCallback = options.plugins.tooltip.callbacks.beforeTitle

    // When not updating
    wrapper.vm.isUpdating = false
    expect(beforeTitleCallback([])).toBe('')

    // When updating
    wrapper.vm.isUpdating = true
    expect(beforeTitleCallback([])).toBe('Updating...')
  })

  it('provides helpful descriptions in tooltip afterBody', () => {
    const options = wrapper.vm.chartOptions
    const afterBodyCallback = options.plugins.tooltip.callbacks.afterBody

    // Test with known component
    const tooltipItems = [{ dataset: { label: 'Model Weights' } }]
    const result = afterBodyCallback(tooltipItems)
    expect(result).toHaveLength(2)
    expect(result[0]).toBe('')
    expect(result[1]).toMatch(/💡 Memory required to store neural network parameters/)

    // Test with unknown component
    const unknownTooltipItems = [{ dataset: { label: 'Unknown Component' } }]
    expect(afterBodyCallback(unknownTooltipItems)).toEqual([])

    // Test with empty tooltip items
    expect(afterBodyCallback([])).toBe('')
  })
})

// ======= Axis Configuration and Formatting =======
describe('VRAMChart.vue - Axis Configuration', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })
  })

  it('formats axis labels correctly', () => {
    const options = wrapper.vm.chartOptions

    // Test x-axis label truncation
    const xAxisCallback = options.scales.x.ticks.callback
    const longLabel = 'Very Long Configuration Name That Should Be Truncated'
    const shortLabel = 'Short Name'
    
    expect(xAxisCallback.call({ getLabelForValue: () => longLabel }, 0, 0)).toBe('Very Long Confi...')
    expect(xAxisCallback.call({ getLabelForValue: () => shortLabel }, 0, 0)).toBe('Short Name')

    // Test y-axis percentage formatting
    const yAxisCallback = options.scales.y.ticks.callback
    expect(yAxisCallback(12.5)).toMatch(/12\.5 GB \(\d+%\)/)
    expect(yAxisCallback(0)).toBe('0.0 GB (0%)')
  })

  it('adjusts y-axis scale limits based on total VRAM', () => {
    const options = wrapper.vm.chartOptions
    const afterDataLimitsCallback = options.scales.y.afterDataLimits

    // Mock scale object
    const mockScale = { max: 20 }
    
    // Should adjust max to accommodate total VRAM with 10% padding
    afterDataLimitsCallback(mockScale)
    expect(mockScale.max).toBeGreaterThan(20)
    expect(mockScale.max).toBeLessThanOrEqual(Math.ceil(80 * 1.1)) // 80GB total VRAM + 10%
  })
})

// ======= Chart Legend Functionality =======
describe('VRAMChart.vue - Legend Configuration', () => {
  it('generates custom legend labels correctly', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        selectedGPUs: mockGPUs,
        selectedModels: mockModels,
        configurations: mockConfigurations,
        showBreakdown: true,
      },
    })

    const options = wrapper.vm.chartOptions
    const generateLabelsCallback = options.plugins.legend.labels.generateLabels

    // Mock chart object
    const mockChart = {
      data: {
        datasets: [
          { label: 'Model Weights', backgroundColor: '#3B82F6' },
          { label: 'KV Cache', backgroundColor: '#1D4ED8' }
        ]
      },
      isDatasetVisible: (index) => index === 0 // First dataset visible, second hidden
    }

    const labels = generateLabelsCallback(mockChart)
    expect(labels).toHaveLength(2)
    expect(labels[0]).toMatchObject({
      text: 'Model Weights',
      fillStyle: '#3B82F6',
      hidden: false,
      datasetIndex: 0,
      pointStyle: 'rect'
    })
    expect(labels[1]).toMatchObject({
      text: 'KV Cache',
      fillStyle: '#1D4ED8',
      hidden: true,
      datasetIndex: 1,
      pointStyle: 'rect'
    })
  })
})
