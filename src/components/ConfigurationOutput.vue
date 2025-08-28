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

    <div v-else-if="!hasConfiguration" class="text-center py-6 sm:py-8 lg:py-12 text-gray-500">
      <p class="text-sm sm:text-base lg:text-lg">Select GPUs and models to see configuration recommendations</p>
    </div>

    <div v-else class="space-y-3 sm:space-y-4 lg:space-y-6">
      <!-- Configuration Tabs -->
      <div class="border-b border-gray-200">
        <!-- Mobile Tabs - Dropdown -->
        <div class="sm:hidden">
          <select 
            v-model="activeTab" 
            class="w-full border-gray-300 rounded-lg text-sm font-medium focus:ring-blue-500 focus:border-blue-500"
          >
            <option
              v-for="config in (configurations || [])"
              :key="config.type"
              :value="config.type"
            >
              {{ getTabTitle(config.type) }}
            </option>
          </select>
        </div>
        
        <!-- Desktop Tabs -->
        <nav class="hidden sm:flex -mb-px space-x-4 lg:space-x-8">
          <button
            v-for="config in (configurations || [])"
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
      </div>

      <!-- Command Format Selector -->
      <div class="mb-4 flex gap-2 items-center">
        <label for="commandFormat" class="text-sm font-medium text-gray-700">Command Format:</label>
        <select id="commandFormat" v-model="commandFormat" class="border rounded px-2 py-1 text-sm">
          <option value="python">Python</option>
          <option value="docker">Docker</option>
          <option value="compose">Docker Compose</option>
        </select>
      </div>

      <!-- Active Configuration Display -->
      <div v-for="config in (configurations || [])" :key="config.type" v-show="activeTab === config.type">
        <div class="mb-3 sm:mb-4 lg:mb-6">
          <h3 class="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">{{ config.title }}</h3>
          <p class="text-xs sm:text-sm lg:text-base text-gray-600">{{ config.description }}</p>
        </div>

        <!-- Parameters Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-3 sm:mb-4 lg:mb-6">
          <div v-for="param in (config.parameters || [])" :key="param.name" class="border rounded-lg p-3 sm:p-4">
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
              @click="copyCommand(commandForConfig(config))"
              class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors duration-200 self-start sm:self-auto"
            >
              {{ copiedCommand === commandForConfig(config) ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <div class="bg-gray-900 text-green-400 p-3 sm:p-4 rounded-lg overflow-x-auto">
            <code class="font-mono text-xs sm:text-sm whitespace-pre-wrap break-all">{{ commandForConfig(config) }}</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useConfigStore } from '../stores/configStore.js'
import { useGpuStore } from '../stores/gpuStore.js'
import { useModelStore } from '../stores/modelStore.js'
import { useLoadingWithRetry } from '../composables/useLoadingState.js'
import { generateVLLMCommand } from '../lib/workload/commandGenerator.js'

// Pinia stores
const configStore = useConfigStore()
const gpuStore = useGpuStore()
const modelStore = useModelStore()

// Reactive data
const activeTab = ref('throughput')
const copiedCommand = ref('')
const calculationError = ref('')
const commandFormat = ref('python')

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
const hasConfiguration = computed(() => configStore.hasValidConfiguration)

const totalVRAM = computed(() => gpuStore.totalVRAM)

const totalModelSize = computed(() => modelStore.totalModelSize)

const configurations = computed(() => configStore.configurations)

// Methods
function getTabTitle(type) {
  const titles = {
    'throughput': 'Maximum Throughput',
    'latency': 'Minimum Latency', 
    'balanced': 'Balanced Performance'
  }
  return titles[type] || type
}

function commandForConfig(config) {
  if (!hasConfiguration.value) return ''
  // Build config object for command generator
  const primaryModel = modelStore.selectedModels[0]
  const modelPath = primaryModel?.hf_id || primaryModel?.name || 'MODEL_PATH'
  const params = {}
  config.parameters.forEach(param => {
    // param.name is already --flag, remove leading dashes for key
    const key = param.name.replace(/^--/, '').replace(/-/g, '_')
    params[key] = param.value
  })
  // Add tensor parallel if multiple GPUs
  const totalGPUs = gpuStore.totalGPUCount
  if (totalGPUs > 1) {
    params['tensor_parallel_size'] = totalGPUs
  }
  params['host'] = '0.0.0.0'
  params['port'] = 8000
  const configObj = {
    model: modelPath,
    ...params
  }
  const { command } = generateVLLMCommand(configObj, { format: commandFormat.value })
  return command
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
  () => [gpuStore.selectedGPUs, modelStore.selectedModels],
  () => {
    if (hasConfiguration.value) {
      activeTab.value = 'throughput'
    }
  },
  { deep: true }
)
</script>
