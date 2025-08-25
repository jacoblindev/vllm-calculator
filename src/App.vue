<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import GPUSelector from './components/GPUSelector.vue'
import ModelSelector from './components/ModelSelector.vue'
import ConfigurationOutput from './components/ConfigurationOutput.vue'
import VRAMChart from './components/VRAMChart.vue'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Enhanced state management with persistence and validation
const selectedGPUs = ref([])
const selectedModels = ref([])
const applicationReady = ref(false)
const lastSavedState = ref(null)
const stateErrors = ref([])
const isStateRestoring = ref(false)

// State persistence keys
const STATE_KEYS = {
  gpus: 'vllm-calculator-selected-gpus',
  models: 'vllm-calculator-selected-models',
  timestamp: 'vllm-calculator-last-saved'
}

// State management functions
const saveStateToStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const state = {
        gpus: selectedGPUs.value,
        models: selectedModels.value,
        timestamp: Date.now()
      }
      
      window.localStorage.setItem(STATE_KEYS.gpus, JSON.stringify(selectedGPUs.value))
      window.localStorage.setItem(STATE_KEYS.models, JSON.stringify(selectedModels.value))
      window.localStorage.setItem(STATE_KEYS.timestamp, state.timestamp.toString())
      
      lastSavedState.value = state
    }
  } catch (error) {
    console.warn('Failed to save state to localStorage:', error)
    addStateError('Failed to save configuration. Your settings may not persist.')
  }
}

const loadStateFromStorage = () => {
  try {
    isStateRestoring.value = true
    
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedGPUs = window.localStorage.getItem(STATE_KEYS.gpus)
      const savedModels = window.localStorage.getItem(STATE_KEYS.models)
      const savedTimestamp = window.localStorage.getItem(STATE_KEYS.timestamp)
      
      if (savedGPUs) {
        const parsedGPUs = JSON.parse(savedGPUs)
        if (Array.isArray(parsedGPUs) && validateGPUSelections(parsedGPUs)) {
          selectedGPUs.value = parsedGPUs
        }
      }
      
      if (savedModels) {
        const parsedModels = JSON.parse(savedModels)
        if (Array.isArray(parsedModels) && validateModelSelections(parsedModels)) {
          selectedModels.value = parsedModels
        }
      }
      
      if (savedTimestamp) {
        lastSavedState.value = {
          gpus: selectedGPUs.value,
          models: selectedModels.value,
          timestamp: parseInt(savedTimestamp)
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load state from localStorage:', error)
    addStateError('Failed to restore previous configuration.')
  } finally {
    isStateRestoring.value = false
  }
}

const clearStoredState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      Object.values(STATE_KEYS).forEach(key => {
        window.localStorage.removeItem(key)
      })
      lastSavedState.value = null
    }
  } catch (error) {
    console.warn('Failed to clear stored state:', error)
  }
}

const addStateError = (message) => {
  const error = {
    id: Date.now(),
    message,
    timestamp: new Date()
  }
  stateErrors.value.push(error)
  
  // Auto-remove error after 5 seconds
  setTimeout(() => {
    removeStateError(error.id)
  }, 5000)
}

const removeStateError = (errorId) => {
  const index = stateErrors.value.findIndex(err => err.id === errorId)
  if (index > -1) {
    stateErrors.value.splice(index, 1)
  }
}

// State validation functions
const validateGPUSelections = (gpus) => {
  if (!Array.isArray(gpus)) return false
  
  return gpus.every(selection => {
    return (
      selection &&
      typeof selection === 'object' &&
      selection.gpu &&
      typeof selection.gpu.name === 'string' &&
      typeof selection.gpu.vram_gb === 'number' &&
      typeof selection.quantity === 'number' &&
      selection.quantity > 0 &&
      selection.quantity <= 8
    )
  })
}

const validateModelSelections = (models) => {
  if (!Array.isArray(models)) return false
  
  return models.every(model => {
    return (
      model &&
      typeof model === 'object' &&
      typeof model.name === 'string' &&
      (typeof model.size === 'number' || model.size === null)
    )
  })
}

// Enhanced state change handlers
const handleGPUSelectionChange = (newGPUs) => {
  if (!isStateRestoring.value) {
    selectedGPUs.value = newGPUs
    validateCurrentState()
    nextTick(() => {
      saveStateToStorage()
    })
  }
}

