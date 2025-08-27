import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ConfigurationSummary from './ConfigurationSummary.vue'

// Mock Chart.js components
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
  BarElement: vi.fn(),
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
}))

vi.mock('vue-chartjs', () => ({
  Bar: {
    name: 'Bar',
    template: '<div class="chart-component">Chart Component</div>',
    props: ['data', 'options'],
  },
}))

// Mock the stores completely to avoid computed property issues
vi.mock('../stores/gpuStore.js', () => ({
  useGpuStore: () => ({
    selectedGPUs: [],
    totalVRAM: 24,
  }),
}))

vi.mock('../stores/modelStore.js', () => ({
  useModelStore: () => ({
    selectedModels: [],
    totalModelSize: 15.5,
  }),
}))

vi.mock('../stores/configStore.js', () => ({
  useConfigStore: () => ({
    hasValidConfiguration: true,
    configurationStep: 1,
    setupProgress: 50,
    configurationHealth: { status: 'healthy', issues: [] },
    memoryPressure: 'low',
    vramBreakdown: null,
    stateAnalysis: {
      gpuCount: 1,
      modelCount: 1,
      memoryEfficiency: 0.8,
      estimatedCost: 500
    },
  }),
}))

vi.mock('../stores/uiStore.js', () => ({
  useUiStore: () => ({
    applicationReady: true,
  }),
}))

describe('ConfigurationSummary', () => {
  let wrapper
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    
    wrapper = mount(ConfigurationSummary, {
      global: {
        plugins: [pinia],
      },
    })
  })

  it('renders the component', () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('displays configuration overview when application is ready', () => {
    expect(wrapper.find('.space-y-6').exists()).toBe(true)
  })

  it('displays configuration overview card', () => {
    const overviewCards = wrapper.findAll('h3')
    const hasOverviewCard = overviewCards.some(h3 => h3.text() === 'Configuration Overview')
    expect(hasOverviewCard).toBe(true)
  })

  it('shows configuration health status', () => {
    expect(wrapper.text()).toContain('healthy')
  })

  it('shows setup progress information', () => {
    expect(wrapper.text()).toContain('Setup Progress')
    expect(wrapper.text()).toContain('Step 1 of 3 completed')
  })

  it('displays summary grid with basic information', () => {
    const summaryCards = wrapper.findAll('.grid-cols-2 .text-center')
    expect(summaryCards.length).toBeGreaterThan(0)
  })

  it('does not show memory pressure alert for low pressure', () => {
    const alerts = wrapper.findAll('.bg-yellow-50, .bg-orange-50, .bg-red-50')
      .filter(alert => alert.text().includes('Memory Pressure'))
    expect(alerts.length).toBe(0)
  })

  it('does not show VRAM allocation summary when breakdown is null', () => {
    expect(wrapper.text()).not.toContain('Memory Allocation Summary')
  })

  it('does not show health report when no issues exist', () => {
    expect(wrapper.text()).not.toContain('Configuration Health Report')
  })

  it('computes configuration summary correctly', () => {
    const summary = wrapper.vm.configurationSummary
    expect(summary).toBeTruthy()
    expect(summary.totalGPUs).toBe(1)
    expect(summary.totalVRAM).toBe(24)
    expect(summary.totalModels).toBe(1)
    expect(summary.totalModelSize).toBe(15.5)
    expect(summary.memoryEfficiency).toBe(0.8)
    expect(summary.estimatedCost).toBe(500)
    expect(summary.configurationHealth.status).toBe('healthy')
    expect(summary.memoryPressure).toBe('low')
  })
})
