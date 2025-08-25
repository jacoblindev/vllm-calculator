<template>
  <div class="w-full h-full relative">
    <!-- Loading Overlay -->
    <div 
      v-if="isUpdating" 
      class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg"
    >
      <div class="flex items-center space-x-2 text-blue-600">
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm font-medium">Updating chart...</span>
      </div>
    </div>
    
    <!-- Chart Container -->
    <div class="transition-opacity duration-200" :class="{ 'opacity-70': isUpdating }">
      <Bar :data="chartData" :options="chartOptions" :key="updateKey" />
    </div>
    
    <!-- Update Indicator -->
    <div 
      v-if="lastUpdateTime && !isUpdating" 
      class="absolute bottom-2 right-2 text-xs text-gray-500 bg-white bg-opacity-90 px-2 py-1 rounded"
    >
      Last updated: {{ new Date(lastUpdateTime).toLocaleTimeString() }}
    </div>
    
    <!-- VRAM Summary Info -->
    <div 
      v-if="getTotalVRAM() > 0 && !isUpdating"
      class="absolute top-2 right-2 bg-white bg-opacity-95 border border-gray-200 rounded-lg p-3 text-xs shadow-sm"
    >
      <div class="font-semibold text-gray-700 mb-1">GPU Configuration</div>
      <div class="text-gray-600">
        <div>Total VRAM: {{ getTotalVRAM() }} GB</div>
        <div v-if="selectedGPUs.length === 1">
          {{ selectedGPUs[0].quantity }}x {{ selectedGPUs[0].gpu.name }}
        </div>
        <div v-else-if="selectedGPUs.length > 1">
          {{ selectedGPUs.length }} GPU types selected
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
import { calculateVRAMBreakdown } from '../lib/calculationEngine.js'

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

// Helper function to get total VRAM from selected GPUs
const getTotalVRAM = () => {
  if (!props.selectedGPUs.length) return 0
  return props.selectedGPUs.reduce((total, sel) => total + sel.gpu.vram * sel.quantity, 0)
}

// Memory component colors for visual distinction
const memoryColors = {
  modelWeights: '#EF4444', // Red - Model weights
  kvCache: '#3B82F6',      // Blue - KV cache
  activations: '#10B981',   // Green - Activations
  systemOverhead: '#F59E0B', // Amber - System overhead
  fragmentation: '#8B5CF6', // Purple - Fragmentation
  swap: '#EC4899',         // Pink - Swap space
  reserved: '#6B7280',     // Gray - Reserved/Buffer
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
const throttledUpdate = () => {
  const now = Date.now()
  if (now - lastUpdateTime.value < 100) { // Throttle updates to max 10/second
    return
  }
  
  isUpdating.value = true
  lastUpdateTime.value = now
  updateKey.value++
  
  nextTick(() => {
    isUpdating.value = false
  })
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
      display: true,
      text: props.title,
      font: {
        size: 16,
        weight: 'bold',
      },
      padding: {
        bottom: 20,
      },
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
            borderDash: [5, 5],
            label: {
              display: true,
              content: `Total VRAM Capacity: ${totalVRAM} GB`,
              position: 'end',
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              color: '#DC2626',
              padding: 6,
              font: {
                size: 11,
                weight: 'bold',
                family: 'Inter, sans-serif',
              },
              borderColor: '#DC2626',
              borderWidth: 1,
              cornerRadius: 4,
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
          family: 'Inter, sans-serif',
        },
        color: '#374151',
        generateLabels: function(chart) {
          const datasets = chart.data.datasets
          return datasets.map((dataset, index) => ({
            text: dataset.label,
            fillStyle: dataset.backgroundColor,
            strokeStyle: dataset.borderColor,
            lineWidth: dataset.borderWidth,
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
          weight: 'bold',
          family: 'Inter, sans-serif',
        },
        color: '#1F2937',
        padding: {
          top: 0,
          bottom: 10,
        },
      },
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#1F2937',
      bodyColor: '#374151',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      cornerRadius: 8,
      displayColors: true,
      animation: {
        duration: 200,
      },
      titleFont: {
        size: 14,
        weight: 'bold',
        family: 'Inter, sans-serif',
      },
      bodyFont: {
        size: 12,
        family: 'Inter, sans-serif',
      },
      footerFont: {
        size: 12,
        weight: 'bold',
        family: 'Inter, sans-serif',
      },
      padding: 12,
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
          
          // Add helpful context about the memory component
          const context = tooltipItems[0]
          const label = context.dataset.label
          
          const descriptions = {
            'Model Weights': 'Memory required to store the neural network parameters',
            'KV Cache': 'Memory for storing key-value pairs during inference',
            'Activations': 'Memory for intermediate computations during forward pass',
            'System Overhead': 'Memory used by the vLLM system and CUDA runtime',
            'Fragmentation': 'Memory lost due to allocation fragmentation',
            'Swap Space': 'Reserved memory for swapping tensors to CPU',
            'Reserved/Buffer': 'Additional memory buffer for safety margin'
          }
          
          const description = descriptions[label]
          return description ? [``, `ℹ️ ${description}`] : []
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
          weight: 'bold',
          family: 'Inter, sans-serif',
        },
        color: '#1F2937',
        padding: {
          top: 10,
        },
      },
      ticks: {
        font: {
          size: 12,
          family: 'Inter, sans-serif',
        },
        color: '#374151',
        maxRotation: 0,
        callback: function(value, _index) {
          const label = this.getLabelForValue(value)
          // Truncate long labels and add ellipsis
          return label.length > 15 ? label.substring(0, 15) + '...' : label
        },
      },
      grid: {
        display: false,
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
          weight: 'bold',
          family: 'Inter, sans-serif',
        },
        color: '#1F2937',
        padding: {
          bottom: 10,
        },
      },
      ticks: {
        font: {
          size: 12,
          family: 'Inter, sans-serif',
        },
        color: '#374151',
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
        color: 'rgba(156, 163, 175, 0.3)',
        borderDash: [2, 2],
      },
      // Add a reference line for total VRAM capacity
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
      borderWidth: 1,
      borderRadius: 2,
    },
  },
  // Update key to force re-render when needed
  key: updateKey.value,
}))
</script>
