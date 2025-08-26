<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
    <!-- Chart Header Section -->
    <div class="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-100">
      <div class="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
        <div class="flex-1">
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{{ title || 'VRAM Usage Breakdown' }}</h2>
          <p class="text-sm sm:text-base text-gray-600">
            Memory allocation across different components for each optimization strategy
          </p>
        </div>
        <!-- VRAM Summary Info -->
        <div 
          v-if="getTotalVRAM() > 0"
          class="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 text-sm w-full lg:w-auto lg:min-w-[200px]"
        >
          <div class="font-semibold text-gray-900 mb-2 flex items-center">
            <svg class="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
            GPU Configuration
          </div>
          <div class="space-y-1 text-gray-700">
            <div class="flex justify-between">
              <span class="text-gray-600">Total VRAM:</span>
              <span class="font-semibold">{{ getTotalVRAM() }} GB</span>
            </div>
            <div v-if="selectedGPUs.length === 1" class="text-xs text-gray-500">
              {{ selectedGPUs[0].quantity }}x {{ selectedGPUs[0].gpu.name }}
            </div>
            <div v-else-if="selectedGPUs.length > 1" class="text-xs text-gray-500">
              {{ selectedGPUs.length }} GPU types selected
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart Content Area -->
    <div class="relative p-4 sm:p-8">
      <!-- Error State -->
      <div 
        v-if="chartError" 
        class="absolute inset-0 bg-white bg-opacity-95 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg"
      >
        <div class="bg-white rounded-lg shadow-lg border border-red-200 p-6 text-center max-w-md">
          <div class="text-red-600 mb-4">
            <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.98-.833-2.75 0L3.064 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p class="text-red-600 mb-4 font-medium">{{ chartError }}</p>
          <button
            @click="refreshChart"
            class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
          >
            Refresh Chart
          </button>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div 
        v-else-if="isUpdating" 
        class="absolute inset-0 bg-white bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg"
      >
        <div class="bg-white rounded-lg shadow-lg border border-gray-200 p-6 flex items-center space-x-3">
          <div class="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-blue-600"></div>
          <span class="text-gray-700 font-medium">Updating chart...</span>
        </div>
      </div>
      
      <!-- Chart Container -->
      <div 
        class="transition-all duration-300 min-h-[400px]" 
        :class="{ 'opacity-70 scale-[0.98]': isUpdating }"
      >
        <Bar :data="chartData" :options="chartOptions" :key="updateKey" />
      </div>
      
      <!-- Chart Footer Info -->
      <div class="mt-6 pt-4 border-t border-gray-100">
        <div class="flex justify-between items-center text-sm">
          <div class="text-gray-500">
            <span class="inline-flex items-center">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              Hover over bars for detailed breakdown
            </span>
          </div>
          <div 
            v-if="lastUpdateTime && !isUpdating" 
            class="text-gray-400 text-xs"
          >
            Last updated: {{ new Date(lastUpdateTime).toLocaleTimeString() }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch, ref, nextTick } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import { Bar } from 'vue-chartjs'
import { calculateVRAMBreakdown } from '../lib/memory/vramBreakdown.js'
import { useLoadingWithRetry } from '../composables/useLoadingState.js'

// Register Chart.js components and plugins
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, annotationPlugin)

// Props for dynamic data
const props = defineProps({
  title: {
    type: String,
    default: 'VRAM Usage Breakdown',
  },
  selectedGPUs: {
    type: Array,
    default: () => [],
  },
  selectedModels: {
    type: Array,
    default: () => [],
  },
  configurations: {
    type: Array,
    default: () => [],
  },
  showBreakdown: {
    type: Boolean,
    default: true,
  },
  data: {
    type: Object,
    default: null,
  },
})

// Reactive state for dynamic updates
const isUpdating = ref(false)
const updateKey = ref(0)
const lastUpdateTime = ref(Date.now())
const chartError = ref('')

// Loading state management
const { executeWithRetry } = useLoadingWithRetry()

// Methods
const refreshChart = async () => {
  chartError.value = ''
  isUpdating.value = true
  
  await executeWithRetry(async () => {
    updateKey.value++
    lastUpdateTime.value = Date.now()
    await nextTick()
  }, {
    onError: (error) => {
      chartError.value = 'Failed to update chart. Please check your data and try again.'
      console.error('Chart refresh error:', error)
    },
    onFinally: () => {
      isUpdating.value = false
    }
  })
}