const handleModelSelectionChange = (newModels) => {
  if (!isStateRestoring.value) {
    selectedModels.value = newModels
    validateCurrentState()
    nextTick(() => {
      saveStateToStorage()
    })
  }
}

const validateCurrentState = () => {
  stateErrors.value = stateErrors.value.filter(err => err.message.includes('Failed to'))
  
  // Validate GPU selections
  if (selectedGPUs.value.length > 0) {
    const totalVRAMValue = totalVRAM.value
    if (totalVRAMValue > 1000) {
      addStateError('Extremely high VRAM configuration detected. Please verify your GPU selection.')
    }
    
    const totalGPUCount = selectedGPUs.value.reduce((sum, sel) => sum + sel.quantity, 0)
    if (totalGPUCount > 32) {
      addStateError('Large number of GPUs selected. This may impact performance.')
    }
  }
  
  // Validate model selections
  if (selectedModels.value.length > 0) {
    const totalModelSizeValue = totalModelSize.value
    if (totalModelSizeValue > totalVRAM.value * 0.8) {
      addStateError('Model size approaching VRAM limits. Consider quantization or additional GPUs.')
    }
  }
}

// Enhanced application lifecycle with state management
onMounted(() => {
  // Load saved state first
  loadStateFromStorage()
  
  // Mark application as ready after initial load
  setTimeout(() => {
    applicationReady.value = true
  }, 100)
})

// State change watchers for automatic persistence
watch(selectedGPUs, (newGPUs) => {
  handleGPUSelectionChange(newGPUs)
}, { deep: true })

watch(selectedModels, (newModels) => {
  handleModelSelectionChange(newModels)
}, { deep: true })

// Window beforeunload handler for cleanup
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    saveStateToStorage()
  })
}

// Configuration validation
const hasValidConfiguration = computed(
  () => selectedGPUs.value.length > 0 && selectedModels.value.length > 0
)

// Hardware calculations
const totalVRAM = computed(() =>
  selectedGPUs.value.reduce((total, sel) => total + sel.gpu.vram * sel.quantity, 0)
)

const totalModelSize = computed(() =>
  selectedModels.value.reduce((total, model) => total + (model.size || 0), 0)
)

// Configuration state tracking
const configurationStep = computed(() => {
  if (selectedGPUs.value.length === 0) return 'gpu'
  if (selectedModels.value.length === 0) return 'model'
  return 'complete'
})

// Progress indicator
const setupProgress = computed(() => {
  const steps = ['gpu', 'model', 'complete']
  const currentStepIndex = steps.indexOf(configurationStep.value)
  return Math.min(100, ((currentStepIndex + 1) / steps.length) * 100)
})

// Enhanced state analysis
const stateAnalysis = computed(() => {
  return {
    hasErrors: stateErrors.value.length > 0,
    isComplete: hasValidConfiguration.value,
    gpuCount: selectedGPUs.value.reduce((sum, sel) => sum + sel.quantity, 0),
    modelCount: selectedModels.value.length,
    memoryEfficiency: totalVRAM.value > 0 ? (totalModelSize.value / totalVRAM.value) : 0,
    hasCustomGPUs: selectedGPUs.value.some(sel => sel.gpu.custom),
    hasMultipleModels: selectedModels.value.length > 1,
    estimatedCost: calculateEstimatedCost(),
    lastSaved: lastSavedState.value?.timestamp || null
  }
})

const memoryPressure = computed(() => {
  if (totalVRAM.value === 0) return 'unknown'
  const ratio = totalModelSize.value / totalVRAM.value
  if (ratio > 0.9) return 'critical'
  if (ratio > 0.8) return 'high'
  if (ratio > 0.6) return 'moderate'
  return 'low'
})

const configurationHealth = computed(() => {
  const issues = []
  
  if (stateErrors.value.length > 0) {
    issues.push('State validation errors detected')
  }
  
  if (memoryPressure.value === 'critical') {
    issues.push('Critical memory pressure - models may not fit')
  }
  
  if (stateAnalysis.value.gpuCount > 16) {
    issues.push('Excessive GPU count may impact performance')
  }
  
  return {
    status: issues.length === 0 ? 'healthy' : issues.length === 1 ? 'warning' : 'critical',
    issues
  }
})

