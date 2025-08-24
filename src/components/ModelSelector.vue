<template>
  <div class="bg-white rounded-lg shadow-lg p-6">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Select Models</h2>

    <!-- Predefined Model Selection -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-4">Popular Models</h3>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          v-for="model in availableModels"
          :key="model.name + model.quantization"
          class="border rounded-lg p-4 cursor-pointer transition-colors"
          :class="
            isModelSelected(model)
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          "
          @click="toggleModel(model)"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <p class="font-medium text-gray-900">{{ model.name }}</p>
              <p class="text-sm text-gray-600 mt-1">
                {{ model.size_gb }}GB • {{ model.quantization.toUpperCase() }}
              </p>
              <div class="flex items-center mt-2">
                <span
                  class="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                  :class="getQuantizationBadgeClass(model.quantization)"
                >
                  {{ model.quantization.toUpperCase() }}
                </span>
                <span class="ml-2 text-xs text-gray-500">
                  {{ Math.round(model.memory_factor * 100) }}% memory usage
                </span>
              </div>
              <p v-if="model.hf_id" class="text-xs text-gray-500 mt-1">{{ model.hf_id }}</p>
            </div>
            <div v-if="isModelSelected(model)" class="ml-4 text-blue-600">✓</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hugging Face Model Search -->
    <div class="border-t pt-6 mb-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-4">Add from Hugging Face</h3>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div class="md:col-span-2">
          <label for="hf-model-id" class="block text-sm font-medium text-gray-700 mb-2">
            Hugging Face Model ID
          </label>
          <input
            id="hf-model-id"
            v-model="hfModelId"
            type="text"
            placeholder="e.g., microsoft/DialoGPT-medium"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="text-xs text-gray-500 mt-1">
            Find models at
            <a
              href="https://huggingface.co/models"
              target="_blank"
              class="text-blue-600 hover:underline"
              >huggingface.co/models</a
            >
          </p>
        </div>
        <div>
          <label for="hf-quantization" class="block text-sm font-medium text-gray-700 mb-2">
            Quantization
          </label>
          <select
            id="hf-quantization"
            v-model="hfQuantization"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="fp16">FP16</option>
            <option value="awq">AWQ 4-bit</option>
            <option value="gptq">GPTQ 4-bit</option>
          </select>
        </div>
        <div>
          <button
            @click="fetchHuggingFaceModel"
            :disabled="!hfModelId.trim() || isLoadingHF"
            class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <span v-if="isLoadingHF">Loading...</span>
            <span v-else>Add Model</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Manual Model Entry (fallback) -->
    <div v-if="showManualEntry" class="border-t pt-6 mb-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-4">Manual Model Entry</h3>
      <p class="text-sm text-gray-600 mb-4">
        Couldn't fetch model details automatically. Please enter the information manually.
      </p>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label for="manual-model-name" class="block text-sm font-medium text-gray-700 mb-2"
            >Model Name</label
          >
          <input
            id="manual-model-name"
            v-model="manualModel.name"
            type="text"
            placeholder="e.g., Custom Llama 2 7B"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="manual-model-size" class="block text-sm font-medium text-gray-700 mb-2"
            >Size (GB)</label
          >
          <input
            id="manual-model-size"
            v-model.number="manualModel.size_gb"
            type="number"
            placeholder="e.g., 13.5"
            min="0.1"
            max="1000"
            step="0.1"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="manual-quantization" class="block text-sm font-medium text-gray-700 mb-2"
            >Quantization</label
          >
          <select
            id="manual-quantization"
            v-model="manualModel.quantization"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="fp16">FP16</option>
            <option value="awq">AWQ 4-bit</option>
            <option value="gptq">GPTQ 4-bit</option>
          </select>
        </div>
        <div>
          <button
            @click="addManualModel"
            :disabled="!isManualModelValid"
            class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Add Model
          </button>
        </div>
      </div>
    </div>

    <!-- Selected Models Summary -->
    <div v-if="selectedModels.length > 0" class="border-t pt-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-4">Selected Models</h3>
      <div class="space-y-3">
        <div
          v-for="model in selectedModels"
          :key="model.name + model.quantization"
          class="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
        >
          <div>
            <span class="font-medium">{{ model.name }}</span>
            <div class="flex items-center space-x-2 mt-1">
              <span class="text-sm text-gray-600">{{ model.size_gb }}GB</span>
              <span
                class="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                :class="getQuantizationBadgeClass(model.quantization)"
              >
                {{ model.quantization.toUpperCase() }}
              </span>
              <span class="text-xs text-gray-500">
                {{ Math.round(model.memory_factor * 100) }}% memory
              </span>
            </div>
          </div>
          <button @click="removeModel(model)" class="text-red-600 hover:text-red-800">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadModelData, validateModel, createCustomModel } from '../lib/dataLoader.js'
