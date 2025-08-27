import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useGpuStore = defineStore('gpu', () => {
  // State
  const selectedGPUs = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const totalVRAM = computed(() =>
    selectedGPUs.value.reduce((total, sel) => total + sel.gpu.vram_gb * sel.quantity, 0)
  )

  const totalGPUCount = computed(() =>
    selectedGPUs.value.reduce((sum, sel) => sum + sel.quantity, 0)
  )

  const hasCustomGPUs = computed(() =>
    selectedGPUs.value.some(sel => sel.gpu.custom)
  )

  const gpuTypes = computed(() =>
    selectedGPUs.value.map(sel => sel.gpu.name)
  )

  const averageMemoryBandwidth = computed(() => {
    if (selectedGPUs.value.length === 0) return 0
    
    const totalBandwidth = selectedGPUs.value.reduce((total, sel) => {
      // Estimate memory bandwidth based on GPU type
      const estimatedBandwidth = sel.gpu.vram_gb >= 80 ? 3500 : // H100/A100 class
                                 sel.gpu.vram_gb > 40 ? 2000 : // RTX 6000 class  
                                 sel.gpu.vram_gb > 20 ? 1000 : // RTX 4090 class
                                 800 // Lower-end GPUs
      return total + (estimatedBandwidth * sel.quantity)
    }, 0)
    
    return totalBandwidth / totalGPUCount.value
  })

  const hardwareSpecs = computed(() => ({
    totalVRAM: totalVRAM.value,
    gpuCount: totalGPUCount.value,
    gpuTypes: gpuTypes.value,
    memoryBandwidth: averageMemoryBandwidth.value
  }))

  const estimatedCost = computed(() => {
    // Simplified cost estimation based on GPU types
    return selectedGPUs.value.reduce((total, selection) => {
      const baseCost = selection.gpu.vram_gb * 0.1 // $0.10 per GB of VRAM per hour (example)
      return total + (baseCost * selection.quantity)
    }, 0)
  })

  // Actions
  const updateSelectedGPUs = (newGPUs) => {
    selectedGPUs.value = newGPUs
    error.value = null
  }

  const addGPU = (gpu, quantity = 1) => {
    const existingIndex = selectedGPUs.value.findIndex(sel => 
      sel.gpu.name === gpu.name
    )
    
    if (existingIndex >= 0) {
      selectedGPUs.value[existingIndex].quantity += quantity
    } else {
      selectedGPUs.value.push({ gpu, quantity })
    }
  }

  const removeGPU = (gpuName) => {
    const index = selectedGPUs.value.findIndex(sel => sel.gpu.name === gpuName)
    if (index >= 0) {
      selectedGPUs.value.splice(index, 1)
    }
  }

  const updateGPUQuantity = (gpuName, quantity) => {
    const selection = selectedGPUs.value.find(sel => sel.gpu.name === gpuName)
    if (selection) {
      if (quantity <= 0) {
        removeGPU(gpuName)
      } else {
        selection.quantity = quantity
      }
    }
  }

  const clearAllGPUs = () => {
    selectedGPUs.value = []
  }

  const setLoading = (isLoading) => {
    loading.value = isLoading
  }

  const setError = (errorMessage) => {
    error.value = errorMessage
  }

  // Validation
  const validateGPUSelections = (gpus) => {
    if (!Array.isArray(gpus)) return false
    
    return gpus.every(selection => {
      return (
        selection &&
        typeof selection === 'object' &&
        selection.gpu &&
        typeof selection.gpu.name === 'string' &&
        typeof selection.gpu.vram_gb === 'number' &&
        typeof selection.quantity === 'number' &&
        selection.quantity > 0 &&
        selection.quantity <= 8
      )
    })
  }

  const hasValidGPUSelection = computed(() =>
    selectedGPUs.value.length > 0 && validateGPUSelections(selectedGPUs.value)
  )

  return {
    // State
    selectedGPUs,
    loading,
    error,
    
    // Getters
    totalVRAM,
    totalGPUCount,
    hasCustomGPUs,
    gpuTypes,
    averageMemoryBandwidth,
    hardwareSpecs,
    estimatedCost,
    hasValidGPUSelection,
    
    // Actions
    updateSelectedGPUs,
    addGPU,
    removeGPU,
    updateGPUQuantity,
    clearAllGPUs,
    setLoading,
    setError,
    validateGPUSelections
  }
}, {
  persist: {
    key: 'vllm-calculator-gpu-store',
    paths: ['selectedGPUs']
  }
})
