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

// GPU selection state
const selectedGPUs = ref([])
// Model selection state
const selectedModels = ref([])

// Computed properties for chart data
const hasConfiguration = computed(
  () => selectedGPUs.value.length > 0 && selectedModels.value.length > 0
)

const totalVRAM = computed(() =>
  selectedGPUs.value.reduce((total, sel) => total + sel.gpu.vram * sel.quantity, 0)
)

const totalModelSize = computed(() =>
  selectedModels.value.reduce((total, model) => total + (model.size || 0), 0)
)

const configurations = computed(() => {
  if (!hasConfiguration.value) return []

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
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="text-5xl font-bold text-gray-900 mb-4">vLLM Configuration Calculator</h1>
        <p class="text-xl text-gray-600 max-w-3xl mx-auto">
          Configure optimal vLLM parameters for your GPU and model setup with intelligent recommendations
        </p>
      </div>

      <!-- GPU Selection Component -->
      <div class="mb-12">
        <GPUSelector 
          v-model:selectedGPUs="selectedGPUs"
          @update:selectedGPUs="selectedGPUs = $event"
        />
      </div>

      <!-- Model Selection Component -->
      <div class="mb-12">
        <ModelSelector 
          v-model:selectedModels="selectedModels"
          @update:selectedModels="selectedModels = $event"
        />
      </div>

      <!-- Configuration Output Component -->
      <div class="mb-12">
        <ConfigurationOutput 
          :selectedGPUs="selectedGPUs"
          :selectedModels="selectedModels"
        />
      </div>

      <!-- VRAM Usage Breakdown Chart -->
      <div class="mb-12" v-if="hasConfiguration">
        <VRAMChart 
          :selectedGPUs="selectedGPUs"
          :selectedModels="selectedModels"
          :configurations="configurations"
          :showBreakdown="true"
          title="VRAM Memory Allocation by Configuration"
        />
      </div>

      <!-- Chart.js Integration Test (keeping for development) -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">GPU VRAM Comparison</h2>
        <div class="h-96">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
        <p class="text-green-600 font-semibold text-center mt-4">✅ Chart.js Integration Ready</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tailwind CSS classes handle the styling */
</style>
