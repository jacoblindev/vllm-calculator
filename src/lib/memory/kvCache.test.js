/**
 * @jest-environment node
 */

import { describe, it, expect } from 'vitest'
import {
  calculateKVCacheMemory,
  calculateKVCacheBreakdown,
  estimateOptimalKVCacheBlockSize,
  calculateKVCacheScaling,
  validateKVCacheConfig,
  getSupportedKVCachePrecisions,
  KV_PRECISION_FORMATS
} from './kvCache.js'

describe('KV Cache Memory Module', () => {
  describe('calculateKVCacheMemory', () => {
    it('calculates KV cache memory correctly for fp16', () => {
      const result = calculateKVCacheMemory(32, 2048, 32, 4096, 32, 'fp16')
      
      // Expected: 2 * 32 * 2048 * 32 * 4096 * 2 bytes = 34,359,738,368 bytes = 32GB
      expect(result).toBeCloseTo(32, 1)
    })

    it('calculates KV cache memory correctly for fp32', () => {
      const result = calculateKVCacheMemory(16, 1024, 24, 2048, 16, 'fp32')
      
      // Expected: 2 * 16 * 1024 * 24 * 2048 * 4 bytes = 6,442,450,944 bytes = 6GB
      expect(result).toBeCloseTo(6, 1)
    })

    it('calculates KV cache memory correctly for int8', () => {
      const result = calculateKVCacheMemory(8, 512, 12, 768, 12, 'int8')
      
      // Expected: 2 * 8 * 512 * 12 * 768 * 1 byte = 75,497,472 bytes = 0.07GB
      expect(result).toBeCloseTo(0.07, 2)
    })

    it('throws error for invalid parameters', () => {
      expect(() => calculateKVCacheMemory(0, 2048, 32, 4096, 32)).toThrow('batchSize must be at least 0.000001')
      expect(() => calculateKVCacheMemory(32, -1, 32, 4096, 32)).toThrow('maxSeqLen must be at least 0.000001')
      expect(() => calculateKVCacheMemory(32, 2048, 0, 4096, 32)).toThrow('numLayers must be at least 0.000001')
    })

    it('throws error for unsupported precision', () => {
      expect(() => calculateKVCacheMemory(32, 2048, 32, 4096, 32, 'invalid')).toThrow('Unsupported KV precision: invalid')
    })
  })

  describe('calculateKVCacheBreakdown', () => {
    it('provides detailed KV cache breakdown', () => {
      const config = {
        batchSize: 16,
        maxSeqLen: 1024,
        numLayers: 24,
        hiddenSize: 2048,
        numHeads: 16,
        kvPrecision: 'fp16'
      }

      const result = calculateKVCacheBreakdown(config)

      expect(result).toHaveProperty('totalMemoryGB')
      expect(result).toHaveProperty('breakdown')
      expect(result).toHaveProperty('perComponent')
      expect(result).toHaveProperty('memoryCalculation')
      
      expect(result.breakdown.batchSize).toBe(16)
      expect(result.breakdown.kvPrecision).toBe('fp16')
      expect(result.breakdown.precisionBytes).toBe(2)
      
      expect(result.perComponent.perLayerGB).toBeGreaterThan(0)
      expect(result.perComponent.perSequenceGB).toBeGreaterThan(0)
      expect(result.perComponent.perTokenGB).toBeGreaterThan(0)
    })

    it('validates required config fields', () => {
      const incompleteConfig = {
        batchSize: 16,
        // missing required fields
      }

      expect(() => calculateKVCacheBreakdown(incompleteConfig)).toThrow()
    })
  })

  describe('estimateOptimalKVCacheBlockSize', () => {
    it('recommends appropriate block sizes for different memory sizes', () => {
      const smallCache = estimateOptimalKVCacheBlockSize(2, 'latency')
      const mediumCache = estimateOptimalKVCacheBlockSize(8, 'balanced')
      const largeCache = estimateOptimalKVCacheBlockSize(20, 'throughput')

      expect(smallCache).toBeLessThanOrEqual(16)
      expect(mediumCache).toBeGreaterThanOrEqual(16)
      expect(largeCache).toBeGreaterThanOrEqual(24)
    })

    it('handles different optimization targets', () => {
      const latencyBlockSize = estimateOptimalKVCacheBlockSize(10, 'latency')
      const throughputBlockSize = estimateOptimalKVCacheBlockSize(10, 'throughput')

      expect(latencyBlockSize).toBeLessThanOrEqual(throughputBlockSize)
    })

    it('falls back to balanced for unknown targets', () => {
      const balancedSize = estimateOptimalKVCacheBlockSize(10, 'balanced')
      const unknownSize = estimateOptimalKVCacheBlockSize(10, 'unknown')

      expect(unknownSize).toBe(balancedSize)
    })
  })

  describe('calculateKVCacheScaling', () => {
    it('calculates KV cache scaling for different batch sizes', () => {
      const baseConfig = {
        maxSeqLen: 1024,
        numLayers: 24,
        hiddenSize: 2048,
        numHeads: 16,
        kvPrecision: 'fp16'
      }
      const batchSizes = [1, 8, 16, 32]

      const result = calculateKVCacheScaling(baseConfig, batchSizes)

      expect(result).toHaveLength(4)
      expect(result[0].batchSize).toBe(1)
      expect(result[3].batchSize).toBe(32)
      
      // Memory should scale linearly with batch size
      expect(result[1].kvCacheMemoryGB).toBeCloseTo(result[0].kvCacheMemoryGB * 8, 1)
      expect(result[2].kvCacheMemoryGB).toBeCloseTo(result[0].kvCacheMemoryGB * 16, 1)
      expect(result[3].kvCacheMemoryGB).toBeCloseTo(result[0].kvCacheMemoryGB * 32, 1)
    })

    it('validates input parameters', () => {
      const incompleteConfig = { maxSeqLen: 1024 }
      const batchSizes = [1, 8, 16]

      expect(() => calculateKVCacheScaling(incompleteConfig, batchSizes)).toThrow()
      expect(() => calculateKVCacheScaling({}, 'not-array')).toThrow()
    })
  })

  describe('validateKVCacheConfig', () => {
    it('validates a good KV cache configuration', () => {
      const config = {
        batchSize: 16,
        maxSeqLen: 2048,
        numLayers: 24,
        hiddenSize: 2048,
        numHeads: 16,
        kvPrecision: 'fp16',
        totalVRAMGB: 80
      }

      const result = validateKVCacheConfig(config)

      expect(result.isValid).toBe(true)
      expect(result.totalKVCacheMemoryGB).toBeGreaterThan(0)
      expect(result.warnings).toHaveLength(0)
      expect(result.config.recommendedBlockSize).toBeGreaterThan(0)
    })

    it('identifies problematic configurations', () => {
      const problemConfig = {
        batchSize: 128, // Large batch
        maxSeqLen: 16384, // Very long sequences
        numLayers: 80,
        hiddenSize: 8192,
        numHeads: 64,
        kvPrecision: 'fp32', // Memory-intensive precision
        totalVRAMGB: 24 // Limited VRAM
      }

      const result = validateKVCacheConfig(problemConfig)

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it('provides recommendations for optimization', () => {
      const fp32Config = {
        batchSize: 2,
        maxSeqLen: 10000,
        numLayers: 24,
        hiddenSize: 2048,
        numHeads: 16,
        kvPrecision: 'fp32'
      }

      const result = validateKVCacheConfig(fp32Config)

      expect(result.recommendations).toContain(
        'Consider using fp16 instead of fp32 for KV cache to save memory with minimal quality impact.'
      )
      expect(result.recommendations).toContain(
        'Very long sequences increase memory usage significantly. Consider enabling chunked prefill.'
      )
    })
  })

  describe('getSupportedKVCachePrecisions', () => {
    it('returns all supported precision formats', () => {
      const precisions = getSupportedKVCachePrecisions()

      expect(precisions).toHaveProperty('fp16')
      expect(precisions).toHaveProperty('fp32')
      expect(precisions).toHaveProperty('bf16')
      expect(precisions).toHaveProperty('int8')
      
      expect(precisions.fp16.bytes).toBe(2)
      expect(precisions.fp32.bytes).toBe(4)
      expect(precisions.int8.bytes).toBe(1)
    })
  })

  describe('KV_PRECISION_FORMATS constant', () => {
    it('contains expected precision formats', () => {
      expect(KV_PRECISION_FORMATS).toHaveProperty('fp16')
      expect(KV_PRECISION_FORMATS).toHaveProperty('fp32')
      expect(KV_PRECISION_FORMATS).toHaveProperty('bf16')
      expect(KV_PRECISION_FORMATS).toHaveProperty('int8')
    })

    it('has consistent format structure', () => {
      Object.values(KV_PRECISION_FORMATS).forEach(format => {
        expect(format).toHaveProperty('bytes')
        expect(format).toHaveProperty('description')
        expect(typeof format.bytes).toBe('number')
        expect(typeof format.description).toBe('string')
      })
    })
  })

  describe('Integration tests', () => {
    it('works end-to-end for typical vLLM scenario', () => {
      // Typical 7B model with moderate batch size
      const config = {
        batchSize: 32,
        maxSeqLen: 2048,
        numLayers: 32,
        hiddenSize: 4096,
        numHeads: 32,
        kvPrecision: 'fp16',
        totalVRAMGB: 80
      }

      const breakdown = calculateKVCacheBreakdown(config)
      const validation = validateKVCacheConfig(config)
      const blockSize = estimateOptimalKVCacheBlockSize(breakdown.totalMemoryGB)

      expect(breakdown.totalMemoryGB).toBeGreaterThan(0)
      expect(breakdown.totalMemoryGB).toBeLessThan(80) // Should fit in 80GB
      expect(validation.isValid).toBe(true)
      expect(blockSize).toBeGreaterThanOrEqual(16)
      expect(blockSize).toBeLessThanOrEqual(32)
    })

    it('handles memory-constrained scenario', () => {
      // Large model on smaller GPU
      const config = {
        batchSize: 8,
        maxSeqLen: 1024,
        numLayers: 40,
        hiddenSize: 5120,
        numHeads: 40,
        kvPrecision: 'fp16',
        totalVRAMGB: 24
      }

      const validation = validateKVCacheConfig(config)
      const scaling = calculateKVCacheScaling(config, [4, 8, 16])

      // Should still be valid but with warnings/recommendations
      expect(validation.totalKVCacheMemoryGB).toBeGreaterThan(0)
      expect(scaling).toHaveLength(3)
      expect(scaling[2].kvCacheMemoryGB).toBeGreaterThan(scaling[0].kvCacheMemoryGB)
    })
  })
})
