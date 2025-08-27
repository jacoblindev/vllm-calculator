<script setup>
// ConfigurationSummary component for the vLLM Configuration Calculator
// Displays configuration overview, progress status, and summary charts

// Import Chart.js components
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
import { ref, computed } from 'vue'

// Import Pinia stores
import { useGpuStore } from '../stores/gpuStore.js'
import { useModelStore } from '../stores/modelStore.js'
import { useConfigStore } from '../stores/configStore.js'
import { useUiStore } from '../stores/uiStore.js'

// Development mode check
const isDevelopment = import.meta.env.DEV

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Initialize stores
const gpuStore = useGpuStore()
const modelStore = useModelStore()
const configStore = useConfigStore()
const uiStore = useUiStore()

// Reactive references to store getters
const selectedGPUs = computed(() => gpuStore.selectedGPUs)
const selectedModels = computed(() => modelStore.selectedModels)
const totalVRAM = computed(() => gpuStore.totalVRAM)
const totalModelSize = computed(() => modelStore.totalModelSize)
const hasValidConfiguration = computed(() => configStore.hasValidConfiguration)
const configurationStep = computed(() => configStore.configurationStep)
const setupProgress = computed(() => configStore.setupProgress)
const configurationHealth = computed(() => configStore.configurationHealth)
const memoryPressure = computed(() => configStore.memoryPressure)
const vramBreakdown = computed(() => configStore.vramBreakdown)
const stateAnalysis = computed(() => configStore.stateAnalysis)
const applicationReady = computed(() => uiStore.applicationReady)

// Chart data for demonstration and development testing
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

// Configuration summary stats
const configurationSummary = computed(() => {
  if (!hasValidConfiguration.value) return null
  
  return {
    totalGPUs: stateAnalysis.value.gpuCount,
    totalVRAM: totalVRAM.value,
    totalModels: stateAnalysis.value.modelCount,
    totalModelSize: totalModelSize.value,
    memoryEfficiency: stateAnalysis.value.memoryEfficiency,
    estimatedCost: stateAnalysis.value.estimatedCost,
    configurationHealth: configurationHealth.value,
    memoryPressure: memoryPressure.value
  }
})
</script>

