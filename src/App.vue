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
import ErrorBoundary from './components/ErrorBoundary.vue'
import LoadingIndicator from './components/LoadingIndicator.vue'
import {
  calculateThroughputOptimizedConfig,
  calculateLatencyOptimalBatchSize,
  calculateBalancedOptimizedConfig,
  calculateVLLMMemoryUsage,
  estimateThroughputMetrics,
  estimateLatencyMetrics,
  calculateMemoryAllocationStrategy,
  generateVLLMCommand,
  calculateKVCacheMemory,
} from './lib/calculationEngine.js'
import {
  calculateModelWeightsMemory,
  getSupportedQuantizationFormats,
  generateQuantizationRecommendation
} from './lib/quantization.js'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Enhanced state management with persistence and validation
const selectedGPUs = ref([])
const selectedModels = ref([])
const applicationReady = ref(false)
const lastSavedState = ref(null)
const stateErrors = ref([])
const isStateRestoring = ref(false)

// Navigation and UI state
const showSettingsMenu = ref(false)
const showMobileMenu = ref(false)
const showDebugInfo = ref(false)

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

  // Add click listener to close menus when clicking outside
  const handleDocumentClick = (event) => {
    // Close settings menu if clicking outside
    if (showSettingsMenu.value) {
      const settingsButton = event.target.closest('[data-settings-menu]')
      if (!settingsButton) {
        showSettingsMenu.value = false
      }
    }
    
    // Close mobile menu if clicking outside
    if (showMobileMenu.value) {
      const mobileMenuButton = event.target.closest('[data-mobile-menu]')
      const mobileMenuContent = event.target.closest('[data-mobile-menu-content]')
      if (!mobileMenuButton && !mobileMenuContent) {
        showMobileMenu.value = false
      }
    }
  }

  document.addEventListener('click', handleDocumentClick)
  
  // Cleanup event listener on unmount
  return () => {
    document.removeEventListener('click', handleDocumentClick)
  }
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

// Enhanced VRAM breakdown calculations using calculation engine
const vramBreakdown = computed(() => {
  if (!hasValidConfiguration.value) return null

  try {
    const breakdown = {
      modelWeights: 0,
      kvCache: 0,
      activations: 0,
      systemOverhead: 0,
      available: 0
    }

    // Calculate model weights memory for each selected model
    selectedModels.value.forEach(model => {
      const params = model.parameters || estimateParametersFromSize(model.size)
      const quantization = model.quantization || 'fp16'
      
      const weightsMemory = calculateModelWeightsMemory(params, quantization)
      breakdown.modelWeights += weightsMemory
    })

    // Calculate KV cache memory (estimate based on configuration)
    const avgConfig = configurations.value.find(c => c.type === 'balanced') || configurations.value[0]
    if (avgConfig && avgConfig.parameters) {
      const maxSeqs = parseInt(avgConfig.parameters.find(p => p.name === '--max-num-seqs')?.value || '16')
      const maxLen = parseInt(avgConfig.parameters.find(p => p.name === '--max-model-len')?.value || '2048')
      
      selectedModels.value.forEach(model => {
        const params = model.parameters || estimateParametersFromSize(model.size)
        const kvMemory = calculateKVCacheMemory(
          params,
          maxSeqs,
          maxLen,
          'fp16', // Assuming fp16 for KV cache
          { numLayers: Math.floor(Math.sqrt(params / 1000000)) } // Rough layer estimation
        )
        breakdown.kvCache += kvMemory
      })
    }

    // Estimate activation memory (roughly 10-20% of model weights)
    breakdown.activations = breakdown.modelWeights * 0.15

    // Estimate system overhead (roughly 5-10% of total VRAM)
    breakdown.systemOverhead = totalVRAM.value * 0.08

    // Calculate available memory
    const usedMemory = breakdown.modelWeights + breakdown.kvCache + 
                      breakdown.activations + breakdown.systemOverhead
    breakdown.available = Math.max(0, totalVRAM.value - usedMemory)

    return breakdown
  } catch (error) {
    console.error('Error calculating VRAM breakdown:', error)
    
    // Fallback calculation
    const modelMemory = totalModelSize.value
    const kvCache = modelMemory * 0.3 // Rough estimate
    const activations = modelMemory * 0.15
    const systemOverhead = totalVRAM.value * 0.08
    const available = Math.max(0, totalVRAM.value - modelMemory - kvCache - activations - systemOverhead)

    return {
      modelWeights: modelMemory,
      kvCache,
      activations,
      systemOverhead,
      available
    }
  }
})

