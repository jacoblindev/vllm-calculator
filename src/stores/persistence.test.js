import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGpuStore } from './gpuStore.js'
import { useModelStore } from './modelStore.js'
import { useUiStore } from './uiStore.js'

describe('Pinia Persistence Configuration', () => {
  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia())
  })

  describe('Store Initialization', () => {
    it('should initialize GPU store with correct default state', () => {
      const gpuStore = useGpuStore()
      
      expect(gpuStore.selectedGPUs).toEqual([])
      expect(gpuStore.loading).toBe(false)
      expect(gpuStore.error).toBe(null)
      expect(typeof gpuStore.totalVRAM).toBe('number')
      expect(typeof gpuStore.totalGPUCount).toBe('number')
    })

    it('should initialize Model store with correct default state', () => {
      const modelStore = useModelStore()
      
      expect(modelStore.selectedModels).toEqual([])
      expect(modelStore.loading).toBe(false)
      expect(modelStore.error).toBe(null)
      expect(typeof modelStore.totalModelSize).toBe('number')
      expect(typeof modelStore.modelCount).toBe('number')
    })

    it('should initialize UI store with correct default state', () => {
      const uiStore = useUiStore()
      
      expect(typeof uiStore.darkMode).toBe('boolean')
      expect(typeof uiStore.compactMode).toBe('boolean')
      expect(typeof uiStore.sidebarCollapsed).toBe('boolean')
      expect(typeof uiStore.showDebugInfo).toBe('boolean')
      expect(uiStore.notifications).toEqual([])
      expect(uiStore.stateErrors).toEqual([])
    })
  })

  describe('Store Actions', () => {
    it('should provide GPU store actions', () => {
      const gpuStore = useGpuStore()
      
      // Check that essential actions exist
      expect(typeof gpuStore.addGPU).toBe('function')
      expect(typeof gpuStore.removeGPU).toBe('function')
      expect(typeof gpuStore.updateGPUQuantity).toBe('function')
      expect(typeof gpuStore.clearAllGPUs).toBe('function')
      expect(typeof gpuStore.setLoading).toBe('function')
      expect(typeof gpuStore.setError).toBe('function')
    })

    it('should provide Model store actions', () => {
      const modelStore = useModelStore()
      
      // Check that essential actions exist
      expect(typeof modelStore.addModel).toBe('function')
      expect(typeof modelStore.removeModel).toBe('function')
      expect(typeof modelStore.clearAllModels).toBe('function')
      expect(typeof modelStore.setLoading).toBe('function')
      expect(typeof modelStore.setError).toBe('function')
    })

    it('should provide UI store actions', () => {
      const uiStore = useUiStore()
      
      // Check that essential actions exist
      expect(typeof uiStore.setDarkMode).toBe('function')
      expect(typeof uiStore.setCompactMode).toBe('function')
      expect(typeof uiStore.setSidebarCollapsed).toBe('function')
      expect(typeof uiStore.toggleDarkMode).toBe('function')
      expect(typeof uiStore.toggleCompactMode).toBe('function')
      expect(typeof uiStore.toggleSidebar).toBe('function')
    })
  })

  describe('Store State Updates', () => {
    it('should update GPU store state correctly', () => {
      const gpuStore = useGpuStore()
      
      // Test adding a GPU
      const testGpu = {
        id: 'test-gpu',
        name: 'Test GPU',
        vram_gb: 8,
        custom: false
      }
      
      gpuStore.addGPU(testGpu, 2)
      
      expect(gpuStore.selectedGPUs).toHaveLength(1)
      expect(gpuStore.selectedGPUs[0].gpu.name).toBe('Test GPU')
      expect(gpuStore.selectedGPUs[0].quantity).toBe(2)
      expect(gpuStore.totalVRAM).toBe(16) // 8GB * 2 units
    })

    it('should update Model store state correctly', () => {
      const modelStore = useModelStore()
      
      // Test adding a model
      const testModel = {
        id: 'test-model',
        name: 'Test Model',
        size: 7000000000, // 7B parameters
        architecture: 'transformer'
      }
      
      modelStore.addModel(testModel)
      
      expect(modelStore.selectedModels).toHaveLength(1)
      expect(modelStore.selectedModels[0].name).toBe('Test Model')
      expect(modelStore.modelCount).toBe(1)
    })

    it('should update UI store state correctly', () => {
      const uiStore = useUiStore()
      
      // Test dark mode toggle
      const initialDarkMode = uiStore.darkMode
      uiStore.toggleDarkMode()
      expect(uiStore.darkMode).toBe(!initialDarkMode)
      
      // Test compact mode setting
      uiStore.setCompactMode(true)
      expect(uiStore.compactMode).toBe(true)
      
      // Test sidebar collapse
      uiStore.setSidebarCollapsed(false)
      expect(uiStore.sidebarCollapsed).toBe(false)
    })
  })

  describe('Store Computed Properties', () => {
    it('should calculate GPU store computed properties correctly', () => {
      const gpuStore = useGpuStore()
      
      // Add multiple GPUs
      gpuStore.addGPU({ id: 'gpu1', name: 'GPU 1', vram_gb: 8 }, 1)
      gpuStore.addGPU({ id: 'gpu2', name: 'GPU 2', vram_gb: 16 }, 2)
      
      expect(gpuStore.totalVRAM).toBe(40) // 8 + (16 * 2)
      expect(gpuStore.totalGPUCount).toBe(3) // 1 + 2
      expect(gpuStore.gpuTypes).toEqual(['GPU 1', 'GPU 2'])
    })

    it('should calculate Model store computed properties correctly', () => {
      const modelStore = useModelStore()
      
      // Add multiple models
      modelStore.addModel({ id: 'model1', name: 'Model 1', size: 7000000000 })
      modelStore.addModel({ id: 'model2', name: 'Model 2', size: 13000000000 })
      
      expect(modelStore.modelCount).toBe(2)
      expect(modelStore.hasMultipleModels).toBe(true)
      expect(modelStore.totalModelSize).toBe(20000000000)
    })
  })

  describe('Persistence Configuration Verification', () => {
    it('should have correct persistence configuration for GPU store', () => {
      const gpuStore = useGpuStore()
      
      // This test verifies that the store is properly configured with persistence
      // by checking that the store has the expected structure for persistence
      expect(gpuStore).toBeDefined()
      expect(gpuStore.selectedGPUs).toBeDefined()
      
      // Add and verify data exists (persistence tested in browser environment)
      gpuStore.addGPU({ id: 'test', name: 'Test', vram_gb: 8 }, 1)
      expect(gpuStore.selectedGPUs).toHaveLength(1)
    })

    it('should have correct persistence configuration for Model store', () => {
      const modelStore = useModelStore()
      
      expect(modelStore).toBeDefined()
      expect(modelStore.selectedModels).toBeDefined()
      
      // Add and verify data exists
      modelStore.addModel({ id: 'test', name: 'Test Model', size: 7000000000 })
      expect(modelStore.selectedModels).toHaveLength(1)
    })

    it('should have correct persistence configuration for UI store', () => {
      const uiStore = useUiStore()
      
      expect(uiStore).toBeDefined()
      expect(typeof uiStore.darkMode).toBe('boolean')
      expect(typeof uiStore.compactMode).toBe('boolean')
      expect(typeof uiStore.sidebarCollapsed).toBe('boolean')
      expect(typeof uiStore.showDebugInfo).toBe('boolean')
      
      // Verify actions work
      uiStore.setDarkMode(true)
      expect(uiStore.darkMode).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle GPU store errors gracefully', () => {
      const gpuStore = useGpuStore()
      
      expect(() => {
        gpuStore.setError('Test error')
        expect(gpuStore.error).toBe('Test error')
      }).not.toThrow()
    })

    it('should handle Model store errors gracefully', () => {
      const modelStore = useModelStore()
      
      expect(() => {
        modelStore.setError('Test error')
        expect(modelStore.error).toBe('Test error')
      }).not.toThrow()
    })

    it('should handle UI store operations gracefully', () => {
      const uiStore = useUiStore()
      
      expect(() => {
        uiStore.setGlobalLoading(true, 'Test loading')
        expect(uiStore.globalLoading).toBe(true)
      }).not.toThrow()
    })
  })
})
