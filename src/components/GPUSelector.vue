<template>
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-8">
    <div class="mb-8">
      <h2 class="text-3xl font-semibold text-gray-900 mb-2">GPU Selection</h2>
      <p class="text-gray-600 text-lg">Choose your hardware configuration for optimal vLLM performance</p>
    </div>

    <!-- Predefined GPU Selection -->
    <div class="mb-10">
      <div class="mb-6">
        <h3 class="text-xl font-medium text-gray-900 mb-2">Available GPUs</h3>
        <p class="text-gray-500">Select from our curated list of high-performance GPUs</p>
      </div>
      
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600 font-medium">Loading GPU data...</p>
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
            <h4 class="text-red-900 font-semibold text-lg">Unable to load GPU data</h4>
            <p class="text-red-700 mt-1 mb-4">{{ loadError }}</p>
            <button 
              @click="retryLoadGPUs" 
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

      <!-- GPU Grid -->
      <div v-else-if="availableGPUs.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div
          v-for="gpu in availableGPUs"
          :key="gpu.name"
          class="group relative border border-gray-200 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:border-blue-300 hover:shadow-md"
          :class="
            isGPUSelected(gpu)
              ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-500 ring-opacity-20'
              : 'hover:bg-gray-50'
          "
          @click="toggleGPU(gpu)"
        >
          <div class="flex justify-between items-start mb-4">
            <div class="flex-1">
              <h4 class="font-semibold text-gray-900 text-lg mb-1">{{ gpu.name }}</h4>
              <p class="text-gray-600 flex items-center">
                <svg class="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                {{ gpu.vram_gb }}GB VRAM
              </p>
            </div>
            <div v-if="isGPUSelected(gpu)" class="flex items-center bg-white rounded-lg border border-gray-300 overflow-hidden">
              <input
                type="number"
                :value="getGPUQuantity(gpu)"
                @input="updateGPUQuantity(gpu, $event.target.value)"
                @click.stop
                min="1"
                max="8"
                class="w-14 text-center py-2 border-0 focus:ring-0 focus:outline-none text-sm font-medium"
              />
              <div class="px-2 py-2 bg-gray-50 text-xs font-medium text-gray-600 border-l">
                qty
              </div>
            </div>
          </div>
          
          <!-- Selection indicator -->
          <div v-if="isGPUSelected(gpu)" class="absolute top-4 right-4">
            <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
          </div>
        </div>
      </div>

      <!-- No GPUs Available -->
      <div v-else class="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
        <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
        <p class="text-gray-500 font-medium">No GPU data available</p>
        <p class="text-gray-400 text-sm mt-1">You can add custom GPUs below</p>
      </div>
    </div>

    <!-- Custom GPU Section -->
    <div class="border-t border-gray-200 pt-10">
      <div class="mb-6">
        <h3 class="text-xl font-medium text-gray-900 mb-2">Custom GPU</h3>
        <p class="text-gray-500">Add a custom GPU with specific VRAM configuration</p>
      </div>
      
      <!-- Custom GPU Error Display -->
      <div v-if="customGPUError" class="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
          </svg>
          <p class="text-red-700 font-medium">{{ customGPUError }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div class="md:col-span-5">
          <label for="custom-gpu-name" class="block text-sm font-semibold text-gray-900 mb-3">
            GPU Name
          </label>
          <input
            id="custom-gpu-name"
            v-model="customGPU.name"
            type="text"
            placeholder="e.g., Custom RTX 5090"
            :class="[
              'w-full px-4 py-3 border rounded-xl font-medium placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
              customGPUNameError 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 hover:border-gray-400'
            ]"
            @blur="validateCustomGPUName"
          />
          <p v-if="customGPUNameError" class="text-red-600 text-sm font-medium mt-2 flex items-center">
            <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            {{ customGPUNameError }}
          </p>
        </div>
        
        <div class="md:col-span-4">
          <label for="custom-gpu-vram" class="block text-sm font-semibold text-gray-900 mb-3">
            VRAM (GB)
          </label>
          <div class="relative">
            <input
              id="custom-gpu-vram"
              v-model.number="customGPU.vram_gb"
              type="number"
              placeholder="48"
              min="1"
              max="200"
              :class="[
                'w-full px-4 py-3 border rounded-xl font-medium placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                customGPUVramError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 hover:border-gray-400'
              ]"
              @blur="validateCustomGPUVram"
            />
            <div class="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
              <span class="text-gray-500 font-medium text-sm">GB</span>
            </div>
          </div>
          <p v-if="customGPUVramError" class="text-red-600 text-sm font-medium mt-2 flex items-center">
            <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            {{ customGPUVramError }}
          </p>
        </div>
        
        <div class="md:col-span-3 flex items-end">
          <button
            @click="addCustomGPU"
            :disabled="!isCustomGPUValid || hasCustomGPUErrors"
            :class="[
              'w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
              !isCustomGPUValid || hasCustomGPUErrors
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm hover:shadow-md active:bg-blue-800'
            ]"
          >
            <span class="flex items-center justify-center">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              Add GPU
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Selected GPUs Summary -->
    <div v-if="selectedGPUs.length > 0" class="border-t border-gray-200 pt-10 mt-10">
      <div class="mb-6">
        <h3 class="text-xl font-medium text-gray-900 mb-2">Selected Configuration</h3>
        <p class="text-gray-500">Review your GPU selection and configuration details</p>
      </div>
      
      <!-- Selection Warnings -->
      <div v-if="selectionWarnings.length > 0" class="mb-8 space-y-4">
        <div 
          v-for="warning in selectionWarnings" 
          :key="warning.type"
          class="bg-amber-50 border border-amber-200 rounded-xl p-4"
        >
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="w-5 h-5 text-amber-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-amber-800 font-medium">{{ warning.message }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- GPU List -->
      <div class="space-y-3 mb-8">
        <div
          v-for="selection in selectedGPUs"
          :key="selection.gpu.name"
          class="group bg-gray-50 hover:bg-gray-100 rounded-xl p-6 transition-colors duration-200 border border-gray-200"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center">
                <h4 class="font-semibold text-gray-900 text-lg">{{ selection.gpu.name }}</h4>
                <span v-if="selection.gpu.custom" class="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Custom
                </span>
              </div>
              <div class="flex items-center mt-2 text-gray-600">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                <span class="font-medium">{{ selection.gpu.vram_gb }}GB VRAM</span>
                <span class="mx-3 text-gray-400">•</span>
                <span class="font-medium">{{ selection.quantity }} unit{{ selection.quantity > 1 ? 's' : '' }}</span>
                <span class="mx-3 text-gray-400">•</span>
                <span class="font-medium">{{ selection.gpu.vram_gb * selection.quantity }}GB Total</span>
              </div>
            </div>
            <button 
              @click="removeGPU(selection.gpu)" 
              class="ml-6 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              title="Remove GPU"
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
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="text-center md:text-left">
            <div class="text-3xl font-bold text-blue-900">{{ totalVRAM }}GB</div>
            <div class="text-blue-700 font-medium">Total VRAM</div>
          </div>
          <div v-if="totalGPUs > 1" class="text-center md:text-left">
            <div class="text-3xl font-bold text-blue-900">{{ totalGPUs }}</div>
            <div class="text-blue-700 font-medium">Total GPUs</div>
          </div>
          <div class="text-center md:text-left">
            <div class="text-3xl font-bold text-blue-900">{{ selectedGPUs.length }}</div>
            <div class="text-blue-700 font-medium">GPU Type{{ selectedGPUs.length > 1 ? 's' : '' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadGPUData, validateGPU, createCustomGPU } from '../lib/dataLoader.js'

// Props and emits
const emit = defineEmits(['update:selectedGPUs'])
const props = defineProps({
  selectedGPUs: {
    type: Array,
    default: () => [],
  },
})

// Reactive data
const availableGPUs = ref([])
const selectedGPUs = ref(props.selectedGPUs)
const customGPU = ref({
  name: '',
  vram_gb: null,
})

// Loading and error states
const isLoading = ref(false)
const loadError = ref('')
const customGPUError = ref('')
const customGPUNameError = ref('')
const customGPUVramError = ref('')

// Computed properties
const isCustomGPUValid = computed(() => {
  return customGPU.value.name.trim().length > 0 && customGPU.value.vram_gb > 0
})

const hasCustomGPUErrors = computed(() => {
  return !!(customGPUNameError.value || customGPUVramError.value)
})

const selectionWarnings = computed(() => {
  const warnings = []
  
  // Check for excessive GPU count
  if (totalGPUs.value > 16) {
    warnings.push({
      type: 'excessive_gpus',
      message: `${totalGPUs.value} GPUs may be excessive for most vLLM deployments. Consider reducing the quantity.`
    })
  }
  
  // Check for very low VRAM
  if (totalVRAM.value < 16) {
    warnings.push({
      type: 'low_vram',
      message: `${totalVRAM.value}GB total VRAM may be insufficient for larger models. Consider adding more GPUs or higher VRAM GPUs.`
    })
  }
  
  // Check for mixed GPU types
  const uniqueGPUTypes = new Set(selectedGPUs.value.map(s => s.gpu.name))
  if (uniqueGPUTypes.size > 1 && totalGPUs.value > 1) {
    warnings.push({
      type: 'mixed_gpus',
      message: 'Mixing different GPU types may lead to performance bottlenecks. Consider using identical GPUs for better performance.'
    })
  }
  
  return warnings
})

const totalVRAM = computed(() => {
  return selectedGPUs.value.reduce((total, selection) => {
    return total + selection.gpu.vram_gb * selection.quantity
  }, 0)
})

const totalGPUs = computed(() => {
  return selectedGPUs.value.reduce((total, selection) => {
    return total + selection.quantity
  }, 0)
})

// Methods
const loadGPUs = async () => {
  isLoading.value = true
  loadError.value = ''
  
  try {
    availableGPUs.value = await loadGPUData()
  } catch (error) {
    console.error('Failed to load GPU data:', error)
    loadError.value = 'Unable to load GPU data. Please check your internet connection and try again.'
  } finally {
    isLoading.value = false
  }
}

const retryLoadGPUs = () => {
  loadGPUs()
}

const validateCustomGPUName = () => {
  const name = customGPU.value.name.trim()
  
  if (!name) {
    customGPUNameError.value = 'GPU name is required'
    return false
  }
  
  if (name.length < 2) {
    customGPUNameError.value = 'GPU name must be at least 2 characters long'
    return false
  }
  
  // Check for duplicate names
  const isDuplicate = selectedGPUs.value.some(selection => 
    selection.gpu.name.toLowerCase() === name.toLowerCase()
  ) || availableGPUs.value.some(gpu => 
    gpu.name.toLowerCase() === name.toLowerCase()
  )
  
  if (isDuplicate) {
    customGPUNameError.value = 'A GPU with this name already exists'
    return false
  }
  
  customGPUNameError.value = ''
  return true
}

const validateCustomGPUVram = () => {
  const vram = customGPU.value.vram_gb
  
  if (!vram || vram <= 0) {
    customGPUVramError.value = 'VRAM must be at least 1GB'
    return false
  }
  
  if (vram < 1) {
    customGPUVramError.value = 'VRAM must be at least 1GB'
    return false
  }
  
  if (vram > 200) {
    customGPUVramError.value = 'VRAM cannot exceed 200GB'
    return false
  }
  
  customGPUVramError.value = ''
  return true
}

const isGPUSelected = gpu => {
  return selectedGPUs.value.some(selection => selection.gpu.name === gpu.name)
}

const getGPUQuantity = gpu => {
  const selection = selectedGPUs.value.find(s => s.gpu.name === gpu.name)
  return selection ? selection.quantity : 1
}

const toggleGPU = gpu => {
  if (isGPUSelected(gpu)) {
    removeGPU(gpu)
  } else {
    addGPU(gpu, 1)
  }
}

const addGPU = (gpu, quantity = 1) => {
  if (!validateGPU(gpu)) {
    customGPUError.value = 'Invalid GPU configuration. Please check the GPU details and try again.'
    return
  }
  
  // Check if GPU already exists
  const existingSelection = selectedGPUs.value.find(s => s.gpu.name === gpu.name)
  if (existingSelection) {
    // Update quantity instead of adding duplicate
    existingSelection.quantity = Math.min(existingSelection.quantity + quantity, 8)
  } else {
    selectedGPUs.value.push({
      gpu: { ...gpu },
      quantity: quantity,
    })
  }

  // Clear any previous errors
  customGPUError.value = ''
  emit('update:selectedGPUs', selectedGPUs.value)
}

const removeGPU = gpu => {
  selectedGPUs.value = selectedGPUs.value.filter(selection => selection.gpu.name !== gpu.name)
  emit('update:selectedGPUs', selectedGPUs.value)
}

const updateGPUQuantity = (gpu, newQuantity) => {
  const selection = selectedGPUs.value.find(s => s.gpu.name === gpu.name)
  if (selection && newQuantity >= 1 && newQuantity <= 8) {
    selection.quantity = parseInt(newQuantity)
    emit('update:selectedGPUs', selectedGPUs.value)
  }
}

const addCustomGPU = () => {
  // Clear previous errors
  customGPUError.value = ''
  
  // Validate inputs
  const isNameValid = validateCustomGPUName()
  const isVramValid = validateCustomGPUVram()
  
  if (!isNameValid || !isVramValid || !isCustomGPUValid.value) {
    customGPUError.value = 'Please fix the validation errors above before adding the GPU.'
    return
  }

  try {
    const gpu = createCustomGPU(customGPU.value.name, customGPU.value.vram_gb)
    addGPU(gpu, 1)

    // Reset form
    customGPU.value = {
      name: '',
      vram_gb: null,
    }
    
    // Clear field errors
    customGPUNameError.value = ''
    customGPUVramError.value = ''
  } catch (error) {
    console.error('Error creating custom GPU:', error)
    customGPUError.value = 'Failed to add custom GPU. Please try again.'
  }
}

// Lifecycle
onMounted(() => {
  loadGPUs()
})
</script>