// Helper function to get total VRAM from selected GPUs
const getTotalVRAM = () => {
  if (!props.selectedGPUs.length) return 0
  return props.selectedGPUs.reduce((total, sel) => total + sel.gpu.vram * sel.quantity, 0)
}

// Memory component colors aligned with application design system
const memoryColors = {
  modelWeights: '#3B82F6',    // Blue-500 - Primary blue from app
  kvCache: '#1D4ED8',         // Blue-700 - Darker blue
  activations: '#10B981',     // Green-500 - Success color
  systemOverhead: '#F59E0B',  // Amber-500 - Warning color
  fragmentation: '#8B5CF6',   // Purple-500 - Accent color
  swap: '#EC4899',           // Pink-500 - Secondary accent
  reserved: '#6B7280',       // Gray-500 - Neutral color
}

// Generate VRAM breakdown data for configurations
const generateVRAMBreakdownData = () => {
  if (!props.selectedGPUs.length || !props.selectedModels.length || !props.configurations.length) {
    return {
      labels: ['No Configuration'],
      datasets: [{
        label: 'No Data',
        data: [0],
        backgroundColor: '#E5E7EB',
      }],
    }
  }

  const labels = props.configurations.map(config => config.title || config.type)
  const datasets = []

  // Calculate total VRAM from selected GPUs
  const totalVRAM = props.selectedGPUs.reduce((total, sel) => total + sel.gpu.vram * sel.quantity, 0)
  
  // Use the first model for breakdown calculation (can be enhanced for multi-model)
  const primaryModel = props.selectedModels[0]
  
  if (!primaryModel) {
    return {
      labels: ['No Model'],
      datasets: [{
        label: 'No Model Selected',
        data: [0],
        backgroundColor: '#E5E7EB',
      }],
    }
  }

  // Calculate breakdown for each configuration
  const breakdowns = props.configurations.map(config => {
    try {
      // Extract parameters from configuration
      const seqLenParam = config.parameters?.find(p => p.name === '--max-model-len')
      const maxSeqsParam = config.parameters?.find(p => p.name === '--max-num-seqs')
      const swapParam = config.parameters?.find(p => p.name === '--swap-space')
      
      const batchSize = maxSeqsParam ? parseInt(maxSeqsParam.value) : 32
      const maxSeqLen = seqLenParam ? parseInt(seqLenParam.value) : 2048
      const swapSpaceGB = swapParam ? parseInt(swapParam.value) : 4

      return calculateVRAMBreakdown({
        totalVRAMGB: totalVRAM,
        modelSizeGB: primaryModel.size,
        quantization: primaryModel.quantization || 'fp16',
        batchSize: batchSize,
        maxSeqLen: maxSeqLen,
        seqLen: Math.min(maxSeqLen, 512),
        kvCachePrecision: 'fp16',
        swapSpaceGB: swapSpaceGB,
        optimizationStrategy: { priority: config.type },
      })
    } catch (error) {
      console.warn('Error calculating VRAM breakdown:', error)
      // Return fallback data
      return {
        breakdown: {
          modelWeights: { sizeGB: primaryModel.size * 0.8, percentage: 40 },
          kvCache: { sizeGB: totalVRAM * 0.3, percentage: 30 },
          activations: { sizeGB: totalVRAM * 0.1, percentage: 10 },
          systemOverhead: { sizeGB: totalVRAM * 0.05, percentage: 5 },
          fragmentation: { sizeGB: totalVRAM * 0.03, percentage: 3 },
          swap: { sizeGB: 4, percentage: 8 },
          reserved: { sizeGB: totalVRAM * 0.04, percentage: 4 },
        }
      }
    }
  })

  // Create datasets for each memory component
  const componentNames = ['modelWeights', 'kvCache', 'activations', 'systemOverhead', 'fragmentation', 'swap', 'reserved']
  const componentLabels = {
    modelWeights: 'Model Weights',
    kvCache: 'KV Cache',
    activations: 'Activations',
    systemOverhead: 'System Overhead',
    fragmentation: 'Fragmentation',
    swap: 'Swap Space',
    reserved: 'Reserved/Buffer',
  }

  componentNames.forEach(component => {
    const data = breakdowns.map(breakdown => breakdown.breakdown[component]?.sizeGB || 0)
    
    datasets.push({
      label: componentLabels[component],
      data: data,
      backgroundColor: memoryColors[component],
      borderColor: memoryColors[component],
      borderWidth: 1,
    })
  })

  return {
    labels,
    datasets,
  }
}

