import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import VRAMChart from './VRAMChart.vue'
import { useConfigStore } from '../stores/configStore.js'
import { useGpuStore } from '../stores/gpuStore.js'
import { useModelStore } from '../stores/modelStore.js'

// Mock Chart.js and vue-chartjs
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  Title: {},
  Tooltip: {},
  Legend: {},
  BarElement: {},
  CategoryScale: {},
  LinearScale: {}
}))

vi.mock('chartjs-plugin-annotation', () => ({
  default: {}
}))

vi.mock('vue-chartjs', () => ({
  Bar: {
    name: 'Bar',
    props: ['data', 'options'],
    template: '<div class="mock-chart">Mock Chart</div>'
  }
}))

// Mock the modules
vi.mock('../composables/useLoadingState.js', () => ({
  useLoadingWithRetry: () => ({
    isLoading: ref(false),
    executeWithRetry: vi.fn((fn) => fn()),
  }),
}))

vi.mock('../lib/memory/vramBreakdown.js', () => ({
  calculateVRAMBreakdown: vi.fn(() => ({
    breakdown: {
      modelWeights: { sizeGB: 10, percentage: 40 },
      kvCache: { sizeGB: 8, percentage: 30 },
      activations: { sizeGB: 2, percentage: 10 },
      systemOverhead: { sizeGB: 1, percentage: 5 },
      fragmentation: { sizeGB: 1, percentage: 5 },
      swap: { sizeGB: 2, percentage: 8 },
      reserved: { sizeGB: 1, percentage: 2 },
    }
  }))
}))

describe('VRAMChart.vue', () => {
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
      selectedGPUs: [],
      totalVRAM: 0
    })
    modelStore.$patch({
      selectedModels: []
    })
  })

  describe('Component Initialization', () => {
    it('should render VRAM chart component', async () => {
      const wrapper = mount(VRAMChart, {
        global: {
          plugins: [pinia]
        }
      })
      
      expect(wrapper.find('.bg-white.rounded-xl.shadow-sm').exists()).toBe(true)
    })

    it('should show chart content when no configuration exists', async () => {
      const wrapper = mount(VRAMChart, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Component should render the chart even with no data
      expect(wrapper.text()).toContain('VRAM Usage Breakdown')
    })
  })

  describe('VRAM Calculations', () => {
    it('should get total VRAM correctly', async () => {
      gpuStore.$patch({ 
        selectedGPUs: [{ gpu: { vram_gb: 24 }, quantity: 2 }] // 2 x 24GB = 48GB total
      })
      
      const wrapper = mount(VRAMChart, {
        global: {
          plugins: [pinia]
        }
      })
      
      await wrapper.vm.$nextTick()
      
      expect(gpuStore.totalVRAM).toBe(48)
      expect(wrapper.text()).toContain('48 GB')
    })

    it('should show chart when valid configuration exists', async () => {
      gpuStore.$patch({ 
        selectedGPUs: mockGPUs,
        totalVRAM: 48 
      })
      modelStore.$patch({ 
        selectedModels: mockModels 
      })
      configStore.$patch({
        configurations: [
          {
            type: 'throughput',
            title: 'Throughput Optimized',
            parameters: [{ name: '--max-num-seqs', value: '32' }]
          }
        ]
      })
      
      const wrapper = mount(VRAMChart, {
        global: {
          plugins: [pinia]
        }
      })
      
      await wrapper.vm.$nextTick()
      
      // Chart should be displayed
      expect(wrapper.find('.mock-chart').exists()).toBe(true)
    })
  })

  describe('Reactive Updates', () => {
    it('should update when store changes', async () => {
      const wrapper = mount(VRAMChart, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Initially should be 0
      expect(gpuStore.totalVRAM).toBe(0)
      
      // Update GPU store with selectedGPUs
      gpuStore.$patch({ 
        selectedGPUs: [{ gpu: { vram_gb: 24 }, quantity: 2 }] // 2 x 24GB = 48GB total
      })
      await wrapper.vm.$nextTick()
      
      expect(gpuStore.totalVRAM).toBe(48)
      expect(wrapper.text()).toContain('48 GB')
    })

    it('should reflect configuration validity changes', async () => {
      const wrapper = mount(VRAMChart, {
        global: {
          plugins: [pinia]
        }
      })
      
      // Initially should have access to store data
      expect(wrapper.vm.selectedGPUs).toEqual([])
      
      // Update store
      gpuStore.$patch({ selectedGPUs: mockGPUs })
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.selectedGPUs).toEqual(mockGPUs)
    })
  })
})