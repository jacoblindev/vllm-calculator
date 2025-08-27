import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useModelStore = defineStore('model', () => {
  // State
  const selectedModels = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const totalModelSize = computed(() =>
    selectedModels.value.reduce((total, model) => total + (model.size || 0), 0)
  )

  const totalParameters = computed(() =>
    selectedModels.value.reduce((total, model) => 
      total + (model.parameters || estimateParametersFromSize(model.size)), 0)
  )

  const modelCount = computed(() => selectedModels.value.length)

  const hasMultipleModels = computed(() => selectedModels.value.length > 1)

  const modelSpecs = computed(() => 
    selectedModels.value.map(model => ({
      name: model.name,
      parameters: model.parameters || estimateParametersFromSize(model.size),
      size: model.size || 0,
      quantization: model.quantization || 'fp16',
      architecture: model.architecture || 'transformer'
    }))
  )

  const uniqueQuantizations = computed(() => {
    const quantizations = new Set()
    selectedModels.value.forEach(model => {
      quantizations.add(model.quantization || 'fp16')
    })
    return Array.from(quantizations)
  })

  const averageMemoryFactor = computed(() => {
    if (selectedModels.value.length === 0) return 1.0
    
    const totalFactor = selectedModels.value.reduce((sum, model) => {
      const quantization = model.quantization || 'fp16'
      // Memory factors for different quantization formats
      const factors = {
        'fp32': 1.0,
        'fp16': 0.5,
        'bfp16': 0.5,
        'int8': 0.25,
        'int4': 0.125,
        'awq': 0.25,
        'gptq': 0.25,
        'gguf': 0.2,
        'ggml': 0.2
      }
      return sum + (factors[quantization] || 0.5)
    }, 0)
    
    return totalFactor / selectedModels.value.length
  })

  // Actions
  const updateSelectedModels = (newModels) => {
    selectedModels.value = newModels
    error.value = null
  }

  const addModel = (model) => {
    const existingIndex = selectedModels.value.findIndex(m => 
      m.name === model.name
    )
    
    if (existingIndex >= 0) {
      // Update existing model instead of adding duplicate
      selectedModels.value[existingIndex] = { ...selectedModels.value[existingIndex], ...model }
    } else {
      selectedModels.value.push(model)
    }
  }

  const removeModel = (modelName) => {
    const index = selectedModels.value.findIndex(m => m.name === modelName)
    if (index >= 0) {
      selectedModels.value.splice(index, 1)
    }
  }

  const updateModel = (modelName, updates) => {
    const model = selectedModels.value.find(m => m.name === modelName)
    if (model) {
      Object.assign(model, updates)
    }
  }

  const clearAllModels = () => {
    selectedModels.value = []
  }

  const setLoading = (isLoading) => {
    loading.value = isLoading
  }

  const setError = (errorMessage) => {
    error.value = errorMessage
  }

  // Helper functions
  const estimateParametersFromSize = (sizeGB) => {
    if (!sizeGB) return 7000000000 // Default 7B parameters
    // Rough estimation: ~2 bytes per parameter for fp16
    return Math.round((sizeGB * 1024 * 1024 * 1024) / 2)
  }

  const getModelByName = (name) => {
    return selectedModels.value.find(m => m.name === name)
  }

  const hasModel = (name) => {
    return selectedModels.value.some(m => m.name === name)
  }

  // Validation
  const validateModelSelections = (models) => {
    if (!Array.isArray(models)) return false
    
    return models.every(model => {
      return (
        model &&
        typeof model === 'object' &&
        typeof model.name === 'string' &&
        (typeof model.size === 'number' || model.size === null)
      )
    })
  }

  const hasValidModelSelection = computed(() =>
    selectedModels.value.length > 0 && validateModelSelections(selectedModels.value)
  )

  // Model filtering and sorting
  const getModelsByQuantization = (quantization) => {
    return selectedModels.value.filter(model => 
      (model.quantization || 'fp16') === quantization
    )
  }

  const getModelsBySize = (minSize, maxSize) => {
    return selectedModels.value.filter(model => {
      const size = model.size || 0
      return size >= minSize && size <= maxSize
    })
  }

  const sortModelsBySize = (ascending = true) => {
    return [...selectedModels.value].sort((a, b) => {
      const sizeA = a.size || 0
      const sizeB = b.size || 0
      return ascending ? sizeA - sizeB : sizeB - sizeA
    })
  }

  return {
    // State
    selectedModels,
    loading,
    error,
    
    // Getters
    totalModelSize,
    totalParameters,
    modelCount,
    hasMultipleModels,
    modelSpecs,
    uniqueQuantizations,
    averageMemoryFactor,
    hasValidModelSelection,
    
    // Actions
    updateSelectedModels,
    addModel,
    removeModel,
    updateModel,
    clearAllModels,
    setLoading,
    setError,
    getModelByName,
    hasModel,
    validateModelSelections,
    getModelsByQuantization,
    getModelsBySize,
    sortModelsBySize,
    
    // Helper functions
    estimateParametersFromSize
  }
}, {
  persist: {
    key: 'vllm-calculator-model-store',
    paths: ['selectedModels']
  }
})
