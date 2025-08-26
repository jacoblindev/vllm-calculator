import { describe, it, expect } from 'vitest'
import {
  calculateVRAMUsage,
  canRunOnGPU,
  calculateKVCacheMemory,
  calculateActivationMemory,
  estimateModelArchitecture,
  calculateVLLMMemoryUsage,
} from './calculationEngine.js'

import {
  calculateModelWeightsMemory,
  calculateQuantizationFactor,
  getSupportedQuantizationFormats,
  compareQuantizationFormats,
  estimateQuantizationQualityImpact,
  generateQuantizationRecommendation,
} from './quantization.js'

describe('calculationEngine', () => {
  describe('calculateModelWeightsMemory', () => {
    it('calculates FP16 model weights correctly', () => {
      const result = calculateModelWeightsMemory(7, 'fp16')
      expect(result.totalMemory).toBe(14) // 7B params * 2 bytes = 14GB
      expect(result.baseMemoryGB).toBe(14)
      expect(result.quantization).toBe('fp16')
      expect(result.bitsPerParam).toBe(16)
    })

    it('calculates FP32 model weights correctly', () => {
      const result = calculateModelWeightsMemory(7, 'fp32')
      expect(result.totalMemory).toBe(28) // 7B params * 4 bytes = 28GB
      expect(result.baseMemoryGB).toBe(28)
      expect(result.quantization).toBe('fp32')
      expect(result.bitsPerParam).toBe(32)
    })

    it('calculates quantized model weights correctly', () => {
      const result = calculateModelWeightsMemory(7, 'int4')
      expect(result.totalMemory).toBe(3.605) // 7B params * 0.515 bytes = 3.605GB (includes overhead)
      expect(result.baseMemoryGB).toBe(3.5)
      expect(result.quantization).toBe('int4')
      expect(result.bitsPerParam).toBe(4)
    })

    it('throws error for invalid parameters', () => {
      expect(() => calculateModelWeightsMemory(-1)).toThrow('numParams must be at least 0.000001')
      expect(() => calculateModelWeightsMemory(0)).toThrow('numParams must be at least 0.000001')
    })

    it('throws error for unsupported quantization format', () => {
      expect(() => calculateModelWeightsMemory(7, 'invalid')).toThrow('Unsupported quantization format: invalid')
    })
  })

  describe('calculateKVCacheMemory', () => {
    it('calculates KV cache memory correctly', () => {
      const result = calculateKVCacheMemory(1, 2048, 32, 4096, 32, 'fp16')
      expect(result).toBeTypeOf('number')
      expect(result).toBeGreaterThan(0)
    })

    it('scales with batch size', () => {
      const batch1 = calculateKVCacheMemory(1, 2048, 32, 4096, 32, 'fp16')
      const batch4 = calculateKVCacheMemory(4, 2048, 32, 4096, 32, 'fp16')
      expect(batch4).toBeCloseTo(batch1 * 4, 1)
    })

    it('scales with sequence length', () => {
      const seq1k = calculateKVCacheMemory(1, 1024, 32, 4096, 32, 'fp16')
      const seq2k = calculateKVCacheMemory(1, 2048, 32, 4096, 32, 'fp16')
      expect(seq2k).toBeCloseTo(seq1k * 2, 1)
    })

    it('throws error for invalid parameters', () => {
      expect(() => calculateKVCacheMemory(-1, 2048, 32, 4096, 32)).toThrow('batchSize must be at least 0.000001')
      expect(() => calculateKVCacheMemory(1, -1, 32, 4096, 32)).toThrow('maxSeqLen must be at least 0.000001')
    })
  })

  describe('calculateActivationMemory', () => {
    it('calculates activation memory correctly', () => {
      const result = calculateActivationMemory(1, 512, 4096, 32, 'fp16')
      expect(result).toBeTypeOf('number')
      expect(result).toBeGreaterThan(0)
    })

    it('scales with batch size', () => {
      const batch1 = calculateActivationMemory(1, 512, 4096, 32, 'fp16')
      const batch2 = calculateActivationMemory(2, 512, 4096, 32, 'fp16')
      expect(batch2).toBeCloseTo(batch1 * 2, 1)
    })

    it('throws error for invalid parameters', () => {
      expect(() => calculateActivationMemory(-1, 512, 4096, 32)).toThrow('batchSize must be at least 0.000001')
    })
  })

  describe('estimateModelArchitecture', () => {
    it('estimates 7B model architecture correctly', () => {
      const arch = estimateModelArchitecture(7)
      expect(arch.layers).toBe(32)
      expect(arch.hiddenSize).toBe(4096)
      expect(arch.numHeads).toBe(32)
      expect(arch.name).toBeDefined()
      expect(arch.isInterpolated).toBe(false)
    })

    it('estimates 13B model architecture correctly', () => {
      const arch = estimateModelArchitecture(13)
      expect(arch.layers).toBe(40)
      expect(arch.hiddenSize).toBe(5120)
      expect(arch.numHeads).toBe(40)
      expect(arch.name).toBeDefined()
      expect(arch.isInterpolated).toBe(false)
    })

    it('finds closest architecture for unknown sizes', () => {
      const arch = estimateModelArchitecture(8) // Should map to 7B
      expect(arch.layers).toBe(32)
      expect(arch.hiddenSize).toBe(4096)
      expect(arch.numHeads).toBe(32)
      expect(arch.name).toBeDefined()
      expect(arch.isInterpolated).toBe(false)
    })
  })

  describe('calculateVLLMMemoryUsage', () => {
    it('calculates complete memory breakdown', () => {
      const result = calculateVLLMMemoryUsage({
        modelSizeGB: 14,
        numParams: 7,
        batchSize: 1,
        maxSeqLen: 2048,
        seqLen: 512,
      })

      expect(result).toHaveProperty('breakdown.modelWeights')
      expect(result).toHaveProperty('breakdown.kvCache')
      expect(result).toHaveProperty('breakdown.activations')
      expect(result).toHaveProperty('breakdown.systemOverhead')
      expect(result).toHaveProperty('totalMemoryGB')
      expect(result).toHaveProperty('breakdown')

      expect(result.totalMemoryGB).toBeGreaterThan(result.breakdown.modelWeights)
      expect(result.memoryEfficiency).toBeDefined()
      expect(result.configuration).toBeDefined()
    })

    it('works with only model size provided', () => {
      const result = calculateVLLMMemoryUsage({
        modelSizeGB: 14,
        batchSize: 1,
        maxSeqLen: 2048,
      })

      expect(result.breakdown.modelWeights).toBe(14)
      expect(result.totalMemoryGB).toBeGreaterThan(14)
    })

    it('works with only parameter count provided', () => {
      const result = calculateVLLMMemoryUsage({
        numParams: 7,
        batchSize: 1,
        maxSeqLen: 2048,
      })

      expect(result.breakdown.modelWeights).toBe(14) // 7B * 2 bytes for fp16
      expect(result.totalMemoryGB).toBeGreaterThan(14)
    })

    it('throws error when neither modelSizeGB nor numParams provided', () => {
      expect(() =>
        calculateVLLMMemoryUsage({
          batchSize: 1,
          maxSeqLen: 2048,
        })
      ).toThrow('Either modelSizeGB or numParams must be provided')
    })

    it('uses custom architecture when provided', () => {
      const customArch = { layers: 24, hiddenSize: 2048, numHeads: 16 }
      const result = calculateVLLMMemoryUsage({
        modelSizeGB: 7,
        batchSize: 1,
        maxSeqLen: 2048,
        architecture: customArch,
      })

      expect(result.totalMemoryGB).toBeGreaterThan(0)
    })
  })

  // Legacy function tests
  describe('calculateVRAMUsage (legacy)', () => {
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

  // New quantization tests
  describe('calculateQuantizationFactor', () => {
    it('returns correct quantization info for fp16', () => {
      const result = calculateQuantizationFactor('fp16')
      expect(result.format).toBe('fp16')
      expect(result.bytesPerParam).toBe(2)
      expect(result.bitsPerParam).toBe(16)
      expect(result.memoryFactor).toBe(0.5)
      expect(result.qualityLoss).toBe(0.02)
    })

    it('returns correct quantization info for int4', () => {
      const result = calculateQuantizationFactor('int4')
      expect(result.format).toBe('int4')
      expect(result.bytesPerParam).toBe(0.5)
      expect(result.bitsPerParam).toBe(4)
      expect(result.memoryFactor).toBe(0.155) // 0.125 + 0.03 overhead
      expect(result.qualityLoss).toBe(0.15)
    })

    it('returns correct quantization info for awq', () => {
      const result = calculateQuantizationFactor('awq')
      expect(result.format).toBe('awq')
      expect(result.bytesPerParam).toBe(0.5)
      expect(result.bitsPerParam).toBe(4)
      expect(result.memoryFactor).toBe(0.135) // 0.125 + 0.01 overhead
      expect(result.qualityLoss).toBe(0.03)
    })

    it('throws error for unsupported format', () => {
      expect(() => calculateQuantizationFactor('invalid')).toThrow('Unsupported quantization format: invalid')
    })
  })

  describe('getSupportedQuantizationFormats', () => {
    it('returns array of supported formats', () => {
      const formats = getSupportedQuantizationFormats()
      expect(Array.isArray(formats)).toBe(true)
      expect(formats.length).toBeGreaterThan(0)
      expect(formats.includes('fp16')).toBe(true)
      expect(formats.includes('fp32')).toBe(true)
      expect(formats.includes('awq')).toBe(true)
      expect(formats.includes('gptq')).toBe(true)
    })
  })

  describe('compareQuantizationFormats', () => {
    it('compares memory usage correctly', () => {
      const comparison = compareQuantizationFormats(['fp32', 'fp16', 'int4'])
      expect(Array.isArray(comparison)).toBe(true)
      expect(comparison.length).toBe(3)
      
      const fp32 = comparison.find(c => c.format === 'fp32')
      const fp16 = comparison.find(c => c.format === 'fp16')
      const int4 = comparison.find(c => c.format === 'int4')
      
      expect(fp32.memoryFactor).toBe(1)
      expect(fp16.memoryFactor).toBe(0.5)
      expect(int4.memoryFactor).toBe(0.155)
    })

    it('handles empty array', () => {
      const comparison = compareQuantizationFormats([])
      expect(comparison).toEqual([])
    })

    it('throws error for invalid format', () => {
      expect(() => compareQuantizationFormats(['invalid'])).toThrow('Unsupported quantization format: invalid')
    })
  })

  describe('estimateQuantizationQualityImpact', () => {
    it('estimates quality impact correctly', () => {
      const impact = estimateQuantizationQualityImpact('fp16', 7)
      expect(impact.qualityLoss).toBe(0.02) // fp16 quality loss * 0.8 (large model) = 0.02 * 0.8 = 0.016, rounded to 0.02
      expect(impact.recommendation).toContain('Recommended for most production')
      
      const impactInt4 = estimateQuantizationQualityImpact('int4', 7)
      expect(impactInt4.qualityLoss).toBe(0.12) // int4 quality loss 0.15 * 0.8 = 0.12
      expect(impactInt4.recommendation).toContain('Extreme memory savings')
    })

    it('handles different quantization formats', () => {
      const awqImpact = estimateQuantizationQualityImpact('awq', 7)
      expect(awqImpact.qualityLoss).toBe(0.02) // awq quality loss 0.03 * 0.8 = 0.024, rounded to 0.02
      expect(awqImpact.recommendation).toContain('Excellent for')
      
      const gptqImpact = estimateQuantizationQualityImpact('gptq', 7)
      expect(gptqImpact.qualityLoss).toBe(0.04)
      expect(gptqImpact.recommendation).toContain('Good for memory-constrained')
    })
  })

  describe('generateQuantizationRecommendation', () => {
    it('recommends appropriate quantization for large GPU', () => {
      const recommendation = generateQuantizationRecommendation(40, 7)
      expect(recommendation.recommendedFormat).toBe('fp16')
      expect(recommendation.canFit).toBe(true)
      expect(recommendation.reason).toContain('Recommended for most production')
    })

    it('recommends quantization for limited GPU', () => {
      const recommendation = generateQuantizationRecommendation(8, 7) // Use 8GB for 7B model to require quantization
      expect(['awq', 'gptq', 'int8', 'int4'].includes(recommendation.recommendedFormat)).toBe(true)
      expect(recommendation.canFit).toBe(true)
      expect(recommendation.reason).toContain('memory')
    })

    it('handles insufficient VRAM cases', () => {
      const recommendation = generateQuantizationRecommendation(4, 70)
      expect(recommendation.canFit).toBe(false)
      expect(recommendation.reason).toContain('Model too large')
    })
  })
})
