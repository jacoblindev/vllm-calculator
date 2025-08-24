<script setup>
import { ref, onMounted } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'
import { Bar } from 'vue-chartjs'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Chart data and options
const chartData = ref({
  labels: ['Tesla A100', 'RTX 4090', 'H100', 'V100'],
  datasets: [
    {
      label: 'VRAM (GB)',
      backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'],
      data: [80, 24, 80, 32]
    }
  ]
})

const chartOptions = ref({
  responsive: true,
  plugins: {
    title: {
      display: true,
      text: 'GPU VRAM Comparison'
    },
    legend: {
      display: true
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'VRAM (GB)'
      }
    }
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">vLLM Configuration Calculator</h1>
      <p class="text-xl text-gray-600">Configure optimal vLLM parameters for your GPU and model setup</p>
    </div>
    
    <div class="bg-white p-8 rounded-lg shadow-lg mb-8 max-w-md">
      <p class="text-green-600 font-semibold">✅ Tailwind CSS is working!</p>
      <p class="text-gray-700 mt-2">This confirms the styling setup is successful.</p>
    </div>

    <div class="bg-white p-8 rounded-lg shadow-lg w-full max-w-4xl">
      <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">Chart.js Integration Test</h2>
      <div class="h-96">
        <Bar
          :data="chartData"
          :options="chartOptions"
        />
      </div>
      <p class="text-green-600 font-semibold text-center mt-4">✅ Chart.js is working!</p>
    </div>
  </div>
</template>

<style scoped>
/* Tailwind CSS classes handle the styling */
</style>
