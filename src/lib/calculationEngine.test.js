import { describe, it, expect } from 'vitest'
import { calculateVRAMUsage, canRunOnGPU } from './calculationEngine.js'

describe('calculationEngine', () => {
  describe('calculateVRAMUsage', () => {
    it('calculates basic VRAM usage correctly', () => {
      const result = calculateVRAMUsage(7, 1, 1, 2048, 1.2)
      expect(result).toBeTypeOf('number')
      expect(result).toBeGreaterThan(0)
    })

    it('applies quantization factor correctly', () => {
      const fp16Usage = calculateVRAMUsage(7, 1)
      const quantizedUsage = calculateVRAMUsage(7, 0.5)

      expect(quantizedUsage).toBeLessThan(fp16Usage)
    })

    it('increases usage with larger batch size', () => {
      const smallBatch = calculateVRAMUsage(7, 1, 1)
      const largeBatch = calculateVRAMUsage(7, 1, 4)

      expect(largeBatch).toBeGreaterThan(smallBatch)
    })

    it('throws error for invalid model size', () => {
      expect(() => calculateVRAMUsage(-1)).toThrow('Model size must be positive')
      expect(() => calculateVRAMUsage(0)).toThrow('Model size must be positive')
    })

    it('returns rounded result to 2 decimal places', () => {
      const result = calculateVRAMUsage(7.333, 1, 1, 2048, 1.2)
      const decimalPlaces = (result.toString().split('.')[1] || '').length
      expect(decimalPlaces).toBeLessThanOrEqual(2)
    })
  })

  describe('canRunOnGPU', () => {
    it('returns true when GPU has enough VRAM', () => {
      expect(canRunOnGPU(24, 20)).toBe(true)
      expect(canRunOnGPU(24, 24)).toBe(true)
    })

    it('returns false when GPU does not have enough VRAM', () => {
      expect(canRunOnGPU(24, 25)).toBe(false)
      expect(canRunOnGPU(8, 16)).toBe(false)
    })

    it('handles edge cases', () => {
      expect(canRunOnGPU(0, 0)).toBe(true)
      expect(canRunOnGPU(0, 1)).toBe(false)
    })
  })
})
