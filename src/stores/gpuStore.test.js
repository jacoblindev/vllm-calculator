import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGpuStore } from './gpuStore.js'

describe('GPU Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      const store = useGpuStore()
      
      expect(store.selectedGPUs).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBe(null)
      expect(store.totalVRAM).toBe(0)
      expect(store.totalGPUCount).toBe(0)
      expect(store.hasValidGPUSelection).toBe(false)
    })
  })

  describe('GPU Selection Management', () => {
    it('should add a new GPU selection', () => {
      const store = useGpuStore()
      const gpu = { name: 'RTX 4090', vram_gb: 24 }
      
      store.addGPU(gpu, 2)
      
      expect(store.selectedGPUs).toHaveLength(1)
      expect(store.selectedGPUs[0].gpu).toEqual(gpu)
      expect(store.selectedGPUs[0].quantity).toBe(2)
      expect(store.totalVRAM).toBe(48)
      expect(store.totalGPUCount).toBe(2)
    })

    it('should update quantity for existing GPU', () => {
      const store = useGpuStore()
      const gpu = { name: 'RTX 4090', vram_gb: 24 }
      
      store.addGPU(gpu, 1)
      store.addGPU(gpu, 1) // Add another one
      
      expect(store.selectedGPUs).toHaveLength(1)
      expect(store.selectedGPUs[0].quantity).toBe(2)
      expect(store.totalVRAM).toBe(48)
    })

    it('should remove GPU selection', () => {
      const store = useGpuStore()
      const gpu = { name: 'RTX 4090', vram_gb: 24 }
      
      store.addGPU(gpu, 2)
      store.removeGPU('RTX 4090')
      
      expect(store.selectedGPUs).toHaveLength(0)
      expect(store.totalVRAM).toBe(0)
    })

    it('should update GPU quantity', () => {
      const store = useGpuStore()
      const gpu = { name: 'RTX 4090', vram_gb: 24 }
      
      store.addGPU(gpu, 1)
      store.updateGPUQuantity('RTX 4090', 3)
      
      expect(store.selectedGPUs[0].quantity).toBe(3)
      expect(store.totalVRAM).toBe(72)
    })

    it('should remove GPU when quantity set to 0', () => {
      const store = useGpuStore()
      const gpu = { name: 'RTX 4090', vram_gb: 24 }
      
      store.addGPU(gpu, 2)
      store.updateGPUQuantity('RTX 4090', 0)
      
      expect(store.selectedGPUs).toHaveLength(0)
    })

    it('should clear all GPUs', () => {
      const store = useGpuStore()
      const gpu1 = { name: 'RTX 4090', vram_gb: 24 }
      const gpu2 = { name: 'A100', vram_gb: 80 }
      
      store.addGPU(gpu1, 1)
      store.addGPU(gpu2, 1)
      store.clearAllGPUs()
      
      expect(store.selectedGPUs).toHaveLength(0)
      expect(store.totalVRAM).toBe(0)
    })
  })

  describe('Computed Properties', () => {
    it('should calculate total VRAM correctly', () => {
      const store = useGpuStore()
      const gpu1 = { name: 'RTX 4090', vram_gb: 24 }
      const gpu2 = { name: 'A100', vram_gb: 80 }
      
      store.addGPU(gpu1, 2)
      store.addGPU(gpu2, 1)
      
      expect(store.totalVRAM).toBe(128) // 24*2 + 80*1
    })

    it('should calculate total GPU count correctly', () => {
      const store = useGpuStore()
      const gpu1 = { name: 'RTX 4090', vram_gb: 24 }
      const gpu2 = { name: 'A100', vram_gb: 80 }
      
      store.addGPU(gpu1, 2)
      store.addGPU(gpu2, 3)
      
      expect(store.totalGPUCount).toBe(5)
    })

    it('should detect custom GPUs', () => {
      const store = useGpuStore()
      const customGpu = { name: 'Custom GPU', vram_gb: 16, custom: true }
      
      expect(store.hasCustomGPUs).toBe(false)
      
      store.addGPU(customGpu, 1)
      
      expect(store.hasCustomGPUs).toBe(true)
    })

    it('should calculate estimated cost', () => {
      const store = useGpuStore()
      const gpu = { name: 'RTX 4090', vram_gb: 24 }
      
      store.addGPU(gpu, 2)
      
      expect(store.estimatedCost).toBeCloseTo(4.8) // 24 * 0.1 * 2
    })

    it('should calculate average memory bandwidth', () => {
      const store = useGpuStore()
      store.updateSelectedGPUs([])  // Clear any existing state
      
      const highEndGpu = { name: 'H100', vram_gb: 80 }  // 3500 GB/s
      const lowEndGpu = { name: 'GTX 1080', vram_gb: 8 } // 800 GB/s
      
      store.addGPU(highEndGpu, 1) 
      store.addGPU(lowEndGpu, 1)
      
      // Expected: (3500 * 1 + 800 * 1) / 2 = 2150
      expect(store.averageMemoryBandwidth).toBe(2150)
    })

    it('should generate hardware specs', () => {
      const store = useGpuStore()
      const gpu1 = { name: 'RTX 4090', vram_gb: 24 }
      const gpu2 = { name: 'A100', vram_gb: 80 }
      
      store.addGPU(gpu1, 1)
      store.addGPU(gpu2, 1)
      
      const specs = store.hardwareSpecs
      
      expect(specs.totalVRAM).toBe(104)
      expect(specs.gpuCount).toBe(2)
      expect(specs.gpuTypes).toEqual(['RTX 4090', 'A100'])
      expect(specs.memoryBandwidth).toBeGreaterThan(0)
    })
  })

  describe('Validation', () => {
    it('should validate valid GPU selections', () => {
      const store = useGpuStore()
      const validGPUs = [
        { gpu: { name: 'RTX 4090', vram_gb: 24 }, quantity: 2 }
      ]
      
      expect(store.validateGPUSelections(validGPUs)).toBe(true)
    })

    it('should reject invalid GPU selections', () => {
      const store = useGpuStore()
      
      expect(store.validateGPUSelections(null)).toBe(false)
      expect(store.validateGPUSelections([])).toBe(true) // Empty array is valid
      expect(store.validateGPUSelections([
        { gpu: { name: 'RTX 4090' }, quantity: 2 } // Missing vram_gb
      ])).toBe(false)
      expect(store.validateGPUSelections([
        { gpu: { name: 'RTX 4090', vram_gb: 24 }, quantity: 0 } // Invalid quantity
      ])).toBe(false)
    })

    it('should validate selection state', () => {
      const store = useGpuStore()
      
      expect(store.hasValidGPUSelection).toBe(false)
      
      const gpu = { name: 'RTX 4090', vram_gb: 24 }
      store.addGPU(gpu, 1)
      
      expect(store.hasValidGPUSelection).toBe(true)
    })
  })

  describe('Error and Loading States', () => {
    it('should manage loading state', () => {
      const store = useGpuStore()
      
      expect(store.loading).toBe(false)
      
      store.setLoading(true)
      expect(store.loading).toBe(true)
      
      store.setLoading(false)
      expect(store.loading).toBe(false)
    })

    it('should manage error state', () => {
      const store = useGpuStore()
      
      expect(store.error).toBe(null)
      
      store.setError('Test error')
      expect(store.error).toBe('Test error')
      
      store.setError(null)
      expect(store.error).toBe(null)
    })

    it('should clear error when updating selections', () => {
      const store = useGpuStore()
      
      store.setError('Test error')
      expect(store.error).toBe('Test error')
      
      store.updateSelectedGPUs([])
      expect(store.error).toBe(null)
    })
  })
})