// Throttled update function to prevent excessive recalculations
const throttledUpdate = async () => {
  const now = Date.now()
  if (now - lastUpdateTime.value < 100) { // Throttle updates to max 10/second
    return
  }
  
  chartError.value = ''
  isUpdating.value = true
  
  try {
    await nextTick()
    lastUpdateTime.value = now
    updateKey.value++
  } catch (error) {
    chartError.value = 'Failed to update chart visualization'
    console.error('Chart update error:', error)
  } finally {
    isUpdating.value = false
  }
}

// Watch for changes in props that should trigger chart updates
watch(
  [() => props.selectedGPUs, () => props.selectedModels, () => props.configurations],
  () => {
    throttledUpdate()
  },
  { deep: true, immediate: false }
)

// Watch for showBreakdown changes
watch(
  () => props.showBreakdown,
  () => {
    throttledUpdate()
  }
)

// Computed chart data
const chartData = computed(() => {
  if (props.showBreakdown) {
    return generateVRAMBreakdownData()
  }
  
  // Fallback to props.data for backward compatibility  
  if (props.data) {
    return props.data
  }
  
  // Default fallback
  return {
    labels: ['Sample GPU'],
    datasets: [{
      label: 'VRAM (GB)',
      backgroundColor: '#3B82F6',
      data: [24],
    }],
  }
})