<template>
  <!-- Configuration Summary Dashboard -->
  <div v-if="applicationReady && hasValidConfiguration" class="space-y-6 sm:space-y-8">
    
    <!-- Configuration Overview Card -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div class="flex items-center justify-between mb-4 sm:mb-6">
        <h3 class="text-lg sm:text-xl font-bold text-gray-900">Configuration Overview</h3>
        <div class="flex items-center space-x-2">
          <div :class="[
            'w-3 h-3 rounded-full',
            configurationHealth.status === 'healthy' ? 'bg-green-500' :
            configurationHealth.status === 'warning' ? 'bg-yellow-500' :
            'bg-red-500'
          ]"></div>
          <span class="text-sm font-medium text-gray-700 capitalize">{{ configurationHealth.status }}</span>
        </div>
      </div>
      
      <!-- Configuration Progress Bar -->
      <div class="mb-6">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-gray-700">Setup Progress</span>
          <span class="text-sm text-gray-500">{{ Math.round(setupProgress) }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div 
            class="progress-bar bg-blue-600 h-2 rounded-full"
            :style="`width: ${setupProgress}%`"
          ></div>
        </div>
        <div class="text-xs text-gray-500 mt-1">Step {{ configurationStep }} of 3 completed</div>
      </div>
      
      <!-- Summary Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div class="text-xl sm:text-2xl font-bold text-blue-600">{{ configurationSummary.totalGPUs }}</div>
          <div class="text-xs sm:text-sm text-blue-700">GPUs</div>
        </div>
        <div class="text-center p-3 bg-green-50 rounded-lg border border-green-200">
          <div class="text-xl sm:text-2xl font-bold text-green-600">{{ configurationSummary.totalVRAM }}GB</div>
          <div class="text-xs sm:text-sm text-green-700">Total VRAM</div>
        </div>
        <div class="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div class="text-xl sm:text-2xl font-bold text-purple-600">{{ configurationSummary.totalModels }}</div>
          <div class="text-xs sm:text-sm text-purple-700">Models</div>
        </div>
        <div class="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div :class="[
            'text-xl sm:text-2xl font-bold',
            memoryPressure === 'low' ? 'text-green-600' :
            memoryPressure === 'moderate' ? 'text-yellow-600' :
            memoryPressure === 'high' ? 'text-orange-600' : 'text-red-600'
          ]">
            {{ Math.round(configurationSummary.memoryEfficiency * 100) }}%
          </div>
          <div class="text-xs sm:text-sm text-yellow-700">Memory Efficiency</div>
        </div>
      </div>
      
      <!-- Memory Pressure Alert -->
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
          <div>
            <span class="font-medium" :class="{
              'text-yellow-800': memoryPressure === 'moderate',
              'text-orange-800': memoryPressure === 'high',
              'text-red-800': memoryPressure === 'critical'
            }">
              {{ memoryPressure === 'moderate' ? 'Moderate' : 
                 memoryPressure === 'high' ? 'High' : 'Critical' }} Memory Pressure Detected
            </span>
            <div class="text-sm mt-1" :class="{
              'text-yellow-700': memoryPressure === 'moderate',
              'text-orange-700': memoryPressure === 'high',
              'text-red-700': memoryPressure === 'critical'
            }">
              Consider optimizing your configuration or using quantization to reduce memory usage.
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- VRAM Allocation Summary -->
    <div v-if="vramBreakdown" class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <h3 class="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Memory Allocation Summary</h3>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div class="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
          <div class="text-sm font-medium text-blue-900 mb-1">Model Weights</div>
          <div class="text-lg sm:text-xl font-bold text-blue-700">{{ vramBreakdown.modelWeights.toFixed(1) }}GB</div>
          <div class="text-xs text-blue-600">{{ ((vramBreakdown.modelWeights / totalVRAM) * 100).toFixed(1) }}% of total</div>
        </div>
        <div class="bg-green-50 p-3 sm:p-4 rounded-lg border border-green-200">
          <div class="text-sm font-medium text-green-900 mb-1">KV Cache</div>
          <div class="text-lg sm:text-xl font-bold text-green-700">{{ vramBreakdown.kvCache.toFixed(1) }}GB</div>
          <div class="text-xs text-green-600">{{ ((vramBreakdown.kvCache / totalVRAM) * 100).toFixed(1) }}% of total</div>
        </div>
        <div class="bg-yellow-50 p-3 sm:p-4 rounded-lg border border-yellow-200">
          <div class="text-sm font-medium text-yellow-900 mb-1">Activations</div>
          <div class="text-lg sm:text-xl font-bold text-yellow-700">{{ vramBreakdown.activations.toFixed(1) }}GB</div>
          <div class="text-xs text-yellow-600">{{ ((vramBreakdown.activations / totalVRAM) * 100).toFixed(1) }}% of total</div>
        </div>
        <div class="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200">
          <div class="text-sm font-medium text-red-900 mb-1">System Overhead</div>
          <div class="text-lg sm:text-xl font-bold text-red-700">{{ vramBreakdown.systemOverhead.toFixed(1) }}GB</div>
          <div class="text-xs text-red-600">{{ ((vramBreakdown.systemOverhead / totalVRAM) * 100).toFixed(1) }}% of total</div>
        </div>
        <div class="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
          <div class="text-sm font-medium text-gray-900 mb-1">Available</div>
          <div :class="[
            'text-lg sm:text-xl font-bold',
            vramBreakdown.available > 5 ? 'text-green-700' : 
            vramBreakdown.available > 2 ? 'text-yellow-700' : 'text-red-700'
          ]">{{ vramBreakdown.available.toFixed(1) }}GB</div>
          <div class="text-xs text-gray-600">{{ ((vramBreakdown.available / totalVRAM) * 100).toFixed(1) }}% free</div>
        </div>
      </div>
      
      <!-- Visual Memory Bar -->
      <div class="mt-6">
        <div class="text-sm font-medium text-gray-700 mb-2">Memory Distribution</div>
        <div class="flex h-6 rounded-lg overflow-hidden border border-gray-200">
          <div 
            class="progress-bar bg-blue-500" 
            :style="`width: ${(vramBreakdown.modelWeights / totalVRAM) * 100}%`"
            :title="`Model Weights: ${vramBreakdown.modelWeights.toFixed(1)}GB`"
          ></div>
          <div 
            class="progress-bar bg-green-500" 
            :style="`width: ${(vramBreakdown.kvCache / totalVRAM) * 100}%`"
            :title="`KV Cache: ${vramBreakdown.kvCache.toFixed(1)}GB`"
          ></div>
          <div 
            class="progress-bar bg-yellow-500" 
            :style="`width: ${(vramBreakdown.activations / totalVRAM) * 100}%`"
            :title="`Activations: ${vramBreakdown.activations.toFixed(1)}GB`"
          ></div>
          <div 
            class="progress-bar bg-red-500" 
            :style="`width: ${(vramBreakdown.systemOverhead / totalVRAM) * 100}%`"
            :title="`System Overhead: ${vramBreakdown.systemOverhead.toFixed(1)}GB`"
          ></div>
          <div 
            class="progress-bar bg-gray-300" 
            :style="`width: ${(vramBreakdown.available / totalVRAM) * 100}%`"
            :title="`Available: ${vramBreakdown.available.toFixed(1)}GB`"
          ></div>
        </div>
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>0GB</span>
          <span>{{ totalVRAM }}GB Total</span>
        </div>
      </div>
    </div>
    
    <!-- Configuration Health Summary -->
    <div v-if="configurationHealth.issues.length > 0" class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <h3 class="text-lg sm:text-xl font-bold text-gray-900 mb-4">Configuration Health Report</h3>
      
      <div class="space-y-3">
        <div 
          v-for="issue in configurationHealth.issues" 
          :key="issue.type"
          class="flex items-start p-3 rounded-lg" 
          :class="{
            'bg-yellow-50 border border-yellow-200': issue.severity === 'warning',
            'bg-red-50 border border-red-200': issue.severity === 'critical',
            'bg-blue-50 border border-blue-200': issue.severity === 'info'
          }"
        >
          <svg class="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" :class="{
            'text-yellow-600': issue.severity === 'warning',
            'text-red-600': issue.severity === 'critical',
            'text-blue-600': issue.severity === 'info'
          }" fill="currentColor" viewBox="0 0 20 20">
            <path v-if="issue.severity === 'warning'" fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            <path v-else-if="issue.severity === 'critical'" fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            <path v-else fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
          </svg>
          <div class="flex-1">
            <div class="font-medium" :class="{
              'text-yellow-800': issue.severity === 'warning',
              'text-red-800': issue.severity === 'critical',
              'text-blue-800': issue.severity === 'info'
            }">{{ issue.title }}</div>
            <div class="text-sm mt-1" :class="{
              'text-yellow-700': issue.severity === 'warning',
              'text-red-700': issue.severity === 'critical',
              'text-blue-700': issue.severity === 'info'
            }">{{ issue.description }}</div>
            <div v-if="issue.recommendation" class="text-xs mt-2 font-medium" :class="{
              'text-yellow-600': issue.severity === 'warning',
              'text-red-600': issue.severity === 'critical',
              'text-blue-600': issue.severity === 'info'
            }">
              Recommendation: {{ issue.recommendation }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tailwind CSS classes handle the styling */
</style>