// Enhanced quantization recommendations
const quantizationRecommendations = computed(() => {
  if (!hasValidConfiguration.value) return []

  try {
    const recommendations = []
    
    selectedModels.value.forEach(model => {
      if (model.size && model.size > 0) {
        const recommendation = generateQuantizationRecommendation(
          totalVRAM.value,
          model.parameters || estimateParametersFromSize(model.size),
          {
            modelName: model.name,
            targetMemoryUtilization: 0.85,
            qualityTolerance: 'medium'
          }
        )
        
        if (recommendation) {
          recommendations.push({
            modelName: model.name,
            currentFormat: model.quantization || 'fp16',
            recommendedFormat: recommendation.recommendedFormat,
            memorySavings: recommendation.memorySavings,
            qualityImpact: recommendation.qualityImpact,
            reason: recommendation.reason
          })
        }
      }
    })

    return recommendations
  } catch (error) {
    console.error('Error generating quantization recommendations:', error)
    return []
  }
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
    memoryPressure,
    vramBreakdown,
    quantizationRecommendations,
    // Calculation engine functions for debugging
    calculateLatencyOptimalBatchSize,
    calculateVLLMMemoryUsage,
    estimateThroughputMetrics,
    estimateLatencyMetrics,
    calculateMemoryAllocationStrategy,
    getSupportedQuantizationFormats
  }
}

const configurations = computed(() => {
  if (!hasValidConfiguration.value) return []

  // Prepare parameters for calculation engine
  const totalVRAMValue = totalVRAM.value
  const totalModelSizeValue = totalModelSize.value
  
  // Extract hardware specifications
  const hardwareSpecs = {
    totalVRAM: totalVRAMValue,
    gpuCount: selectedGPUs.value.reduce((sum, sel) => sum + sel.quantity, 0),
    gpuTypes: selectedGPUs.value.map(sel => sel.gpu.name),
    memoryBandwidth: selectedGPUs.value.reduce((total, sel) => {
      // Estimate memory bandwidth based on GPU type
      const estimatedBandwidth = sel.gpu.vram_gb > 80 ? 3500 : // H100/A100 class
                                 sel.gpu.vram_gb > 40 ? 2000 : // RTX 6000 class  
                                 sel.gpu.vram_gb > 20 ? 1000 : // RTX 4090 class
                                 800 // Lower-end GPUs
      return total + (estimatedBandwidth * sel.quantity)
    }, 0) / selectedGPUs.value.reduce((sum, sel) => sum + sel.quantity, 0) // Average
  }
  
  // Extract model specifications
  const modelSpecs = selectedModels.value.map(model => ({
    name: model.name,
    parameters: model.parameters || estimateParametersFromSize(model.size),
    size: model.size || 0,
    quantization: model.quantization || 'fp16',
    architecture: model.architecture || 'transformer'
  }))
  
  // Common calculation parameters
  const baseParams = {
    totalVRAMGB: totalVRAMValue,
    modelSizeGB: totalModelSizeValue,
    models: modelSpecs,
    hardware: hardwareSpecs
  }

  try {
    // Generate optimized configurations using calculation engine
    const throughputConfig = calculateThroughputOptimizedConfig({
      ...baseParams,
      optimizationTarget: 'throughput',
      maxSequenceLength: 2048,
      prioritizeMemoryEfficiency: false
    })
    
    const latencyConfig = calculateBalancedOptimizedConfig({
      ...baseParams,
      optimizationTarget: 'latency',
      maxSequenceLength: 4096,
      balanceTarget: 'latency'
    })
    
    const balancedConfig = calculateBalancedOptimizedConfig({
      ...baseParams,
      optimizationTarget: 'balanced',
      maxSequenceLength: 3072,
      balanceTarget: 'general'
    })

    // Transform calculation engine output to UI format
    return [
      transformConfigToUI(throughputConfig, 'throughput', 'Maximum Throughput'),
      transformConfigToUI(latencyConfig, 'latency', 'Minimum Latency'),
      transformConfigToUI(balancedConfig, 'balanced', 'Balanced Performance')
    ]
  } catch (error) {
    console.error('Error generating configurations with calculation engine:', error)
    
    // Fallback to basic calculations if engine fails
    return generateFallbackConfigurations(totalVRAMValue, totalModelSizeValue)
  }
})

// Helper function to estimate parameters from model size
const estimateParametersFromSize = (sizeGB) => {
  if (!sizeGB) return 7000000000 // Default 7B parameters
  // Rough estimation: ~2 bytes per parameter for fp16
  return Math.round((sizeGB * 1024 * 1024 * 1024) / 2)
}

