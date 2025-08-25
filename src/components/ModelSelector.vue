<template>
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-8">
    <div class="mb-8">
      <h2 class="text-3xl font-semibold text-gray-900 mb-2">Model Selection</h2>
      <p class="text-gray-600 text-lg">Choose language models with appropriate quantization settings</p>
    </div>

    <!-- Predefined Model Selection -->
    <div class="mb-10">
      <div class="mb-6">
        <h3 class="text-xl font-medium text-gray-900 mb-2">Available Models</h3>
        <p class="text-gray-500">Select from our curated list of high-performance language models</p>
      </div>
      
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600 font-medium">Loading model data...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="loadError" class="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <div class="ml-4 flex-1">
            <h4 class="text-red-900 font-semibold text-lg">Unable to load model data</h4>
            <p class="text-red-700 mt-1 mb-4">{{ loadError }}</p>
            <button 
              @click="retryLoadModels" 
              class="inline-flex items-center px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Try again
            </button>
          </div>
        </div>
      </div>

      <!-- Model Grid -->
      <div v-else-if="availableModels.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div
          v-for="model in availableModels"
          :key="model.name"
          class="group relative border border-gray-200 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:border-blue-300 hover:shadow-md"
          :class="
            isModelSelected(model)
              ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-500 ring-opacity-20'
              : 'hover:bg-gray-50'
          "
          @click="toggleModel(model)"
        >
          <div class="mb-4">
            <div class="flex items-start justify-between mb-3">
              <h4 class="font-semibold text-gray-900 text-lg leading-tight">{{ model.name }}</h4>
              <div v-if="isModelSelected(model)" class="flex-shrink-0 ml-2">
                <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
            </div>
            
            <div class="space-y-2">
              <!-- Hugging Face ID -->
              <div class="flex items-center text-sm text-gray-600">
                <svg class="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clip-rule="evenodd"></path>
                </svg>
                <span class="font-mono text-xs truncate">{{ model.huggingface_id }}</span>
              </div>
              
              <!-- Quantization Info -->
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <span 
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      getQuantizationColor(model.quantization)
                    ]"
                  >
                    {{ model.quantization.toUpperCase() }}
                  </span>
                  <span class="ml-2 text-sm text-gray-500">
                    {{ Math.round(model.memory_factor * 100) }}% memory
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Model Details -->
          <div class="pt-3 border-t border-gray-100">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-500">Memory Factor:</span>
              <span class="font-medium text-gray-900">{{ model.memory_factor }}x</span>
            </div>
          </div>
        </div>
      </div>

      <!-- No Models Available -->
      <div v-else class="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
        <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p class="text-gray-500 font-medium">No model data available</p>
        <p class="text-gray-400 text-sm mt-1">Check Hugging Face integration below</p>
      </div>
    </div>

    <!-- Selected Models Summary -->
    <div v-if="selectedModels.length > 0" class="border-t border-gray-200 pt-10">
      <div class="mb-6">
        <h3 class="text-xl font-medium text-gray-900 mb-2">Selected Models</h3>
        <p class="text-gray-500">Review your model selection and quantization settings</p>
      </div>
      
      <!-- Model List -->
      <div class="space-y-3 mb-8">
        <div
          v-for="model in selectedModels"
          :key="model.name"
          class="group bg-gray-50 hover:bg-gray-100 rounded-xl p-6 transition-colors duration-200 border border-gray-200"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center mb-2">
                <h4 class="font-semibold text-gray-900 text-lg">{{ model.name }}</h4>
                <span v-if="model.custom" class="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Custom
                </span>
              </div>
              <div class="flex items-center text-gray-600 space-x-4">
                <div class="flex items-center">
                  <svg class="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clip-rule="evenodd"></path>
                  </svg>
                  <span class="font-medium">{{ model.quantization.toUpperCase() }}</span>
                </div>
                <div class="flex items-center">
                  <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                  </svg>
                  <span class="font-medium">{{ model.memory_factor }}x memory</span>
                </div>
                <div v-if="model.huggingface_id" class="flex items-center">
                  <span class="font-mono text-sm text-gray-500">{{ model.huggingface_id }}</span>
                </div>
              </div>
            </div>
            <button 
              @click="removeModel(model)" 
              class="ml-6 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              title="Remove Model"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="text-center md:text-left">
            <div class="text-3xl font-bold text-blue-900">{{ selectedModels.length }}</div>
            <div class="text-blue-700 font-medium">Selected Model{{ selectedModels.length > 1 ? 's' : '' }}</div>
          </div>
          <div class="text-center md:text-left">
            <div class="text-3xl font-bold text-blue-900">{{ uniqueQuantizations.length }}</div>
            <div class="text-blue-700 font-medium">Quantization Type{{ uniqueQuantizations.length > 1 ? 's' : '' }}</div>
          </div>
        </div>
        <div v-if="uniqueQuantizations.length > 0" class="mt-4 pt-4 border-t border-blue-200">
          <div class="text-sm text-blue-700 font-medium mb-2">Quantization Methods:</div>
          <div class="flex flex-wrap gap-2">
            <span 
              v-for="quant in uniqueQuantizations" 
              :key="quant"
              :class="['inline-flex items-center px-3 py-1 rounded-full text-sm font-medium', getQuantizationColor(quant)]"
            >
              {{ quant.toUpperCase() }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadModelData, validateModel } from '../lib/dataLoader.js'

// Props and emits
const emit = defineEmits(['update:selectedModels'])
const props = defineProps({
  selectedModels: {
    type: Array,
    default: () => [],
  },
})

// Reactive data
const availableModels = ref([])
const selectedModels = ref(props.selectedModels)

// Loading and error states
const isLoading = ref(false)
const loadError = ref('')

// Computed properties
const uniqueQuantizations = computed(() => {
  const quantizations = selectedModels.value.map(model => model.quantization)
  return [...new Set(quantizations)]
})

// Methods
const getQuantizationColor = (quantization) => {
  const colors = {
    fp16: 'bg-blue-100 text-blue-800',
    awq: 'bg-green-100 text-green-800',
    gptq: 'bg-purple-100 text-purple-800',
    int8: 'bg-orange-100 text-orange-800',
    int4: 'bg-red-100 text-red-800',
  }
  return colors[quantization.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

const loadModels = async () => {
  isLoading.value = true
  loadError.value = ''
  
  try {
    availableModels.value = await loadModelData()
  } catch (error) {
    console.error('Failed to load model data:', error)
    loadError.value = 'Unable to load model data. Please check your internet connection and try again.'
  } finally {
    isLoading.value = false
  }
}

const retryLoadModels = () => {
  loadModels()
}

const isModelSelected = (model) => {
  return selectedModels.value.some(selected => selected.name === model.name)
}

const toggleModel = (model) => {
  if (isModelSelected(model)) {
    removeModel(model)
  } else {
    addModel(model)
  }
}

const addModel = (model) => {
  if (!validateModel(model)) {
    console.error('Invalid model configuration:', model)
    return
  }
  
  // Check if model already exists
  if (isModelSelected(model)) {
    return
  }
  
  selectedModels.value.push({ ...model })
  emit('update:selectedModels', selectedModels.value)
}

const removeModel = (model) => {
  selectedModels.value = selectedModels.value.filter(selected => selected.name !== model.name)
  emit('update:selectedModels', selectedModels.value)
}

// Lifecycle
onMounted(() => {
  loadModels()
})
</script>
