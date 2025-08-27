/**
 * Shared test utilities for component testing with Pinia stores
 */
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'

/**
 * Create a fresh Pinia instance for testing
 * @returns {Object} Pinia instance
 */
export function createTestPinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

/**
 * Mount a component with Pinia store support
 * @param {Object} component - Vue component to mount
 * @param {Object} options - Additional mount options
 * @returns {Object} Vue Test Utils wrapper
 */
export function mountWithPinia(component, options = {}) {
  const pinia = createTestPinia()
  
  return mount(component, {
    global: {
      plugins: [pinia],
      ...options.global
    },
    ...options
  })
}

/**
 * Mock standard modules used across components
 */
export function mockCommonDependencies() {
  // Mock loading state composable
  vi.mock('../composables/useLoadingState.js', () => ({
    useLoadingWithRetry: () => ({
      isLoading: ref(false),
      executeWithRetry: vi.fn((fn) => fn()),
      lastError: ref(null),
    }),
    useDataLoadingState: () => ({
      gpu: {
        isLoading: ref(false),
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
      },
      model: {
        isLoading: ref(false),
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
      },
      huggingface: {
        isLoading: ref(false),
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
      }
    }),
    useGlobalLoading: () => ({
      isAnyLoading: { value: false },
      activeLoadingStates: { value: [] }
    })
  }))

  // Mock data loader
  vi.mock('../lib/dataLoader.js', () => ({
    loadGPUData: vi.fn(),
    loadModelData: vi.fn(),
    validateGPU: vi.fn(),
    validateModel: vi.fn(),
    createCustomGPU: vi.fn(),
    createCustomModel: vi.fn()
  }))

  // Mock calculation engine
  vi.mock('../lib/calculationEngine.js', () => ({
    calculateVLLMMemoryUsage: vi.fn(),
    checkModelGPUCompatibility: vi.fn(),
    calculateThroughputOptimizedConfig: vi.fn(),
    calculateBalancedOptimizedConfig: vi.fn(),
    calculateLatencyOptimizedConfig: vi.fn()
  }))

  // Mock memory modules
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

  // Mock Chart.js
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

  vi.mock('vue-chartjs', () => ({
    Bar: {
      name: 'Bar',
      props: ['data', 'options'],
      template: '<div class="mock-chart">Mock Chart</div>'
    }
  }))
}

/**
 * Setup mock data for tests
 */
export function createMockData() {
  const mockGPUs = [
    { name: 'NVIDIA A100', vram_gb: 80 },
    { name: 'NVIDIA H100', vram_gb: 80 },
    { name: 'NVIDIA RTX 4090', vram_gb: 24 },
  ]

  const mockModels = [
    { 
      name: 'Llama 2 7B', 
      size: 13, 
      quantization: 'fp16',
      memory_factor: 1.0,
      huggingface_id: 'meta-llama/Llama-2-7b'
    },
    { 
      name: 'Llama 2 13B', 
      size: 26, 
      quantization: 'fp16',
      memory_factor: 1.0,
      huggingface_id: 'meta-llama/Llama-2-13b'
    }
  ]

  const mockConfigurations = [
    {
      type: 'throughput',
      name: 'Throughput Optimized',
      parameters: {
        'gpu-memory-utilization': '0.95',
        'tensor-parallel-size': 1,
        'max-num-seqs': 128,
        'max-num-batched-tokens': 4096
      },
      vllmCommand: 'mocked-throughput-command',
      description: 'Optimized for maximum throughput'
    },
    {
      type: 'balanced',
      name: 'Balanced',
      parameters: {
        'gpu-memory-utilization': '0.90',
        'tensor-parallel-size': 1,
        'max-num-seqs': 96,
        'max-num-batched-tokens': 3072
      },
      vllmCommand: 'mocked-balanced-command',
      description: 'Balanced configuration'
    },
    {
      type: 'latency',
      name: 'Latency Optimized',
      parameters: {
        'gpu-memory-utilization': '0.85',
        'tensor-parallel-size': 1,
        'max-num-seqs': 64,
        'max-num-batched-tokens': 2048
      },
      vllmCommand: 'mocked-latency-command',
      description: 'Optimized for low latency'
    }
  ]

  return {
    mockGPUs,
    mockModels,
    mockConfigurations
  }
}

/**
 * Setup stores with test data
 */
export function setupStoresWithData(pinia) {
  const { useGpuStore } = require('../stores/gpuStore.js')
  const { useModelStore } = require('../stores/modelStore.js')
  const { useConfigStore } = require('../stores/configStore.js')
  
  const gpuStore = useGpuStore()
  const modelStore = useModelStore()
  const configStore = useConfigStore()
  
  const { mockGPUs, mockModels, mockConfigurations } = createMockData()
  
  // Setup GPU store
  gpuStore.$patch({
    availableGPUs: mockGPUs,
    selectedGPUs: []
  })
  
  // Setup Model store
  modelStore.$patch({
    availableModels: mockModels,
    selectedModels: []
  })
  
  return {
    gpuStore,
    modelStore,
    configStore
  }
}
