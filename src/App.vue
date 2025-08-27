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
import TheHeader from './components/layout/TheHeader.vue'

// Import Pinia stores
import { useGpuStore } from './stores/gpuStore.js'
import { useModelStore } from './stores/modelStore.js'
import { useConfigStore } from './stores/configStore.js'
import { useUiStore } from './stores/uiStore.js'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Initialize stores
const gpuStore = useGpuStore()
const modelStore = useModelStore()
const configStore = useConfigStore()
const uiStore = useUiStore()

// Enhanced state management with persistence and validation
// All state is now managed through Pinia stores

// Reactive references to store getters for template use
const selectedGPUs = computed(() => gpuStore.selectedGPUs)
const selectedModels = computed(() => modelStore.selectedModels)
const applicationReady = computed(() => uiStore.applicationReady)
const lastSavedState = computed(() => uiStore.lastSavedState)
const stateErrors = computed(() => uiStore.stateErrors)
const isStateRestoring = computed(() => uiStore.isStateRestoring)

// UI state from store (for debugging and display)
const showDebugInfo = computed(() => uiStore.showDebugInfo)

// Configuration calculations from config store
const hasValidConfiguration = computed(() => configStore.hasValidConfiguration)
const totalVRAM = computed(() => gpuStore.totalVRAM)
const totalModelSize = computed(() => modelStore.totalModelSize)
const configurationStep = computed(() => configStore.configurationStep)
const setupProgress = computed(() => configStore.setupProgress)
const configurationHealth = computed(() => configStore.configurationHealth)
const memoryPressure = computed(() => configStore.memoryPressure)
const vramBreakdown = computed(() => configStore.vramBreakdown)
const stateAnalysis = computed(() => configStore.stateAnalysis)
const quantizationRecommendations = computed(() => configStore.quantizationRecommendations)

// State management functions - now delegated to stores
const loadStateFromStorage = () => {
  try {
    uiStore.setStateRestoring(true)
    // Pinia stores automatically load their state with the persist plugin
    // No explicit loading needed as it happens on store initialization
  } catch (error) {
    console.warn('Failed to load state from localStorage:', error)
    uiStore.addStateError('Failed to restore previous configuration.')
  } finally {
    uiStore.setStateRestoring(false)
  }
}

// Enhanced application lifecycle with state management
onMounted(() => {
  // Load saved state first
  loadStateFromStorage()
  
  // Mark application as ready after initial load
  setTimeout(() => {
    uiStore.setApplicationReady(true)
  }, 100)
})

// Pinia stores now handle state persistence automatically

// Window beforeunload handler for cleanup
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Auto-save handled by Pinia persistence plugin
  })
}

// Development utilities (exposed to window for debugging)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.vllmDebug = {
    stateAnalysis,
    memoryPressure,
    vramBreakdown,
    quantizationRecommendations,
    // Store access for debugging
    gpuStore,
    modelStore,
    configStore,
    uiStore
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
    <TheHeader />

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
                @click="uiStore.removeStateError(error.id)"
                class="ml-4 text-red-400 hover:text-red-600 focus:outline-none"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <GPUSelector />
        </section>

        <!-- Step 2: Model Selection -->
        <section class="scroll-mt-20" id="model-selection">
          <div class="flex items-center mb-4 sm:mb-6">
            <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-green-600 text-white rounded-full text-sm font-bold mr-3 sm:mr-4">
              2
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900">Choose Your Model</h3>
          </div>
          <ModelSelector />
        </section>

        <!-- Configuration Results -->
        <section v-if="hasValidConfiguration" class="scroll-mt-20" id="configuration-output">
          <div class="flex items-center mb-4 sm:mb-6">
            <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-green-600 text-white rounded-full text-sm font-bold mr-3 sm:mr-4">
              ✓
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900">Optimized vLLM Configurations</h3>
          </div>
          <ConfigurationOutput />
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
            :show-breakdown="true"
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
            @click="uiStore.toggleDebugInfo()"
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
              @click="console.log('Configurations:', configStore.configurations)"
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