// Chart options optimized for stacked bar charts with dynamic updates
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: isUpdating.value ? 300 : 800, // Faster updates during dynamic changes
    easing: 'easeInOutQuart',
    animateScale: true,
    animateRotate: true,
  },
  transitions: {
    active: {
      animation: {
        duration: 200,
      },
    },
    resize: {
      animation: {
        duration: 300,
      },
    },
  },
  plugins: {
    title: {
      display: false, // Title now handled in template header
    },
    annotation: {
      annotations: (() => {
        const totalVRAM = getTotalVRAM()
        if (totalVRAM <= 0) return {}
        
        return {
          totalVRAMLine: {
            type: 'line',
            yMin: totalVRAM,
            yMax: totalVRAM,
            borderColor: '#DC2626',
            borderWidth: 2,
            borderDash: [8, 4],
            label: {
              display: true,
              content: `VRAM Capacity: ${totalVRAM} GB`,
              position: 'end',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: '#DC2626',
              padding: 8,
              font: {
                size: 11,
                weight: 'bold',
                family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              },
              borderColor: '#DC2626',
              borderWidth: 1,
              cornerRadius: 6,
            },
          },
        }
      })(),
    },
    legend: {
      display: true,
      position: 'bottom',
      align: 'center',
      labels: {
        usePointStyle: true,
        pointStyle: 'rect',
        padding: 20,
        font: {
          size: 12,
          family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          weight: '500',
        },
        color: '#374151', // Gray-700
        generateLabels: function(chart) {
          const datasets = chart.data.datasets
          return datasets.map((dataset, index) => ({
            text: dataset.label,
            fillStyle: dataset.backgroundColor,
            strokeStyle: dataset.borderColor || dataset.backgroundColor,
            lineWidth: 0,
            pointStyle: 'rect',
            hidden: !chart.isDatasetVisible(index),
            datasetIndex: index
          }))
        },
      },
      title: {
        display: true,
        text: 'VRAM Components',
        font: {
          size: 14,
          weight: '600',
          family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        },
        color: '#1F2937', // Gray-800
        padding: {
          top: 0,
          bottom: 12,
        },
      },
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      titleColor: '#1F2937',
      bodyColor: '#374151',
      borderColor: '#D1D5DB',
      borderWidth: 1,
      cornerRadius: 8,
      displayColors: true,
      animation: {
        duration: 200,
      },
      titleFont: {
        size: 14,
        weight: '600',
        family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      },
      bodyFont: {
        size: 13,
        family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      },
      footerFont: {
        size: 12,
        weight: '600',
        family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      },
      padding: 12,
      titleSpacing: 8,
      bodySpacing: 6,
      footerSpacing: 8,
      callbacks: {
        title: function(tooltipItems) {
          if (!tooltipItems.length) return ''
          return `Configuration: ${tooltipItems[0].label}`
        },
        label: function(context) {
          const label = context.dataset.label || ''
          const value = context.parsed.y || 0
          const percentage = ((value / getTotalVRAM()) * 100).toFixed(1)
          return `${label}: ${value.toFixed(2)} GB (${percentage}%)`
        },
        footer: function(tooltipItems) {
          if (!tooltipItems.length) return ''
          
          const total = tooltipItems.reduce((sum, item) => sum + (item.parsed.y || 0), 0)
          const totalVRAM = getTotalVRAM()
          const usage = ((total / totalVRAM) * 100).toFixed(1)
          
          return [
            `Total Used: ${total.toFixed(2)} GB`,
            `Available: ${(totalVRAM - total).toFixed(2)} GB`,
            `Utilization: ${usage}%`
          ]
        },
        beforeTitle: function(_tooltipItems) {
          if (isUpdating.value) {
            return 'Updating...'
          }
          return ''
        },
        afterBody: function(tooltipItems) {
          if (!tooltipItems.length) return ''
          
          const context = tooltipItems[0]
          const label = context.dataset.label
          
          const descriptions = {
            'Model Weights': 'Memory required to store neural network parameters',
            'KV Cache': 'Memory for key-value pairs during inference',
            'Activations': 'Memory for intermediate computations',
            'System Overhead': 'Memory used by vLLM system and CUDA runtime',
            'Fragmentation': 'Memory lost due to allocation fragmentation',
            'Swap Space': 'Reserved memory for swapping tensors to CPU',
            'Reserved/Buffer': 'Additional memory buffer for safety margin'
          }
          
          const description = descriptions[label]
          return description ? [``, `💡 ${description}`] : []
        },
      },
    },
  },
  scales: {
    x: {
      stacked: props.showBreakdown,
      title: {
        display: true,
        text: 'vLLM Configuration Presets',
        font: {
          size: 14,
          weight: '600',
          family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        },
        color: '#1F2937', // Gray-800
        padding: {
          top: 16,
        },
      },
      ticks: {
        font: {
          size: 12,
          family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        },
        color: '#374151', // Gray-700
        maxRotation: 0,
        callback: function(value, _index) {
          const label = this.getLabelForValue(value)
          return label.length > 15 ? label.substring(0, 15) + '...' : label
        },
      },
      grid: {
        display: false,
      },
      border: {
        color: '#E5E7EB', // Gray-200
      },
    },
    y: {
      stacked: props.showBreakdown,
      beginAtZero: true,
      title: {
        display: true,
        text: 'VRAM Usage (GB)',
        font: {
          size: 14,
          weight: '600',
          family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        },
        color: '#1F2937', // Gray-800
        padding: {
          bottom: 16,
        },
      },
      ticks: {
        font: {
          size: 12,
          family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        },
        color: '#374151', // Gray-700
        callback: function(value) {
          const totalVRAM = getTotalVRAM()
          if (totalVRAM > 0) {
            const percentage = ((value / totalVRAM) * 100).toFixed(0)
            return `${value.toFixed(1)} GB (${percentage}%)`
          }
          return `${value.toFixed(1)} GB`
        },
      },
      grid: {
        color: 'rgba(156, 163, 175, 0.2)', // Gray-400 with opacity
        borderDash: [2, 2],
      },
      border: {
        color: '#E5E7EB', // Gray-200
      },
      // Add reference line for total VRAM capacity
      afterDataLimits: function(scale) {
        const totalVRAM = getTotalVRAM()
        if (totalVRAM > 0 && scale.max < totalVRAM) {
          scale.max = Math.ceil(totalVRAM * 1.1) // Add 10% padding above total VRAM
        }
      },
    },
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false,
  },
  elements: {
    bar: {
      borderWidth: 0, // Remove borders for cleaner look
      borderRadius: 4, // Slightly more rounded corners
      borderSkipped: false,
    },
  },
  layout: {
    padding: {
      top: 20,
      bottom: 20,
      left: 10,
      right: 10,
    },
  },
  // Update key to force re-render when needed
  key: updateKey.value,
}))
</script>
