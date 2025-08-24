<template>
  <div class="w-full h-full">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
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

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Props for dynamic data
const props = defineProps({
  title: {
    type: String,
    default: 'VRAM Usage Chart',
  },
  data: {
    type: Object,
    default: () => ({
      labels: ['Sample GPU'],
      datasets: [
        {
          label: 'VRAM (GB)',
          backgroundColor: '#3B82F6',
          data: [24],
        },
      ],
    }),
  },
})

// Computed chart data
const chartData = computed(() => props.data)

// Chart options
const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: props.title,
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
