/**
 * @jest-environment node
 */

import { describe, it, expect } from 'vitest'
import {
  calculateQuantizationFactor,
  getSupportedQuantizationFormats,
  compareQuantizationFormats,
  estimateQuantizationQualityImpact,
  generateQuantizationRecommendation,
  calculateModelWeightsMemory,
  QUANTIZATION_FORMATS
} from './quantization.js'

describe('Quantization Module', () => {
  describe('calculateQuantizationFactor', () => {
    it('calculates correct quantization factor for fp16', () => {
      const result = calculateQuantizationFactor('fp16')
      expect(result.format).toBe('fp16')
      expect(result.bitsPerParam).toBe(16)
      expect(result.bytesPerParam).toBe(2.0)
      expect(result.memoryFactor).toBe(0.5)
      expect(result.qualityLoss).toBe(0.02)
      expect(result.overhead).toBe(0)
    })

    it('calculates correct quantization factor for awq', () => {
      const result = calculateQuantizationFactor('awq')
      expect(result.format).toBe('awq')
      expect(result.bitsPerParam).toBe(4)
      expect(result.bytesPerParam).toBe(0.5)
      expect(result.memoryFactor).toBe(0.135) // 0.125 + 0.01 overhead
      expect(result.qualityLoss).toBe(0.03)
      expect(result.overhead).toBe(0.01)
    })

    it('excludes overhead when requested', () => {
      const result = calculateQuantizationFactor('awq', { includeOverhead: false })
      expect(result.memoryFactor).toBe(0.125)
      expect(result.overhead).toBe(0.01)
    })

    it('handles case-insensitive format names', () => {
      const result = calculateQuantizationFactor('FP16')
      expect(result.format).toBe('fp16')
    })

    it('throws error for invalid format', () => {
      expect(() => calculateQuantizationFactor('invalid')).toThrow()
    })
  })

  describe('getSupportedQuantizationFormats', () => {
    it('returns all supported formats', () => {
      const formats = getSupportedQuantizationFormats()
      expect(formats).toContain('fp16')
      expect(formats).toContain('awq')
      expect(formats).toContain('gptq')
      expect(formats).toContain('int8')
      expect(formats).toContain('int4')
      expect(formats.length).toBeGreaterThan(5)
    })
  })

  describe('compareQuantizationFormats', () => {
    it('sorts formats by memory efficiency', () => {
      const formats = ['fp16', 'awq', 'int8', 'fp32']
      const comparison = compareQuantizationFormats(formats)
      
      // Should be sorted by memory factor (lower = more efficient)
      expect(comparison[0].format).toBe('awq') // Most efficient
      expect(comparison[comparison.length - 1].format).toBe('fp32') // Least efficient
    })

    it('throws error for invalid input', () => {
      expect(() => compareQuantizationFormats('not-array')).toThrow()
    })
  })

  describe('estimateQuantizationQualityImpact', () => {
    it('calculates quality impact for small model', () => {
      const result = estimateQuantizationQualityImpact('awq', 3)
      expect(result.format).toBe('awq')
      expect(result.qualityLoss).toBeGreaterThan(0.03) // Should be adjusted up for small models
      expect(result.severity).toBeDefined()
      expect(result.recommendation).toContain('Excellent for')
    })

    it('calculates quality impact for large model', () => {
      const result = estimateQuantizationQualityImpact('awq', 13)
      expect(result.format).toBe('awq')
      expect(result.qualityLoss).toBeLessThan(0.03) // Should be adjusted down for large models
      expect(result.severity).toBe('low')
      expect(result.recommendation).toContain('Excellent for large')
    })

    it('assigns correct severity levels', () => {
      const lowImpact = estimateQuantizationQualityImpact('fp16', 7)
      const highImpact = estimateQuantizationQualityImpact('int4', 3)
      
      expect(lowImpact.severity).toBe('low')
      expect(highImpact.severity).toBe('high')
    })
  })

  describe('generateQuantizationRecommendation', () => {
    it('recommends appropriate format for sufficient VRAM', () => {
      const result = generateQuantizationRecommendation(24, 7) // 24GB VRAM, 7B model
      expect(result.canFit).toBe(true)
      expect(result.recommendedFormat).toBeDefined()
      expect(result.memoryUsageGB).toBeGreaterThan(0)
      expect(result.memoryUtilizationPercent).toBeLessThan(100)
      expect(result.reason).toBeDefined()
    })

    it('handles insufficient VRAM scenario', () => {
      const result = generateQuantizationRecommendation(4, 70) // 4GB VRAM, 70B model
      expect(result.canFit).toBe(false)
      expect(result.recommendedFormat).toBe('int4')
      expect(result.reason).toContain('too large')
    })

    it('respects priority preferences', () => {
      const qualityResult = generateQuantizationRecommendation(24, 7, { priority: 'quality' })
      const memoryResult = generateQuantizationRecommendation(24, 7, { priority: 'memory' })
      
      // Quality priority should prefer higher precision formats
      expect(['fp16', 'bf16']).toContain(qualityResult.recommendedFormat)
      
      // Memory priority should prefer more aggressive quantization
      expect(['int4', 'awq', 'gptq']).toContain(memoryResult.recommendedFormat)
    })

    it('includes breakdown information', () => {
      const result = generateQuantizationRecommendation(24, 7)
      if (result.canFit) {
        expect(result.breakdown).toBeDefined()
        expect(result.breakdown.modelWeights).toBeGreaterThan(0)
        expect(result.breakdown.kvCache).toBeGreaterThanOrEqual(0)
        expect(result.breakdown.activations).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('calculateModelWeightsMemory', () => {
    it('calculates memory for 7B model with fp16', () => {
      const result = calculateModelWeightsMemory(7, 'fp16')
      expect(result.numParams).toBe(7)
      expect(result.quantization).toBe('fp16')
      expect(result.totalMemory).toBe(14) // 7B * 2 bytes = 14GB
      expect(result.bitsPerParam).toBe(16)
      expect(result.overheadGB).toBe(0)
    })

    it('calculates memory for 7B model with awq quantization', () => {
      const result = calculateModelWeightsMemory(7, 'awq')
      expect(result.numParams).toBe(7)
      expect(result.quantization).toBe('awq')
      expect(result.baseMemoryGB).toBe(3.5) // 7B * 0.5 bytes = 3.5GB
      expect(result.overheadGB).toBe(0.035) // 1% overhead
      expect(result.totalMemory).toBe(3.535)
      expect(result.bitsPerParam).toBe(4)
    })

    it('excludes overhead when requested', () => {
      const result = calculateModelWeightsMemory(7, 'awq', { includeOverhead: false })
      expect(result.overheadGB).toBe(0)
      expect(result.totalMemory).toBe(3.5)
    })

    it('handles different model sizes', () => {
      const small = calculateModelWeightsMemory(3, 'fp16')
      const large = calculateModelWeightsMemory(70, 'fp16')
      
      expect(small.totalMemory).toBe(6)
      expect(large.totalMemory).toBe(140)
    })

    it('validates input parameters', () => {
      expect(() => calculateModelWeightsMemory(-1, 'fp16')).toThrow()
      expect(() => calculateModelWeightsMemory(7, 'invalid')).toThrow()
    })
  })

  describe('QUANTIZATION_FORMATS constant', () => {
    it('contains all expected formats', () => {
      expect(QUANTIZATION_FORMATS).toHaveProperty('fp32')
      expect(QUANTIZATION_FORMATS).toHaveProperty('fp16')
      expect(QUANTIZATION_FORMATS).toHaveProperty('bf16')
      expect(QUANTIZATION_FORMATS).toHaveProperty('int8')
      expect(QUANTIZATION_FORMATS).toHaveProperty('int4')
      expect(QUANTIZATION_FORMATS).toHaveProperty('awq')
      expect(QUANTIZATION_FORMATS).toHaveProperty('gptq')
      expect(QUANTIZATION_FORMATS).toHaveProperty('ggml')
    })

    it('has consistent format structure', () => {
      Object.values(QUANTIZATION_FORMATS).forEach(format => {
        expect(format).toHaveProperty('bitsPerParam')
        expect(format).toHaveProperty('bytesPerParam')
        expect(format).toHaveProperty('memoryEfficiency')
        expect(format).toHaveProperty('qualityLoss')
        expect(format).toHaveProperty('description')
        expect(typeof format.bitsPerParam).toBe('number')
        expect(typeof format.bytesPerParam).toBe('number')
        expect(typeof format.memoryEfficiency).toBe('number')
        expect(typeof format.qualityLoss).toBe('number')
        expect(typeof format.description).toBe('string')
      })
    })
  })

  describe('Edge Cases and Boundary Testing', () => {
    it('handles extremely small models (< 1B parameters)', () => {
      const result = calculateModelWeightsMemory(0.1, 'fp16') // 100M parameters
      expect(result.totalMemory).toBeCloseTo(0.2, 1) // 100M * 2 bytes = 0.2GB
    })

    it('handles extremely large models (> 100B parameters)', () => {
      const result = calculateModelWeightsMemory(175, 'fp16') // GPT-3 size
      expect(result.totalMemory).toBeCloseTo(350, 1) // 175B * 2 bytes = 350GB
    })

    it('compares all supported quantization formats', () => {
      const formats = getSupportedQuantizationFormats()
      const comparison = compareQuantizationFormats(formats)
      
      expect(comparison.length).toBe(formats.length)
      
      comparison.forEach(result => {
        expect(result.format).toBeTypeOf('string')
        expect(result.memoryFactor).toBeGreaterThan(0)
        expect(result.qualityLoss).toBeGreaterThanOrEqual(0)
        expect(result.bitsPerParam).toBeGreaterThan(0)
        expect(result.bitsPerParam).toBeLessThanOrEqual(32)
      })
    })

    it('validates format ordering by memory efficiency', () => {
      const formats = ['fp32', 'fp16', 'awq', 'gptq', 'int4']
      const factors = formats.map(format => {
        // Exclude overhead to test base memory efficiency
        const result = calculateQuantizationFactor(format, { includeOverhead: false })
        return { format, factor: result.memoryFactor }
      })
      
      // Memory factors should generally decrease (more compression) when overhead excluded
      for (let i = 1; i < factors.length - 1; i++) {
        expect(factors[i].factor).toBeLessThanOrEqual(factors[i - 1].factor)
      }
    })
  })

  describe('Quantization Recommendations', () => {
    it('generates appropriate recommendations for different GPU memory sizes', () => {
      const testCases = [
        { memory: 8, modelSize: 7, expectedMaxFormat: 'int4' },
        { memory: 16, modelSize: 7, expectedFormats: ['int8', 'awq', 'gptq'] },
        { memory: 24, modelSize: 7, expectedFormats: ['fp16', 'awq'] },
        { memory: 80, modelSize: 7, expectedFormats: ['fp16', 'bf16'] }
      ]
      
      testCases.forEach(testCase => {
        const recommendation = generateQuantizationRecommendation(testCase.memory, testCase.modelSize)
        expect(recommendation).toHaveProperty('recommendedFormat')
        expect(recommendation).toHaveProperty('canFit')
        expect(recommendation).toHaveProperty('memoryUsageGB')
        
        if (testCase.expectedFormats) {
          expect(testCase.expectedFormats.includes(recommendation.recommendedFormat)).toBe(true)
        }
      })
    })

    it('handles large models requiring aggressive quantization', () => {
      const largeModels = [65, 175] // B parameters
      
      largeModels.forEach(modelSize => {
        const int4Result = calculateModelWeightsMemory(modelSize, 'int4')
        expect(int4Result.totalMemory).toBeGreaterThan(0)
        
        // Even with int4, very large models should still require significant memory
        if (modelSize >= 175) {
          expect(int4Result.totalMemory).toBeGreaterThan(50) // At least 50GB for 175B+ models
        }
      })
    })
  })
})
