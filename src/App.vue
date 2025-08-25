<script setup>
import { ref, onMounted, computed } from 'vue'
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

// Application state management
const selectedGPUs = ref([])
const selectedModels = ref([])
const applicationReady = ref(false)

// Application lifecycle
onMounted(() => {
  // Mark application as ready after initial load
  setTimeout(() => {
    applicationReady.value = true
  }, 100)
})

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
          <GPUSelector 
            v-model:selectedGPUs="selectedGPUs"
            @update:selectedGPUs="selectedGPUs = $event"
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
            @update:selectedModels="selectedModels = $event"
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