// Transform calculation engine output to UI-compatible format
const transformConfigToUI = (engineConfig, type, title) => {
  if (!engineConfig || !engineConfig.parameters) {
    return generateFallbackConfig(type, title)
  }

  const params = engineConfig.parameters
  const metrics = engineConfig.metrics || {}
  
  // Map calculation engine parameters to UI format
  const uiParameters = [
    {
      name: '--gpu-memory-utilization',
      value: params['gpu-memory-utilization'] || '0.85',
      explanation: engineConfig.explanations?.find(e => e.includes('memory utilization'))?.text || 
                   'GPU memory utilization for optimal performance.'
    },
    {
      name: '--max-model-len',
      value: params['max-model-len'] || '2048',
      explanation: engineConfig.explanations?.find(e => e.includes('sequence length'))?.text ||
                   'Maximum sequence length supported by the configuration.'
    },
    {
      name: '--max-num-seqs',
      value: params['max-num-seqs'] || '16',
      explanation: engineConfig.explanations?.find(e => e.includes('concurrent sequences'))?.text ||
                   'Maximum number of concurrent sequences.'
    },
    {
      name: '--max-num-batched-tokens',
      value: params['max-num-batched-tokens'] || '4096',
      explanation: engineConfig.explanations?.find(e => e.includes('batch'))?.text ||
                   'Maximum number of tokens processed in a single batch.'
    },
    {
      name: '--block-size',
      value: params['block-size'] || '16',
      explanation: 'Block size for memory allocation and attention computation.'
    }
  ]

  // Add optional parameters if present
  if (params['swap-space']) {
    uiParameters.push({
      name: '--swap-space',
      value: params['swap-space'],
      explanation: 'Swap space allocation for handling memory overflow.'
    })
  }

  if (params['enable-chunked-prefill'] === 'true') {
    uiParameters.push({
      name: '--enable-chunked-prefill',
      value: 'true',
      explanation: 'Enable chunked prefill for better memory management.'
    })
  }

  return {
    type,
    title,
    description: engineConfig.description || `${title} configuration optimized using advanced calculations.`,
    parameters: uiParameters,
    metrics: {
      estimatedThroughput: metrics.estimatedThroughput || 'N/A',
      estimatedLatency: metrics.averageLatency || 'N/A',
      memoryEfficiency: metrics.memoryEfficiency || 'N/A',
      ...metrics
    },
    command: engineConfig.command || generateVLLMCommand(params)
  }
}

// Fallback configuration generation for when calculation engine fails
const generateFallbackConfigurations = (totalVRAMValue, totalModelSizeValue) => {
  const remainingVRAM = totalVRAMValue - totalModelSizeValue
  const baseMemoryUtilization = Math.min(
    0.9,
    Math.max(0.5, totalModelSizeValue / totalVRAMValue + 0.1)
  )

  return [
    generateFallbackConfig('throughput', 'Maximum Throughput', {
      gpuMemoryUtilization: Math.min(0.95, baseMemoryUtilization + 0.1).toFixed(2),
      maxModelLen: '2048',
      maxNumSeqs: Math.max(32, Math.floor(remainingVRAM / 2)).toString(),
      maxNumBatchedTokens: Math.max(8192, Math.floor(remainingVRAM * 1024)).toString(),
      blockSize: '16',
      swapSpace: Math.max(4, Math.floor(totalVRAMValue * 0.1)).toString()
    }),
    generateFallbackConfig('latency', 'Minimum Latency', {
      gpuMemoryUtilization: Math.max(0.7, baseMemoryUtilization - 0.1).toFixed(2),
      maxModelLen: '4096',
      maxNumSeqs: Math.max(8, Math.floor(remainingVRAM / 4)).toString(),
      maxNumBatchedTokens: Math.max(2048, Math.floor(remainingVRAM * 512)).toString(),
      blockSize: '8',
      swapSpace: Math.max(2, Math.floor(totalVRAMValue * 0.05)).toString()
    }),
    generateFallbackConfig('balanced', 'Balanced Performance', {
      gpuMemoryUtilization: baseMemoryUtilization.toFixed(2),
      maxModelLen: '3072',
      maxNumSeqs: Math.max(16, Math.floor(remainingVRAM / 3)).toString(),
      maxNumBatchedTokens: Math.max(4096, Math.floor(remainingVRAM * 768)).toString(),
      blockSize: '12',
      swapSpace: Math.max(3, Math.floor(totalVRAMValue * 0.075)).toString()
    })
  ]
}

