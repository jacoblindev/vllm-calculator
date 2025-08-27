import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useModelStore } from './modelStore.js'

describe('Model Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      const store = useModelStore()
      
      expect(store.selectedModels).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBe(null)
      expect(store.totalModelSize).toBe(0)
      expect(store.modelCount).toBe(0)
      expect(store.hasValidModelSelection).toBe(false)
    })
  })

  describe('Model Selection Management', () => {
    it('should add a new model', () => {
      const store = useModelStore()
      const model = { name: 'llama-2-7b', size: 13.5, quantization: 'fp16' }
      
      store.addModel(model)
      
      expect(store.selectedModels).toHaveLength(1)
      expect(store.selectedModels[0]).toEqual(model)
      expect(store.totalModelSize).toBe(13.5)
      expect(store.modelCount).toBe(1)
    })

    it('should update existing model instead of adding duplicate', () => {
      const store = useModelStore()
      const model1 = { name: 'llama-2-7b', size: 13.5, quantization: 'fp16' }
      const model2 = { name: 'llama-2-7b', size: 13.5, quantization: 'int8' }
      
      store.addModel(model1)
      store.addModel(model2)
      
      expect(store.selectedModels).toHaveLength(1)
      expect(store.selectedModels[0].quantization).toBe('int8')
    })

    it('should remove model', () => {
      const store = useModelStore()
      const model = { name: 'llama-2-7b', size: 13.5 }
      
      store.addModel(model)
      store.removeModel('llama-2-7b')
      
      expect(store.selectedModels).toHaveLength(0)
      expect(store.totalModelSize).toBe(0)
    })

    it('should update model properties', () => {
      const store = useModelStore()
      const model = { name: 'llama-2-7b', size: 13.5, quantization: 'fp16' }
      
      store.addModel(model)
      store.updateModel('llama-2-7b', { quantization: 'int8', size: 6.75 })
      
      expect(store.selectedModels[0].quantization).toBe('int8')
      expect(store.selectedModels[0].size).toBe(6.75)
    })

    it('should clear all models', () => {
      const store = useModelStore()
      const model1 = { name: 'llama-2-7b', size: 13.5 }
      const model2 = { name: 'mistral-7b', size: 14.0 }
      
      store.addModel(model1)
      store.addModel(model2)
      store.clearAllModels()
      
      expect(store.selectedModels).toHaveLength(0)
      expect(store.totalModelSize).toBe(0)
    })
  })

  describe('Computed Properties', () => {
    it('should calculate total model size', () => {
      const store = useModelStore()
      const model1 = { name: 'llama-2-7b', size: 13.5 }
      const model2 = { name: 'mistral-7b', size: 14.0 }
      
      store.addModel(model1)
      store.addModel(model2)
      
      expect(store.totalModelSize).toBe(27.5)
    })

    it('should calculate total parameters', () => {
      const store = useModelStore()
      const model1 = { name: 'llama-2-7b', parameters: 7000000000 }
      const model2 = { name: 'llama-2-13b', parameters: 13000000000 }
      
      store.addModel(model1)
      store.addModel(model2)
      
      expect(store.totalParameters).toBe(20000000000)
    })

    it('should detect multiple models', () => {
      const store = useModelStore()
      const model1 = { name: 'llama-2-7b', size: 13.5 }
      
      expect(store.hasMultipleModels).toBe(false)
      
      store.addModel(model1)
      expect(store.hasMultipleModels).toBe(false)
      
      const model2 = { name: 'mistral-7b', size: 14.0 }
      store.addModel(model2)
      expect(store.hasMultipleModels).toBe(true)
    })

    it('should generate model specs', () => {
      const store = useModelStore()
      const model = { 
        name: 'llama-2-7b', 
        size: 13.5, 
        parameters: 7000000000,
        quantization: 'int8'
      }
      
      store.addModel(model)
      
      const specs = store.modelSpecs
      expect(specs).toHaveLength(1)
      expect(specs[0]).toEqual({
        name: 'llama-2-7b',
        parameters: 7000000000,
        size: 13.5,
        quantization: 'int8',
        architecture: 'transformer'
      })
    })

    it('should identify unique quantizations', () => {
      const store = useModelStore()
      const model1 = { name: 'model1', quantization: 'fp16' }
      const model2 = { name: 'model2', quantization: 'int8' }
      const model3 = { name: 'model3', quantization: 'fp16' }
      
      store.addModel(model1)
      store.addModel(model2)
      store.addModel(model3)
      
      expect(store.uniqueQuantizations).toEqual(['fp16', 'int8'])
    })

    it('should calculate average memory factor', () => {
      const store = useModelStore()
      const model1 = { name: 'model1', quantization: 'fp16' } // 0.5
      const model2 = { name: 'model2', quantization: 'int8' } // 0.25
      
      store.addModel(model1)
      store.addModel(model2)
      
      expect(store.averageMemoryFactor).toBe(0.375) // (0.5 + 0.25) / 2
    })
  })

  describe('Helper Functions', () => {
    it('should estimate parameters from size', () => {
      const store = useModelStore()
      
      const params = store.estimateParametersFromSize(13.5)
      expect(params).toBeGreaterThan(0)
      expect(typeof params).toBe('number')
    })

    it('should get model by name', () => {
      const store = useModelStore()
      const model = { name: 'llama-2-7b', size: 13.5 }
      
      store.addModel(model)
      
      expect(store.getModelByName('llama-2-7b')).toEqual(model)
      expect(store.getModelByName('nonexistent')).toBeUndefined()
    })

    it('should check if model exists', () => {
      const store = useModelStore()
      const model = { name: 'llama-2-7b', size: 13.5 }
      
      expect(store.hasModel('llama-2-7b')).toBe(false)
      
      store.addModel(model)
      
      expect(store.hasModel('llama-2-7b')).toBe(true)
      expect(store.hasModel('nonexistent')).toBe(false)
    })
  })

  describe('Filtering and Sorting', () => {
    beforeEach(() => {
      const store = useModelStore()
      const models = [
        { name: 'model1', size: 10, quantization: 'fp16' },
        { name: 'model2', size: 20, quantization: 'int8' },
        { name: 'model3', size: 15, quantization: 'fp16' },
        { name: 'model4', size: 5, quantization: 'int4' }
      ]
      
      models.forEach(model => store.addModel(model))
    })

    it('should filter models by quantization', () => {
      const store = useModelStore()
      
      const fp16Models = store.getModelsByQuantization('fp16')
      expect(fp16Models).toHaveLength(2)
      expect(fp16Models.every(m => m.quantization === 'fp16')).toBe(true)
      
      const int8Models = store.getModelsByQuantization('int8')
      expect(int8Models).toHaveLength(1)
    })

    it('should filter models by size range', () => {
      const store = useModelStore()
      
      const mediumModels = store.getModelsBySize(10, 20)
      expect(mediumModels).toHaveLength(3)
      expect(mediumModels.every(m => m.size >= 10 && m.size <= 20)).toBe(true)
    })

    it('should sort models by size', () => {
      const store = useModelStore()
      
      const ascending = store.sortModelsBySize(true)
      expect(ascending[0].size).toBe(5)
      expect(ascending[3].size).toBe(20)
      
      const descending = store.sortModelsBySize(false)
      expect(descending[0].size).toBe(20)
      expect(descending[3].size).toBe(5)
    })
  })

  describe('Validation', () => {
    it('should validate valid model selections', () => {
      const store = useModelStore()
      const validModels = [
        { name: 'llama-2-7b', size: 13.5 },
        { name: 'mistral-7b', size: null }
      ]
      
      expect(store.validateModelSelections(validModels)).toBe(true)
    })

    it('should reject invalid model selections', () => {
      const store = useModelStore()
      
      expect(store.validateModelSelections(null)).toBe(false)
      expect(store.validateModelSelections([])).toBe(true)
      expect(store.validateModelSelections([
        { name: 123, size: 13.5 } // Invalid name type
      ])).toBe(false)
      expect(store.validateModelSelections([
        { size: 13.5 } // Missing name
      ])).toBe(false)
    })

    it('should validate selection state', () => {
      const store = useModelStore()
      
      expect(store.hasValidModelSelection).toBe(false)
      
      const model = { name: 'llama-2-7b', size: 13.5 }
      store.addModel(model)
      
      expect(store.hasValidModelSelection).toBe(true)
    })
  })

  describe('Error and Loading States', () => {
    it('should manage loading state', () => {
      const store = useModelStore()
      
      expect(store.loading).toBe(false)
      
      store.setLoading(true)
      expect(store.loading).toBe(true)
      
      store.setLoading(false)
      expect(store.loading).toBe(false)
    })

    it('should manage error state', () => {
      const store = useModelStore()
      
      expect(store.error).toBe(null)
      
      store.setError('Test error')
      expect(store.error).toBe('Test error')
      
      store.setError(null)
      expect(store.error).toBe(null)
    })

    it('should clear error when updating selections', () => {
      const store = useModelStore()
      
      store.setError('Test error')
      expect(store.error).toBe('Test error')
      
      store.updateSelectedModels([])
      expect(store.error).toBe(null)
    })
  })
})
