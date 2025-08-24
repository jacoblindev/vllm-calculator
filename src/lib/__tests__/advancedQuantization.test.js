import { describe, it, expect } from 'vitest'
import {
  calculateQuantizationFactor,
  calculateModelWeightsMemory,
  generateQuantizationRecommendation,
  analyzeQuantizationBenefit,
  estimateQuantizationQualityImpact,
  getSupportedQuantizationFormats,
  compareQuantizationFormats,
} from '../calculationEngine.js'

describe('Advanced Quantization Scenarios', () => {
  describe('Quantization Format Comprehensive Testing', () => {
    it('tests all advanced quantization formats', () => {
      const advancedFormats = [
        'awq-gemm',
        'gptq-exllama',
        'ggml',
      ]
      
      advancedFormats.forEach(format => {
        const result = calculateQuantizationFactor(format)
        expect(result.format).toBe(format)
        expect(result.memoryFactor).toBeGreaterThan(0)
        expect(result.memoryFactor).toBeLessThanOrEqual(1)
        expect(result.qualityLoss).toBeGreaterThanOrEqual(0)
        expect(result.qualityLoss).toBeLessThanOrEqual(1)
      })
    })

    it('tests memory factor ordering for quantization quality', () => {
      const formatsByQuality = [
        'fp32',    // Highest quality, most memory
        'fp16',    // Good quality, moderate memory
        'awq',     // Good balance
        'gptq',    // Good compression
        'int4'     // Highest compression, lowest quality
      ]
      
      const factors = formatsByQuality.map(format => {
        const result = calculateQuantizationFactor(format)
        return { format, factor: result.memoryFactor, quality: result.qualityLoss }
      })
      
      // Memory factors should generally decrease (more compression)
      for (let i = 1; i < factors.length - 1; i++) {
        expect(factors[i].factor).toBeLessThanOrEqual(factors[i - 1].factor)
      }
    })

    it('validates quantization recommendations for different model sizes', () => {
      const modelSizes = [1, 3, 7, 13, 30, 65, 175]
      const gpuMemories = [8, 16, 24, 48, 80]
      
      modelSizes.forEach(modelSize => {
        gpuMemories.forEach(gpuMemory => {
          const recommendation = generateQuantizationRecommendation(gpuMemory, modelSize)
          
          expect(recommendation.recommendedFormat).toBeTypeOf('string')
          expect(recommendation.canFit).toBeTypeOf('boolean')
          expect(recommendation.reason).toBeTypeOf('string')
          expect(recommendation.qualityImpact).toBeGreaterThanOrEqual(0)
          
          // If it can fit, memory usage should be reasonable
          if (recommendation.canFit) {
            expect(recommendation.memoryUsageGB).toBeLessThanOrEqual(gpuMemory)
          }
        })
      })
    })
  })

  describe('Quantization Quality Analysis', () => {
    it('analyzes quality trade-offs across quantization methods', () => {
      const formats = ['fp16', 'awq', 'gptq', 'int8', 'int4']
      const modelSize = 7
      
      formats.forEach(format => {
        const qualityImpact = estimateQuantizationQualityImpact(format, modelSize)
        
        expect(qualityImpact.format).toBe(format)
        expect(qualityImpact.impactLevel).toBeTypeOf('string')
        expect(['minimal', 'low', 'moderate', 'high', 'significant'].includes(qualityImpact.impactLevel)).toBe(true)
        expect(qualityImpact.recommendation).toBeTypeOf('string')
      })
    })

    it('validates quantization benefit analysis', () => {
      const testCases = [
        { modelSize: 7, format: 'fp16', expectedEfficient: true },
        { modelSize: 7, format: 'awq', expectedEfficient: true },
        { modelSize: 13, format: 'gptq', expectedEfficient: true },
        { modelSize: 30, format: 'int4', expectedEfficient: true },
      ]
      
      testCases.forEach(testCase => {
        const weights = calculateModelWeightsMemory(testCase.modelSize, testCase.format)
        const analysis = analyzeQuantizationBenefit(weights, testCase.format)
        
        expect(analysis.format).toBe(testCase.format)
        expect(analysis.efficiency).toBeGreaterThan(0)
        expect(analysis.efficiency).toBeLessThanOrEqual(1)
        expect(analysis.isRecommended).toBeTypeOf('boolean')
        expect(analysis.bitsPerParam).toBeGreaterThan(0)
      })
    })
  })

  describe('Extreme Quantization Scenarios', () => {
    it('handles very large models with aggressive quantization', () => {
      const largeModels = [65, 175, 340, 1000] // B parameters
      
      largeModels.forEach(modelSize => {
        const int4Result = calculateModelWeightsMemory(modelSize, 'int4')
        expect(int4Result.totalMemory).toBeGreaterThan(0)
        expect(int4Result.quantization.format).toBe('int4')
        
        // Even with int4, very large models should still require significant memory
        if (modelSize >= 175) {
          expect(int4Result.totalMemory).toBeGreaterThan(50) // At least 50GB for 175B+ models
        }
      })
    })

    it('compares memory efficiency across all quantization methods', () => {
      const formats = getSupportedQuantizationFormats()
      const comparison = compareQuantizationFormats(formats)
      
      expect(comparison.length).toBe(formats.length)
      
      // Each format should have required fields
      comparison.forEach(result => {
        expect(result.format).toBeTypeOf('string')
        expect(result.memoryFactor).toBeGreaterThan(0)
        expect(result.qualityLoss).toBeGreaterThanOrEqual(0)
        expect(result.bitsPerParam).toBeGreaterThan(0)
        expect(result.bitsPerParam).toBeLessThanOrEqual(32)
      })
      
      // Check for reasonable ordering by memory efficiency
      const sortedByMemory = comparison.sort((a, b) => b.memoryFactor - a.memoryFactor)
      expect(sortedByMemory[0].format).toMatch(/fp32|fp16/) // Highest memory usage should be fp32 or fp16
    })

    it('validates overhead calculations for quantization methods', () => {
      const formatsWithOverhead = ['awq', 'gptq', 'awq-gemm', 'gptq-exllama']
      
      formatsWithOverhead.forEach(format => {
        const withOverhead = calculateModelWeightsMemory(7, format, { includeOverhead: true })
        const withoutOverhead = calculateModelWeightsMemory(7, format, { includeOverhead: false })
        
        expect(withOverhead.totalMemory).toBeGreaterThanOrEqual(withoutOverhead.totalMemory)
        expect(withOverhead.overhead).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Quantization Performance Optimization', () => {
    it('recommends optimal quantization for different GPU tiers', () => {
      const gpuTiers = [
        { memory: 16, tier: 'prosumer', expectedFormats: ['int8', 'awq', 'gptq', 'fp16'] },
        { memory: 24, tier: 'professional', expectedFormats: ['fp16', 'awq', 'gptq'] },
        { memory: 48, tier: 'workstation', expectedFormats: ['fp16', 'bf16'] },
        { memory: 80, tier: 'datacenter', expectedFormats: ['fp16', 'bf16', 'fp32'] },
      ]
      
      const testModelSize = 7 // 7B parameter model
      
      gpuTiers.forEach(gpu => {
        const recommendation = generateQuantizationRecommendation(gpu.memory, testModelSize)
        
        expect(recommendation.canFit).toBe(true) // 7B should fit on 16GB+ GPUs with proper quantization
        expect(gpu.expectedFormats.includes(recommendation.recommendedFormat)).toBe(true)
      })

      // Test edge case for 8GB GPU
      const smallGpuRecommendation = generateQuantizationRecommendation(8, 7)
      expect(smallGpuRecommendation.recommendedFormat).toBe('int4')
      expect(smallGpuRecommendation.memoryUsageGB).toBeLessThan(8)
      // Note: May not fit due to overhead calculations, but should suggest most efficient format
    })

    it('validates quantization recommendations scale with model size', () => {
      const fixedGpuMemory = 24 // RTX 4090
      const modelSizes = [1, 3, 7, 13, 30]
      
      let previousRecommendation = null
      
      modelSizes.forEach(modelSize => {
        const recommendation = generateQuantizationRecommendation(fixedGpuMemory, modelSize)
        
        if (previousRecommendation && recommendation.canFit && previousRecommendation.canFit) {
          // Larger models should require equal or more aggressive quantization
          const currentFactor = calculateQuantizationFactor(recommendation.recommendedFormat).memoryFactor
          const previousFactor = calculateQuantizationFactor(previousRecommendation.recommendedFormat).memoryFactor
          
          expect(currentFactor).toBeLessThanOrEqual(previousFactor * 1.1) // Allow small tolerance
        }
        
        previousRecommendation = recommendation
      })
    })
  })

  describe('Quantization Edge Cases', () => {
    it('handles unsupported quantization gracefully', () => {
      expect(() => calculateQuantizationFactor('nonexistent-format')).toThrow()
      expect(() => calculateModelWeightsMemory(7, 'invalid-quant')).toThrow()
    })

    it('validates quantization factor bounds', () => {
      const formats = getSupportedQuantizationFormats()
      
      formats.forEach(format => {
        const result = calculateQuantizationFactor(format)
        
        // Memory factor should be between 0 and 1 (except fp32 which might be 1.0)
        expect(result.memoryFactor).toBeGreaterThan(0)
        expect(result.memoryFactor).toBeLessThanOrEqual(1.0)
        
        // Quality loss should be between 0 and 1
        expect(result.qualityLoss).toBeGreaterThanOrEqual(0)
        expect(result.qualityLoss).toBeLessThanOrEqual(1)
        
        // Bits per parameter should be reasonable
        expect(result.bitsPerParam).toBeGreaterThan(0)
        expect(result.bitsPerParam).toBeLessThanOrEqual(32)
      })
    })

    it('tests quantization with fractional model sizes', () => {
      const fractionalSizes = [0.5, 1.3, 6.9, 13.7]
      const format = 'awq'
      
      fractionalSizes.forEach(size => {
        const result = calculateModelWeightsMemory(size, format)
        expect(result.totalMemory).toBeGreaterThan(0)
        expect(result.quantization.format).toBe(format)
        
        // Should scale linearly with model size
        const scaledResult = calculateModelWeightsMemory(size * 2, format)
        expect(scaledResult.totalMemory).toBeCloseTo(result.totalMemory * 2, 1)
      })
    })
  })
})
