<template>
  <div class="bg-white rounded-lg shadow-lg p-6">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Select GPUs</h2>

    <!-- Predefined GPU Selection -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-4">Available GPUs</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="gpu in availableGPUs"
          :key="gpu.name"
          class="border rounded-lg p-4 cursor-pointer transition-colors"
          :class="
            isGPUSelected(gpu)
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          "
          @click="toggleGPU(gpu)"
        >
          <div class="flex justify-between items-center">
            <div>
              <p class="font-medium text-gray-900">{{ gpu.name }}</p>
              <p class="text-sm text-gray-600">{{ gpu.vram_gb }}GB VRAM</p>
            </div>
            <div v-if="isGPUSelected(gpu)" class="flex items-center">
              <input
                type="number"
                :value="getGPUQuantity(gpu)"
                @input="updateGPUQuantity(gpu, $event.target.value)"
                @click.stop
                min="1"
                max="8"
                class="w-16 text-center border rounded px-2 py-1"
              />
              <span class="ml-2 text-sm text-gray-600">qty</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom GPU Section -->
    <div class="border-t pt-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-4">Add Custom GPU</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label for="custom-gpu-name" class="block text-sm font-medium text-gray-700 mb-2"
            >GPU Name</label
          >
          <input
            id="custom-gpu-name"
            v-model="customGPU.name"
            type="text"
            placeholder="e.g., Custom RTX 5090"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="custom-gpu-vram" class="block text-sm font-medium text-gray-700 mb-2"
            >VRAM (GB)</label
          >
          <input
            id="custom-gpu-vram"
            v-model.number="customGPU.vram_gb"
            type="number"
            placeholder="e.g., 48"
            min="1"
            max="200"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <button
            @click="addCustomGPU"
            :disabled="!isCustomGPUValid"
            class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Add GPU
          </button>
        </div>
      </div>
    </div>

    <!-- Selected GPUs Summary -->
    <div v-if="selectedGPUs.length > 0" class="border-t pt-6 mt-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-4">Selected GPUs</h3>
      <div class="space-y-2">
        <div
          v-for="selection in selectedGPUs"
          :key="selection.gpu.name"
          class="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
        >
          <span class="font-medium">{{ selection.gpu.name }}</span>
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-600">{{ selection.gpu.vram_gb }}GB VRAM</span>
            <span class="text-sm text-gray-600">Qty: {{ selection.quantity }}</span>
            <button @click="removeGPU(selection.gpu)" class="text-red-600 hover:text-red-800">
              ✕
            </button>
          </div>
        </div>
      </div>
      <div class="mt-4 p-3 bg-blue-50 rounded-lg">
        <p class="text-sm text-blue-800">
          <strong>Total VRAM:</strong> {{ totalVRAM }}GB
          <span v-if="totalGPUs > 1" class="ml-4">
            <strong>Total GPUs:</strong> {{ totalGPUs }}
          </span>
        </p>
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

// Computed properties
const isCustomGPUValid = computed(() => {
  return customGPU.value.name.trim().length > 0 && customGPU.value.vram_gb > 0
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
  try {
    availableGPUs.value = await loadGPUData()
  } catch (error) {
    console.error('Failed to load GPU data:', error)
  }
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
  if (!validateGPU(gpu)) return

  selectedGPUs.value.push({
    gpu: { ...gpu },
    quantity: quantity,
  })

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
  if (!isCustomGPUValid.value) return

  const gpu = createCustomGPU(customGPU.value.name, customGPU.value.vram_gb)
  addGPU(gpu, 1)

  // Reset form
  customGPU.value = {
    name: '',
    vram_gb: null,
  }
}

// Lifecycle
onMounted(() => {
  loadGPUs()
})
</script>
