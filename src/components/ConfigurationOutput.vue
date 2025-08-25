<template>
  <div class="bg-white rounded-lg shadow-lg p-4 sm:p-6">
    <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">vLLM Configuration Recommendations</h2>

    <!-- Loading State -->
    <div v-if="isCalculating" class="text-center py-8 sm:py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p class="text-base sm:text-lg text-gray-600">Calculating optimal configurations...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="calculationError" class="text-center py-8 sm:py-12">
      <div class="text-red-600 mb-4">
        <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.98-.833-2.75 0L3.064 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p class="text-base sm:text-lg text-red-600 mb-4">{{ calculationError }}</p>
      <button
        @click="recalculateConfigurations"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
      >
        Try Again
      </button>
    </div>

    <div v-else-if="!hasConfiguration" class="text-center py-8 sm:py-12 text-gray-500">
      <p class="text-base sm:text-lg">Select GPUs and models to see configuration recommendations</p>
    </div>

    <div v-else class="space-y-4 sm:space-y-6">
      <!-- Configuration Tabs -->
      <div class="border-b border-gray-200">
        <!-- Desktop Tabs -->
        <nav class="hidden sm:flex -mb-px space-x-8">
          <button
            v-for="config in configurations"
            :key="config.type"
            @click="activeTab = config.type"
            :class="[
              'py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap',
              activeTab === config.type
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
          >
            {{ config.title }}
          </button>
        </nav>

        <!-- Mobile Dropdown -->
        <div class="sm:hidden">
          <select
            v-model="activeTab"
            class="w-full p-3 border border-gray-300 rounded-md bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option
              v-for="config in configurations"
              :key="config.type"
              :value="config.type"
            >
              {{ config.title }}
            </option>
          </select>
        </div>
      </div>

      <!-- Active Configuration Display -->
      <div v-for="config in configurations" :key="config.type" v-show="activeTab === config.type">
        <div class="mb-4 sm:mb-6">
          <h3 class="text-lg sm:text-xl font-semibold text-gray-900 mb-2">{{ config.title }}</h3>
          <p class="text-sm sm:text-base text-gray-600">{{ config.description }}</p>
        </div>

        <!-- Parameters Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div v-for="param in config.parameters" :key="param.name" class="border rounded-lg p-3 sm:p-4">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 space-y-1 sm:space-y-0">
              <h4 class="font-medium text-gray-900 text-sm sm:text-base">{{ param.name }}</h4>
              <code class="bg-gray-100 px-2 py-1 rounded text-xs sm:text-sm font-mono self-start">{{ param.value }}</code>
            </div>
            <p class="text-xs sm:text-sm text-gray-600">{{ param.explanation }}</p>
          </div>
        </div>

        <!-- Command Line -->
        <div class="border-t pt-4 sm:pt-6">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 space-y-2 sm:space-y-0">
            <h4 class="font-medium text-gray-900">Command Line</h4>
            <button
              @click="copyCommand(config.command)"
              class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors duration-200 self-start sm:self-auto"
            >
              {{ copiedCommand === config.command ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <div class="bg-gray-900 text-green-400 p-3 sm:p-4 rounded-lg overflow-x-auto">
            <code class="font-mono text-xs sm:text-sm whitespace-pre-wrap break-all">{{ config.command }}</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { calculateVRAMUsage } from '../lib/calculationEngine.js'
import { useLoadingWithRetry } from '../composables/useLoadingState.js'

// Props
const props = defineProps({
  selectedGPUs: {
    type: Array,
    default: () => [],
  },
  selectedModels: {
    type: Array,
    default: () => [],
  },
})

// Reactive data
const activeTab = ref('throughput')
const copiedCommand = ref('')
const calculationError = ref('')

// Loading state
const { isLoading: isCalculating, executeWithRetry } = useLoadingWithRetry()

// Methods
const recalculateConfigurations = async () => {
  calculationError.value = ''
  await executeWithRetry(async () => {
    // Trigger recalculation by clearing and setting active tab
    if (hasConfiguration.value) {
      activeTab.value = 'throughput'
    }
  }, {
    onError: (error) => {
      calculationError.value = 'Failed to calculate configurations. Please check your selections and try again.'
      console.error('Configuration calculation error:', error)
    }
  })
}

// Computed properties
const hasConfiguration = computed(
  () => props.selectedGPUs.length > 0 && props.selectedModels.length > 0
)

const totalVRAM = computed(() =>
  props.selectedGPUs.reduce((total, sel) => total + sel.gpu.vram * sel.quantity, 0)
)

const totalModelSize = computed(() =>
  props.selectedModels.reduce((total, model) => total + (model.size || 0), 0)
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
      description:
        'Optimized for handling the highest number of concurrent requests and maximum token generation.',
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
          explanation:
            'Larger block size for efficient memory allocation in high-throughput scenarios.',
        },
        {
          name: '--swap-space',
          value: Math.max(4, Math.floor(totalVRAM.value * 0.1)).toString(),
          explanation:
            'Generous swap space to handle peak memory usage during high throughput periods.',
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
          explanation:
            'Conservative memory utilization to ensure consistent performance and low latency.',
        },
        {
          name: '--max-model-len',
          value: '4096',
          explanation:
            'Longer sequences supported while maintaining low latency for individual requests.',
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
          explanation:
            'Smaller block size for more granular memory management and faster allocation.',
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
      description:
        'Balanced configuration providing good throughput while maintaining reasonable latency.',
      parameters: [
        {
          name: '--gpu-memory-utilization',
          value: baseMemoryUtilization.toFixed(2),
          explanation:
            'Balanced memory utilization for optimal resource usage without overcommitment.',
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

  // Add commands to each configuration
  configs.forEach(config => {
    config.command = generateCommandForConfig(config)
  })

  return configs
})

// Methods
function generateCommandForConfig(config) {
  if (!hasConfiguration.value) return ''

  const modelPath = props.selectedModels[0]?.hf_id || props.selectedModels[0]?.name || 'MODEL_PATH'

  let cmd = `python -m vllm.entrypoints.openai.api_server \\\n`
  cmd += `  --model ${modelPath} \\\n`

  config.parameters.forEach(param => {
    cmd += `  ${param.name} ${param.value} \\\n`
  })

  // Add tensor parallel if multiple GPUs
  const totalGPUs = props.selectedGPUs.reduce((total, sel) => total + sel.quantity, 0)
  if (totalGPUs > 1) {
    cmd += `  --tensor-parallel-size ${totalGPUs} \\\n`
  }

  cmd += `  --host 0.0.0.0 \\\n`
  cmd += `  --port 8000`

  return cmd
}

async function copyCommand(command) {
  try {
    await navigator.clipboard.writeText(command)
    copiedCommand.value = command
    setTimeout(() => {
      copiedCommand.value = ''
    }, 2000)
  } catch (error) {
    calculationError.value = 'Failed to copy command to clipboard'
    console.error('Failed to copy command:', error)
  }
}

// Watch for changes to reset active tab
watch(
  () => [props.selectedGPUs, props.selectedModels],
  () => {
    if (hasConfiguration.value) {
      activeTab.value = 'throughput'
    }
  },
  { deep: true }
)
</script>