import { fetchModelInfo, extractModelSize, getQuantizationFactor } from '../lib/huggingfaceApi.js'

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
const hfModelId = ref('')
const hfQuantization = ref('fp16')
const isLoadingHF = ref(false)
const showManualEntry = ref(false)
const manualModel = ref({
  name: '',
  size_gb: null,
  quantization: 'fp16',
})

// Computed properties
const isManualModelValid = computed(() => {
  return manualModel.value.name.trim().length > 0 && manualModel.value.size_gb > 0
})

// Methods
const loadModels = async () => {
  try {
    availableModels.value = await loadModelData()
  } catch (error) {
    console.error('Failed to load model data:', error)
  }
}

const isModelSelected = model => {
  return selectedModels.value.some(
    m => m.name === model.name && m.quantization === model.quantization
  )
}

const toggleModel = model => {
  if (isModelSelected(model)) {
    removeModel(model)
  } else {
    addModel(model)
  }
}

const addModel = model => {
  if (!validateModel(model)) return

  selectedModels.value.push({ ...model })
  emit('update:selectedModels', selectedModels.value)
}

const removeModel = model => {
  selectedModels.value = selectedModels.value.filter(
    m => !(m.name === model.name && m.quantization === model.quantization)
  )
  emit('update:selectedModels', selectedModels.value)
}

const fetchHuggingFaceModel = async () => {
  if (!hfModelId.value.trim()) return

  isLoadingHF.value = true
  showManualEntry.value = false

  try {
    const modelInfo = await fetchModelInfo(hfModelId.value.trim())

    if (modelInfo.success) {
      const size = extractModelSize(modelInfo)

      if (size) {
        const model = createCustomModel(
          modelInfo.id || hfModelId.value,
          size,
          hfQuantization.value,
          getQuantizationFactor(hfQuantization.value)
        )
        model.hf_id = hfModelId.value

        addModel(model)
        hfModelId.value = ''
      } else {
        // Show manual entry if we can't extract size
        showManualEntry.value = true
        manualModel.value.name = modelInfo.id || hfModelId.value
      }
    } else {
      // Show manual entry on API failure
      showManualEntry.value = true
      manualModel.value.name = hfModelId.value
    }
  } catch (error) {
    console.error('Error fetching HF model:', error)
    showManualEntry.value = true
    manualModel.value.name = hfModelId.value
  } finally {
    isLoadingHF.value = false
  }
}

const addManualModel = () => {
  if (!isManualModelValid.value) return

  const model = createCustomModel(
    manualModel.value.name,
    manualModel.value.size_gb,
    manualModel.value.quantization,
    getQuantizationFactor(manualModel.value.quantization)
  )

  addModel(model)

  // Reset forms
  manualModel.value = {
    name: '',
    size_gb: null,
    quantization: 'fp16',
  }
  showManualEntry.value = false
  hfModelId.value = ''
}

const getQuantizationBadgeClass = quantization => {
  const classes = {
    fp16: 'bg-blue-100 text-blue-800',
    awq: 'bg-green-100 text-green-800',
    gptq: 'bg-purple-100 text-purple-800',
    ggml: 'bg-orange-100 text-orange-800',
    gguf: 'bg-orange-100 text-orange-800',
  }
  return classes[quantization] || 'bg-gray-100 text-gray-800'
}

// Lifecycle
onMounted(() => {
  loadModels()
})
</script>
