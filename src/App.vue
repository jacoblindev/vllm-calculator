<script setup>
import { ref, onMounted } from 'vue'
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

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// GPU selection state
const selectedGPUs = ref([])
// Model selection state
const selectedModels = ref([])

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