const generateFallbackConfig = (type, title, params = {}) => {
  const descriptions = {
    throughput: 'Optimized for handling the highest number of concurrent requests and maximum token generation.',
    latency: 'Optimized for fastest response times and lowest latency per request.',
    balanced: 'Balanced configuration providing good throughput while maintaining reasonable latency.'
  }

  const defaultParams = {
    gpuMemoryUtilization: '0.85',
    maxModelLen: '2048',
    maxNumSeqs: '16',
    maxNumBatchedTokens: '4096',
    blockSize: '16',
    swapSpace: '4'
  }

  const finalParams = { ...defaultParams, ...params }

  return {
    type,
    title,
    description: descriptions[type] || 'Fallback configuration with basic optimization.',
    parameters: [
      {
        name: '--gpu-memory-utilization',
        value: finalParams.gpuMemoryUtilization,
        explanation: 'GPU memory utilization for this configuration type.'
      },
      {
        name: '--max-model-len',
        value: finalParams.maxModelLen,
        explanation: 'Maximum sequence length supported.'
      },
      {
        name: '--max-num-seqs',
        value: finalParams.maxNumSeqs,
        explanation: 'Maximum number of concurrent sequences.'
      },
      {
        name: '--max-num-batched-tokens',
        value: finalParams.maxNumBatchedTokens,
        explanation: 'Maximum tokens processed in a batch.'
      },
      {
        name: '--block-size',
        value: finalParams.blockSize,
        explanation: 'Block size for memory allocation.'
      },
      {
        name: '--swap-space',
        value: finalParams.swapSpace,
        explanation: 'Swap space allocation in GB.'
      }
    ]
  }
}

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
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm backdrop-blur-sm bg-white/95">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Brand Section -->
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

          <!-- Navigation Links -->
          <nav class="hidden lg:flex items-center space-x-8">
            <a 
              href="#gpu-selection" 
              :class="[
                'text-sm font-medium transition-colors duration-200',
                configurationStep === 'gpu' 
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-1' 
                  : 'text-gray-600 hover:text-gray-900'
              ]"
            >
              <span class="flex items-center space-x-1">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                </svg>
                <span>GPU Setup</span>
              </span>
            </a>
            
            <a 
              href="#model-selection" 
              :class="[
                'text-sm font-medium transition-colors duration-200',
                configurationStep === 'model' 
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-1' 
                  : selectedGPUs.length > 0 
                    ? 'text-gray-600 hover:text-gray-900' 
                    : 'text-gray-400 cursor-not-allowed'
              ]"
            >
              <span class="flex items-center space-x-1">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Model Setup</span>
              </span>
            </a>
            
            <a 
              href="#configuration-results" 
              :class="[
                'text-sm font-medium transition-colors duration-200',
                configurationStep === 'complete' 
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-1' 
                  : hasValidConfiguration 
                    ? 'text-gray-600 hover:text-gray-900' 
                    : 'text-gray-400 cursor-not-allowed'
              ]"
            >
              <span class="flex items-center space-x-1">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
                </svg>
                <span>Configurations</span>
              </span>
            </a>
          </nav>
          
          <!-- Action Buttons & Status -->
          <div class="flex items-center space-x-4">
            <!-- Configuration Health Indicator -->
            <div class="hidden md:flex items-center space-x-2">
              <div 
                :class="[
                  'w-3 h-3 rounded-full',
                  configurationHealth.status === 'healthy' ? 'bg-green-500' :
                  configurationHealth.status === 'warning' ? 'bg-yellow-500' :
                  'bg-red-500'
                ]"
                :title="configurationHealth.issues.join(', ') || 'Configuration is healthy'"
              ></div>
              <span class="text-sm text-gray-600">
                {{ configurationHealth.status === 'healthy' ? 'Ready' : 
                   configurationHealth.status === 'warning' ? 'Warning' : 'Issues' }}
              </span>
            </div>

            <!-- Progress Indicator -->
            <div class="hidden lg:flex items-center space-x-2">
              <span class="text-sm font-medium text-gray-700">Setup Progress</span>
              <div class="w-24 bg-gray-200 rounded-full h-2">
                <div 
                  class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  :style="{ width: setupProgress + '%' }"
                ></div>
              </div>
              <span class="text-sm text-gray-500">{{ Math.round(setupProgress) }}%</span>
            </div>

            <!-- Action Menu -->
            <div class="flex items-center space-x-2">
              <!-- Save Configuration -->
              <button
                v-if="hasValidConfiguration"
                @click="saveStateToStorage"
                class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                title="Save current configuration"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                Save
              </button>

              <!-- Clear Configuration -->
              <button
                v-if="selectedGPUs.length > 0 || selectedModels.length > 0"
                @click="clearStoredState(); selectedGPUs.splice(0); selectedModels.splice(0);"
                class="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                title="Clear all selections"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                Clear
              </button>

              <!-- Settings Dropdown -->
              <div class="relative" @click="$event.stopPropagation()" data-settings-menu>
                <button
                  @click="showSettingsMenu = !showSettingsMenu"
                  class="inline-flex items-center p-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  title="Settings and options"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                  </svg>
                </button>

                <!-- Settings Dropdown Menu -->
                <div
                  v-if="showSettingsMenu"
                  class="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                  @click.stop
                >
                  <div class="py-1">
                    <div class="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      Configuration
                    </div>
                    <button
                      @click="clearStoredState(); showSettingsMenu = false"
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <svg class="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                      Clear Saved Data
                    </button>
                    
                    <div class="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 border-t border-gray-100 mt-1">
                      View Options
                    </div>
                    <button
                      @click="showDebugInfo = !showDebugInfo; showSettingsMenu = false"
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <svg class="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      {{ showDebugInfo ? 'Hide' : 'Show' }} Debug Info
                    </button>
                    
                    <a
                      href="https://docs.vllm.ai/"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      @click="showSettingsMenu = false"
                    >
                      <svg class="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                      </svg>
                      vLLM Documentation
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <!-- Mobile Menu Button -->
            <button
              @click="showMobileMenu = !showMobileMenu"
              class="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              data-mobile-menu
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="!showMobileMenu" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile Navigation Menu -->
        <div v-if="showMobileMenu" class="md:hidden border-t border-gray-200 bg-white" data-mobile-menu-content>
          <div class="pt-2 pb-3 space-y-1">
            <!-- Mobile Progress Indicator -->
            <div class="px-4 py-2">
              <div class="flex items-center space-x-2 mb-2">
                <span class="text-sm font-medium text-gray-700">Setup Progress</span>
                <span class="text-sm text-gray-500">{{ Math.round(setupProgress) }}%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div 
                  class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  :style="{ width: setupProgress + '%' }"
                ></div>
              </div>
            </div>

            <!-- Mobile Navigation Links -->
            <a
              href="#gpu-selection"
              @click="showMobileMenu = false"
              :class="[
                'block px-4 py-2 text-base font-medium border-l-4 transition-colors duration-200',
                configurationStep === 'gpu'
                  ? 'text-blue-700 bg-blue-50 border-blue-500'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-transparent'
              ]"
            >
              GPU Setup
            </a>
            
            <a
              href="#model-selection"
              @click="showMobileMenu = false"
              :class="[
                'block px-4 py-2 text-base font-medium border-l-4 transition-colors duration-200',
                configurationStep === 'model'
                  ? 'text-blue-700 bg-blue-50 border-blue-500'
                  : selectedGPUs.length > 0
                    ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-transparent'
                    : 'text-gray-400 border-transparent cursor-not-allowed'
              ]"
            >
              Model Setup
            </a>
            
            <a
              href="#configuration-results"
              @click="showMobileMenu = false"
              :class="[
                'block px-4 py-2 text-base font-medium border-l-4 transition-colors duration-200',
                configurationStep === 'complete'
                  ? 'text-blue-700 bg-blue-50 border-blue-500'
                  : hasValidConfiguration
                    ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-transparent'
                    : 'text-gray-400 border-transparent cursor-not-allowed'
              ]"
            >
              Configurations
            </a>

            <!-- Mobile Action Buttons -->
            <div class="px-4 py-3 border-t border-gray-200 space-y-2">
              <button
                v-if="hasValidConfiguration"
                @click="saveStateToStorage(); showMobileMenu = false"
                class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                Save Configuration
              </button>
              
              <button
                v-if="selectedGPUs.length > 0 || selectedModels.length > 0"
                @click="clearStoredState(); selectedGPUs.splice(0); selectedModels.splice(0); showMobileMenu = false"
                class="w-full flex items-center justify-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <ErrorBoundary>
        <LoadingIndicator />
        
        <!-- Hero Section -->
        <section class="text-center mb-8 sm:mb-12" v-if="applicationReady">
        <div class="max-w-4xl mx-auto px-2 sm:px-0">
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight">
            Optimize Your vLLM Deployment
          </h2>
          <p class="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 leading-relaxed">
            Configure optimal vLLM parameters for your GPU and model setup with intelligent recommendations
            based on throughput, latency, and balanced performance profiles.
          </p>
          
          <!-- Configuration Status -->
          <div class="flex justify-center mb-6 sm:mb-8">
            <div class="w-full max-w-2xl">
              <!-- Desktop Layout -->
              <div class="hidden sm:flex items-center space-x-4 bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-3">
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

              <!-- Mobile Layout -->
              <div class="sm:hidden bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-700">GPU Selected</span>
                  <div :class="[
                    'w-3 h-3 rounded-full',
                    selectedGPUs.length > 0 ? 'bg-green-500' : 'bg-gray-300'
                  ]"></div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-700">Model Selected</span>
                  <div :class="[
                    'w-3 h-3 rounded-full',
                    selectedModels.length > 0 ? 'bg-green-500' : 'bg-gray-300'
                  ]"></div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-700">Ready to Configure</span>
                  <div :class="[
                    'w-3 h-3 rounded-full',
                    hasValidConfiguration ? 'bg-green-500' : 'bg-gray-300'
                  ]"></div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Enhanced State Dashboard -->
          <div v-if="stateAnalysis.isComplete" class="mb-6 sm:mb-8">
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h4 class="text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Configuration Summary</h4>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div class="text-center">
                  <div class="text-xl sm:text-2xl font-bold text-blue-600">{{ stateAnalysis.gpuCount }}</div>
                  <div class="text-xs sm:text-sm text-gray-600">Total GPUs</div>
                </div>
                <div class="text-center">
                  <div class="text-xl sm:text-2xl font-bold text-blue-600">{{ totalVRAM }}GB</div>
                  <div class="text-xs sm:text-sm text-gray-600">Total VRAM</div>
                </div>
                <div class="text-center">
                  <div class="text-xl sm:text-2xl font-bold text-blue-600">{{ stateAnalysis.modelCount }}</div>
                  <div class="text-xs sm:text-sm text-gray-600">Models</div>
                </div>
                <div class="text-center">
                  <div :class="[
                    'text-xl sm:text-2xl font-bold',
                    memoryPressure === 'low' ? 'text-green-600' :
                    memoryPressure === 'moderate' ? 'text-yellow-600' :
                    memoryPressure === 'high' ? 'text-orange-600' : 'text-red-600'
                  ]">
                    {{ Math.round(stateAnalysis.memoryEfficiency * 100) }}%
                  </div>
                  <div class="text-xs sm:text-sm text-gray-600">Memory Usage</div>
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
              
              <!-- VRAM Breakdown -->
              <div v-if="vramBreakdown" class="mt-4 sm:mt-6">
                <h5 class="text-sm sm:text-md font-medium text-gray-900 mb-3">VRAM Allocation Breakdown</h5>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3 text-sm">
                  <div class="bg-blue-50 p-2 sm:p-3 rounded-lg border border-blue-200">
                    <div class="font-medium text-blue-900 text-xs sm:text-sm">Model Weights</div>
                    <div class="text-blue-700 text-sm sm:text-base font-semibold">{{ vramBreakdown.modelWeights.toFixed(1) }}GB</div>
                  </div>
                  <div class="bg-green-50 p-2 sm:p-3 rounded-lg border border-green-200">
                    <div class="font-medium text-green-900 text-xs sm:text-sm">KV Cache</div>
                    <div class="text-green-700 text-sm sm:text-base font-semibold">{{ vramBreakdown.kvCache.toFixed(1) }}GB</div>
                  </div>
                  <div class="bg-yellow-50 p-2 sm:p-3 rounded-lg border border-yellow-200">
                    <div class="font-medium text-yellow-900 text-xs sm:text-sm">Activations</div>
                    <div class="text-yellow-700 text-sm sm:text-base font-semibold">{{ vramBreakdown.activations.toFixed(1) }}GB</div>
                  </div>
                  <div class="bg-red-50 p-2 sm:p-3 rounded-lg border border-red-200">
                    <div class="font-medium text-red-900 text-xs sm:text-sm">System</div>
                    <div class="text-red-700 text-sm sm:text-base font-semibold">{{ vramBreakdown.systemOverhead.toFixed(1) }}GB</div>
                  </div>
                  <div class="bg-gray-50 p-2 sm:p-3 rounded-lg border border-gray-200">
                    <div class="font-medium text-gray-900 text-xs sm:text-sm">Available</div>
                    <div class="text-gray-700 text-sm sm:text-base font-semibold">{{ vramBreakdown.available.toFixed(1) }}GB</div>
                  </div>
                </div>
              </div>
              
              <!-- Quantization Recommendations -->
              <div v-if="quantizationRecommendations.length > 0" class="mt-4 sm:mt-6">
                <h5 class="text-sm sm:text-md font-medium text-gray-900 mb-3">Quantization Recommendations</h5>
                <div class="space-y-2">
                  <div 
                    v-for="rec in quantizationRecommendations" 
                    :key="rec.modelName"
                    class="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2 sm:space-y-0"
                  >
                    <div class="flex-1">
                      <div class="font-medium text-blue-900">{{ rec.modelName }}</div>
                      <div class="text-sm text-blue-700">{{ rec.reason }}</div>
                    </div>
                    <div class="text-left sm:text-right">
                      <div class="text-sm font-medium text-blue-900">
                        {{ rec.currentFormat }} → {{ rec.recommendedFormat }}
                      </div>
                      <div class="text-xs text-blue-700">
                        Save {{ rec.memorySavings.toFixed(1) }}GB
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>      <!-- Configuration Steps -->
      <div class="space-y-8 sm:space-y-12">
        <!-- Step 1: GPU Selection -->
        <section class="scroll-mt-20" id="gpu-selection">
          <div class="flex items-center mb-4 sm:mb-6">
            <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 text-white rounded-full text-sm font-bold mr-3 sm:mr-4">
              1
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900">Select Your GPU Configuration</h3>
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
          <div class="flex items-center mb-4 sm:mb-6">
            <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-green-600 text-white rounded-full text-sm font-bold mr-3 sm:mr-4">
              2
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900">Choose Your Model</h3>
          </div>
          <ModelSelector 
            v-model:selectedModels="selectedModels"
            @update:selectedModels="handleModelSelectionChange"
          />
        </section>

        <!-- Configuration Results -->
        <section v-if="hasValidConfiguration" class="scroll-mt-20" id="configuration-output">
          <div class="flex items-center mb-4 sm:mb-6">
            <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-green-600 text-white rounded-full text-sm font-bold mr-3 sm:mr-4">
              ✓
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900">Optimized vLLM Configurations</h3>
          </div>
          <ConfigurationOutput 
            :selectedGPUs="selectedGPUs"
            :selectedModels="selectedModels"
          />
        </section>

        <!-- VRAM Visualization -->
        <section v-if="hasValidConfiguration" class="scroll-mt-20" id="vram-analysis">
          <div class="flex items-center mb-4 sm:mb-6">
            <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-purple-600 text-white rounded-full text-sm font-bold mr-3 sm:mr-4">
              📊
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900">Memory Usage Analysis</h3>
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
      <section v-if="hasValidConfiguration" class="mt-12 sm:mt-16">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-8">
          <h4 class="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">Development: Chart.js Integration Test</h4>
          <div class="h-48 sm:h-64">
            <Bar :data="chartData" :options="chartOptions" />
          </div>
          <p class="text-green-600 font-semibold text-center mt-4">✅ Chart.js Integration Ready</p>
        </div>
      </section>
      </ErrorBoundary>
    </main>

    <!-- Debug Information Panel -->
    <section v-if="showDebugInfo" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-16">
      <div class="bg-gray-900 text-white rounded-xl p-4 sm:p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base sm:text-lg font-bold">Debug Information</h3>
          <button
            @click="showDebugInfo = false"
            class="text-gray-400 hover:text-white transition-colors p-1"
            title="Close debug panel"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <!-- State Analysis -->
          <div>
            <h4 class="text-sm font-bold text-blue-400 mb-2">State Analysis</h4>
            <div class="bg-gray-800 p-3 sm:p-4 rounded-lg text-xs sm:text-sm space-y-1 sm:space-y-2">
              <div><span class="text-gray-400">Configuration Step:</span> {{ configurationStep }}</div>
              <div><span class="text-gray-400">Setup Progress:</span> {{ Math.round(setupProgress) }}%</div>
              <div><span class="text-gray-400">Application Ready:</span> {{ applicationReady }}</div>
              <div><span class="text-gray-400">Memory Pressure:</span> 
                <span :class="{
                  'text-green-400': memoryPressure === 'low',
                  'text-yellow-400': memoryPressure === 'moderate',
                  'text-orange-400': memoryPressure === 'high',
                  'text-red-400': memoryPressure === 'critical'
                }">{{ memoryPressure }}</span>
              </div>
              <div><span class="text-gray-400">Configuration Health:</span> 
                <span :class="{
                  'text-green-400': configurationHealth.status === 'healthy',
                  'text-yellow-400': configurationHealth.status === 'warning',
                  'text-red-400': configurationHealth.status === 'critical'
                }">{{ configurationHealth.status }}</span>
              </div>
            </div>
          </div>

          <!-- Hardware Summary -->
          <div>
            <h4 class="text-sm font-bold text-green-400 mb-2">Hardware Summary</h4>
            <div class="bg-gray-800 p-3 sm:p-4 rounded-lg text-xs sm:text-sm space-y-1 sm:space-y-2">
              <div><span class="text-gray-400">Total GPUs:</span> {{ stateAnalysis.gpuCount }}</div>
              <div><span class="text-gray-400">Total VRAM:</span> {{ totalVRAM }}GB</div>
              <div><span class="text-gray-400">Selected Models:</span> {{ stateAnalysis.modelCount }}</div>
              <div><span class="text-gray-400">Total Model Size:</span> {{ totalModelSize }}GB</div>
              <div><span class="text-gray-400">Memory Efficiency:</span> {{ (stateAnalysis.memoryEfficiency * 100).toFixed(1) }}%</div>
              <div><span class="text-gray-400">Estimated Cost:</span> ${{ stateAnalysis.estimatedCost.toFixed(2) }}/hr</div>
            </div>
          </div>

          <!-- VRAM Breakdown -->
          <div v-if="vramBreakdown">
            <h4 class="text-sm font-bold text-purple-400 mb-2">VRAM Breakdown</h4>
            <div class="bg-gray-800 p-3 sm:p-4 rounded-lg text-xs sm:text-sm space-y-1 sm:space-y-2">
              <div><span class="text-gray-400">Model Weights:</span> {{ vramBreakdown.modelWeights.toFixed(1) }}GB</div>
              <div><span class="text-gray-400">KV Cache:</span> {{ vramBreakdown.kvCache.toFixed(1) }}GB</div>
              <div><span class="text-gray-400">Activations:</span> {{ vramBreakdown.activations.toFixed(1) }}GB</div>
              <div><span class="text-gray-400">System Overhead:</span> {{ vramBreakdown.systemOverhead.toFixed(1) }}GB</div>
              <div><span class="text-gray-400">Available:</span> 
                <span :class="vramBreakdown.available > 5 ? 'text-green-400' : vramBreakdown.available > 2 ? 'text-yellow-400' : 'text-red-400'">
                  {{ vramBreakdown.available.toFixed(1) }}GB
                </span>
              </div>
            </div>
          </div>

          <!-- State Errors -->
          <div v-if="stateErrors.length > 0">
            <h4 class="text-sm font-bold text-red-400 mb-2">State Errors</h4>
            <div class="bg-gray-800 p-3 sm:p-4 rounded-lg text-xs sm:text-sm space-y-1">
              <div v-for="error in stateErrors" :key="error.id" class="text-red-300">
                {{ error.message }}
              </div>
            </div>
          </div>

          <!-- Quantization Recommendations -->
          <div v-if="quantizationRecommendations.length > 0" class="md:col-span-2">
            <h4 class="text-sm font-bold text-yellow-400 mb-2">Quantization Recommendations</h4>
            <div class="bg-gray-800 p-4 rounded-lg text-sm space-y-2">
              <div v-for="rec in quantizationRecommendations" :key="rec.modelName" class="border-l-2 border-yellow-400 pl-3">
                <div class="text-white font-medium">{{ rec.modelName }}</div>
                <div class="text-gray-400">{{ rec.currentFormat }} → {{ rec.recommendedFormat }}</div>
                <div class="text-green-400">Memory Savings: {{ rec.memorySavings.toFixed(1) }}GB</div>
                <div class="text-yellow-400">Quality Impact: {{ rec.qualityImpact }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Browser Console Helpers -->
        <div class="mt-6 pt-4 border-t border-gray-700">
          <p class="text-xs text-gray-400 mb-2">
            Browser Console: Access <code class="bg-gray-800 px-1 rounded">window.vllmDebug</code> for calculation functions and state inspection.
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              @click="console.log('vLLM Debug State:', { stateAnalysis, configurationHealth, vramBreakdown, quantizationRecommendations })"
              class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
            >
              Log State
            </button>
            <button
              @click="console.log('Selected GPUs:', selectedGPUs); console.log('Selected Models:', selectedModels);"
              class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium transition-colors"
            >
              Log Selections
            </button>
            <button
              @click="console.log('Configurations:', configurations)"
              class="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-medium transition-colors"
            >
              Log Configs
            </button>
          </div>
        </div>
      </div>
    </section>

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