// Helper functions for state analysis
const calculateEstimatedCost = () => {
  // Simplified cost estimation based on GPU types
  return selectedGPUs.value.reduce((total, selection) => {
    const baseCost = selection.gpu.vram_gb * 0.1 // $0.10 per GB of VRAM per hour (example)
    return total + (baseCost * selection.quantity)
  }, 0)
}

// Development utilities (exposed to window for debugging)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.vllmDebug = {
    clearStoredState,
    configurationHealth,
    stateAnalysis,
    memoryPressure
  }
}

const configurations = computed(() => {
  if (!hasValidConfiguration.value) return []

  const remainingVRAM = totalVRAM.value - totalModelSize.value
  const baseMemoryUtilization = Math.min(
    0.9,
    Math.max(0.5, totalModelSize.value / totalVRAM.value + 0.1)
  )

  const configs = [
    {
      type: 'throughput',
      title: 'Maximum Throughput',
      description: 'Optimized for handling the highest number of concurrent requests and maximum token generation.',
      parameters: [
        {
          name: '--gpu-memory-utilization',
          value: Math.min(0.95, baseMemoryUtilization + 0.1).toFixed(2),
          explanation: 'High memory utilization to maximize concurrent processing capacity.',
        },
        {
          name: '--max-model-len',
          value: '2048',
          explanation: 'Shorter sequences to allow more concurrent requests and higher throughput.',
        },
        {
          name: '--max-num-seqs',
          value: Math.max(32, Math.floor(remainingVRAM / 2)).toString(),
          explanation: 'High concurrent sequence limit to maximize parallel processing.',
        },
        {
          name: '--max-num-batched-tokens',
          value: Math.max(8192, Math.floor(remainingVRAM * 1024)).toString(),
          explanation: 'Large batch size to maximize GPU utilization and throughput.',
        },
        {
          name: '--block-size',
          value: '16',
          explanation: 'Larger block size for efficient memory allocation in high-throughput scenarios.',
        },
        {
          name: '--swap-space',
          value: Math.max(4, Math.floor(totalVRAM.value * 0.1)).toString(),
          explanation: 'Generous swap space to handle peak memory usage during high throughput periods.',
        },
      ],
    },
    {
      type: 'latency',
      title: 'Minimum Latency',
      description: 'Optimized for fastest response times and lowest latency per request.',
      parameters: [
        {
          name: '--gpu-memory-utilization',
          value: Math.max(0.7, baseMemoryUtilization - 0.1).toFixed(2),
          explanation: 'Conservative memory utilization to ensure consistent performance and low latency.',
        },
        {
          name: '--max-model-len',
          value: '4096',
          explanation: 'Longer sequences supported while maintaining low latency for individual requests.',
        },
        {
          name: '--max-num-seqs',
          value: Math.max(8, Math.floor(remainingVRAM / 4)).toString(),
          explanation: 'Lower concurrent sequences to minimize context switching and latency.',
        },
        {
          name: '--max-num-batched-tokens',
          value: Math.max(2048, Math.floor(remainingVRAM * 512)).toString(),
          explanation: 'Smaller batches for faster processing and reduced waiting time.',
        },
        {
          name: '--block-size',
          value: '8',
          explanation: 'Smaller block size for more granular memory management and faster allocation.',
        },
        {
          name: '--swap-space',
          value: Math.max(2, Math.floor(totalVRAM.value * 0.05)).toString(),
          explanation: 'Minimal swap space to reduce memory management overhead.',
        },
      ],
    },
    {
      type: 'balanced',
      title: 'Balanced Performance',
      description: 'Balanced configuration providing good throughput while maintaining reasonable latency.',
      parameters: [
        {
          name: '--gpu-memory-utilization',
          value: baseMemoryUtilization.toFixed(2),
          explanation: 'Balanced memory utilization for optimal resource usage without overcommitment.',
        },
        {
          name: '--max-model-len',
          value: '3072',
          explanation: 'Moderate sequence length balancing memory usage and capability.',
        },
        {
          name: '--max-num-seqs',
          value: Math.max(16, Math.floor(remainingVRAM / 3)).toString(),
          explanation: 'Moderate concurrent sequences for balanced performance.',
        },
        {
          name: '--max-num-batched-tokens',
          value: Math.max(4096, Math.floor(remainingVRAM * 768)).toString(),
          explanation: 'Medium batch size balancing throughput and latency.',
        },
        {
          name: '--block-size',
          value: '12',
          explanation: 'Medium block size for balanced memory management efficiency.',
        },
        {
          name: '--swap-space',
          value: Math.max(3, Math.floor(totalVRAM.value * 0.075)).toString(),
          explanation: 'Reasonable swap space for handling moderate memory pressure.',
        },
      ],
    },
  ]

  return configs
})

// Chart data and options
const chartData = ref({
  labels: ['Tesla A100', 'RTX 4090', 'H100', 'V100'],
  datasets: [
    {
      label: 'VRAM (GB)',
      backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'],
      data: [80, 24, 80, 32],
    },
  ],
})

const chartOptions = ref({
  responsive: true,
  plugins: {
    title: {
      display: true,
      text: 'GPU VRAM Comparison',
    },
    legend: {
      display: true,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'VRAM (GB)',
      },
    },
  },
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
    <!-- Navigation Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center space-x-4">
            <div class="flex-shrink-0">
              <svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">vLLM Calculator</h1>
              <p class="text-sm text-gray-500">GPU Configuration Tool</p>
            </div>
          </div>
          
          <!-- Progress Indicator -->
          <div class="hidden md:flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <span class="text-sm font-medium text-gray-700">Setup Progress</span>
              <div class="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  :style="{ width: setupProgress + '%' }"
                ></div>
              </div>
              <span class="text-sm text-gray-500">{{ Math.round(setupProgress) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Hero Section -->
      <section class="text-center mb-12" v-if="applicationReady">
        <div class="max-w-4xl mx-auto">
          <h2 class="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Optimize Your vLLM Deployment
          </h2>
          <p class="text-xl text-gray-600 mb-8">
            Configure optimal vLLM parameters for your GPU and model setup with intelligent recommendations
            based on throughput, latency, and balanced performance profiles.
          </p>
          
          <!-- Configuration Status -->
          <div class="flex justify-center mb-8">
            <div class="flex items-center space-x-4 bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-3">
              <div class="flex items-center space-x-2">
                <div class="flex items-center">
                  <div :class="[
                    'w-3 h-3 rounded-full mr-2',
                    selectedGPUs.length > 0 ? 'bg-green-500' : 'bg-gray-300'
                  ]"></div>
                  <span class="text-sm font-medium text-gray-700">GPU Selected</span>
                </div>
                <span class="text-gray-400">→</span>
                <div class="flex items-center">
                  <div :class="[
                    'w-3 h-3 rounded-full mr-2',
                    selectedModels.length > 0 ? 'bg-green-500' : 'bg-gray-300'
                  ]"></div>
                  <span class="text-sm font-medium text-gray-700">Model Selected</span>
                </div>
                <span class="text-gray-400">→</span>
                <div class="flex items-center">
                  <div :class="[
                    'w-3 h-3 rounded-full mr-2',
                    hasValidConfiguration ? 'bg-green-500' : 'bg-gray-300'
                  ]"></div>
                  <span class="text-sm font-medium text-gray-700">Ready to Configure</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Enhanced State Dashboard -->
          <div v-if="stateAnalysis.isComplete" class="mb-8">
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h4 class="text-lg font-semibold text-gray-900 mb-4">Configuration Summary</h4>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="text-center">
                  <div class="text-2xl font-bold text-blue-600">{{ stateAnalysis.gpuCount }}</div>
                  <div class="text-sm text-gray-600">Total GPUs</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-blue-600">{{ totalVRAM }}GB</div>
                  <div class="text-sm text-gray-600">Total VRAM</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-blue-600">{{ stateAnalysis.modelCount }}</div>
                  <div class="text-sm text-gray-600">Models</div>
                </div>
                <div class="text-center">
                  <div :class="[
                    'text-2xl font-bold',
                    memoryPressure === 'low' ? 'text-green-600' :
                    memoryPressure === 'moderate' ? 'text-yellow-600' :
                    memoryPressure === 'high' ? 'text-orange-600' : 'text-red-600'
                  ]">
                    {{ Math.round(stateAnalysis.memoryEfficiency * 100) }}%
                  </div>
                  <div class="text-sm text-gray-600">Memory Usage</div>
                </div>
              </div>
              
              <!-- Memory Pressure Indicator -->
              <div v-if="memoryPressure !== 'low'" class="mt-4 p-3 rounded-lg" :class="{
                'bg-yellow-50 border border-yellow-200': memoryPressure === 'moderate',
                'bg-orange-50 border border-orange-200': memoryPressure === 'high',
                'bg-red-50 border border-red-200': memoryPressure === 'critical'
              }">
                <div class="flex items-center">
                  <svg class="w-5 h-5 mr-2" :class="{
                    'text-yellow-600': memoryPressure === 'moderate',
                    'text-orange-600': memoryPressure === 'high',
                    'text-red-600': memoryPressure === 'critical'
                  }" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                  </svg>
                  <span class="font-medium" :class="{
                    'text-yellow-800': memoryPressure === 'moderate',
                    'text-orange-800': memoryPressure === 'high',
                    'text-red-800': memoryPressure === 'critical'
                  }">
                    {{ memoryPressure === 'moderate' ? 'Moderate' : 
                       memoryPressure === 'high' ? 'High' : 'Critical' }} Memory Pressure
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Configuration Steps -->
      <div class="space-y-12">
        <!-- Step 1: GPU Selection -->
        <section class="scroll-mt-20" id="gpu-selection">
          <div class="flex items-center mb-6">
            <div class="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold mr-4">
              1
            </div>
            <h3 class="text-2xl font-bold text-gray-900">Select Your GPU Configuration</h3>
          </div>
          
          <!-- State Error Display -->
          <div v-if="stateErrors.length > 0" class="mb-6 space-y-2">
            <div 
              v-for="error in stateErrors" 
              :key="error.id"
              class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start"
            >
              <svg class="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
              <div class="flex-1">
                <p class="text-red-700 font-medium">{{ error.message }}</p>
                <p class="text-red-600 text-sm mt-1">{{ error.timestamp.toLocaleTimeString() }}</p>
              </div>
              <button 
                @click="removeStateError(error.id)"
                class="ml-4 text-red-400 hover:text-red-600 focus:outline-none"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <GPUSelector 
            v-model:selectedGPUs="selectedGPUs"
            @update:selectedGPUs="handleGPUSelectionChange"
          />
        </section>

        <!-- Step 2: Model Selection -->
        <section class="scroll-mt-20" id="model-selection">
          <div class="flex items-center mb-6">
            <div class="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold mr-4">
              2
            </div>
            <h3 class="text-2xl font-bold text-gray-900">Choose Your Model</h3>
          </div>
          <ModelSelector 
            v-model:selectedModels="selectedModels"
            @update:selectedModels="handleModelSelectionChange"
          />
        </section>

        <!-- Configuration Results -->
        <section v-if="hasValidConfiguration" class="scroll-mt-20" id="configuration-output">
          <div class="flex items-center mb-6">
            <div class="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-bold mr-4">
              ✓
            </div>
            <h3 class="text-2xl font-bold text-gray-900">Optimized vLLM Configurations</h3>
          </div>
          <ConfigurationOutput 
            :selectedGPUs="selectedGPUs"
            :selectedModels="selectedModels"
          />
        </section>

        <!-- VRAM Visualization -->
        <section v-if="hasValidConfiguration" class="scroll-mt-20" id="vram-analysis">
          <div class="flex items-center mb-6">
            <div class="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold mr-4">
              📊
            </div>
            <h3 class="text-2xl font-bold text-gray-900">Memory Usage Analysis</h3>
          </div>
          <VRAMChart 
            :selectedGPUs="selectedGPUs"
            :selectedModels="selectedModels"
            :configurations="configurations"
            :showBreakdown="true"
            title="VRAM Memory Allocation by Configuration"
          />
        </section>
      </div>

      <!-- Chart.js Integration Test (development only) -->
      <section v-if="hasValidConfiguration" class="mt-16">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h4 class="text-xl font-bold text-gray-900 mb-6 text-center">Development: Chart.js Integration Test</h4>
          <div class="h-64">
            <Bar :data="chartData" :options="chartOptions" />
          </div>
          <p class="text-green-600 font-semibold text-center mt-4">✅ Chart.js Integration Ready</p>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 mt-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="text-center">
          <p class="text-gray-500 text-sm">
            vLLM Configuration Calculator - Optimize your large language model deployments
          </p>
          <p class="text-gray-400 text-xs mt-2">
            Built with Vue.js, Tailwind CSS, and Chart.js
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Tailwind CSS classes handle the styling */
</style>
