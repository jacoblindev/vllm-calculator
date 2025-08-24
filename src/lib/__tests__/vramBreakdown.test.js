import { describe, it, expect } from 'vitest'
import {
  calculateVRAMBreakdown,
  calculateModelWeightsMemoryFromSize,
  calculateOptimalSwapSpace,
  calculateMemoryFragmentation,
  calculateReservedMemory,
  calculateMemoryEfficiency,
  getEfficiencyRating,
  analyzememoryPressure,
  analyzeQuantizationBenefit,
  generateMemoryOptimizationRecommendations,
  calculateOptimalBatchSizeForVRAM,
  calculateMaxConcurrentSequences,
} from '../calculationEngine.js'

describe('VRAM Breakdown Functions', () => {
  describe('calculateVRAMBreakdown', () => {
    it('should calculate comprehensive VRAM breakdown for fp16 model', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 13,
        quantization: 'fp16',
        batchSize: 32,
        maxSeqLen: 2048,
        seqLen: 512,
        kvCachePrecision: 'fp16',
      }

      const result = calculateVRAMBreakdown(config)

      expect(result).toHaveProperty('totalVRAMGB', 80)
      expect(result).toHaveProperty('breakdown')
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('analysis')
      expect(result).toHaveProperty('compatibility')

      // Check breakdown structure
      expect(result.breakdown).toHaveProperty('modelWeights')
      expect(result.breakdown).toHaveProperty('kvCache')
      expect(result.breakdown).toHaveProperty('activations')
      expect(result.breakdown).toHaveProperty('systemOverhead')
      expect(result.breakdown).toHaveProperty('fragmentation')
      expect(result.breakdown).toHaveProperty('swap')
      expect(result.breakdown).toHaveProperty('reserved')

      // Verify model weights details - for fp16, size should remain same as base
      expect(result.breakdown.modelWeights.sizeGB).toBeCloseTo(13, 1)
      expect(result.breakdown.modelWeights.quantization).toBe('fp16')
      expect(result.breakdown.modelWeights.percentage).toBeGreaterThan(0)

      // Verify KV cache details
      expect(result.breakdown.kvCache.sizeGB).toBeGreaterThan(0)
      expect(result.breakdown.kvCache.precision).toBe('fp16')
      expect(result.breakdown.kvCache.batchSize).toBe(32)
      expect(result.breakdown.kvCache.maxSeqLen).toBe(2048)

      // Verify summary calculations
      expect(result.summary.usedMemory).toBeGreaterThan(0)
      expect(result.summary.totalAllocated).toBeGreaterThan(result.summary.usedMemory)
      expect(result.summary.utilizationPercent).toBeGreaterThan(0)
      expect(result.summary.efficiency).toHaveProperty('overall')

      // Verify compatibility
      expect(result.compatibility.supportsModel).toBe(true)
      expect(result.compatibility.safetyMargin).toBeGreaterThan(0)
    })

    it('should calculate VRAM breakdown with quantization savings', () => {
      const config = {
        totalVRAMGB: 24,
        modelSizeGB: 13,
        quantization: 'awq',
        batchSize: 16,
        maxSeqLen: 2048,
      }

      const result = calculateVRAMBreakdown(config)

      expect(result.breakdown.modelWeights.quantization).toBe('awq')
      expect(result.breakdown.modelWeights.quantizationSavings).toBeGreaterThan(0)
      expect(result.breakdown.modelWeights.baseSize).toBe(13)
      expect(result.breakdown.modelWeights.sizeGB).toBeLessThan(13) // Should be smaller due to quantization

      expect(result.analysis.quantizationBenefit).toHaveProperty('format', 'awq')
      expect(result.analysis.quantizationBenefit.savingsPercent).toBeGreaterThan(0)
    })

    it('should handle numParams instead of modelSizeGB', () => {
      const config = {
        totalVRAMGB: 80,
        numParams: 7, // 7B parameters
        quantization: 'fp16',
        batchSize: 32,
      }

      const result = calculateVRAMBreakdown(config)

      expect(result.breakdown.modelWeights.sizeGB).toBeGreaterThan(0)
      expect(result.compatibility.supportsModel).toBe(true)
    })

    it('should throw error when neither modelSizeGB nor numParams provided', () => {
      const config = {
        totalVRAMGB: 80,
        quantization: 'fp16',
      }

      expect(() => calculateVRAMBreakdown(config)).toThrow('Either modelSizeGB or numParams must be provided')
    })

    it('should throw error when totalVRAMGB is invalid', () => {
      const config = {
        totalVRAMGB: 0,
        modelSizeGB: 13,
      }

      expect(() => calculateVRAMBreakdown(config)).toThrow('totalVRAMGB must be at least 0.000001')
    })

    it('should handle custom optimization strategy', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 13,
        optimizationStrategy: { priority: 'latency', workloadType: 'serving' },
      }

      const result = calculateVRAMBreakdown(config)

      expect(result.breakdown.swap.sizeGB).toBeLessThan(5) // Latency should use minimal swap
      expect(result.breakdown.reserved.sizeGB).toBeGreaterThan(3) // Latency should reserve more
    })
  })

  describe('calculateModelWeightsMemoryFromSize', () => {
    it('should calculate fp16 model weights correctly', () => {
      const result = calculateModelWeightsMemoryFromSize(13, 'fp16')

      expect(result.baseMemory).toBe(13)
      expect(result.quantizedMemory).toBeCloseTo(13, 1) // fp16 should stay same size
      expect(result.totalMemory).toBeCloseTo(13, 1)
      expect(result.quantizationSavings).toBeCloseTo(0, 1) // No savings for fp16 base
      expect(result.savingsPercent).toBeCloseTo(0, 0)
      expect(result.quantization).toBe('fp16')
    })

    it('should calculate AWQ quantization correctly', () => {
      const result = calculateModelWeightsMemoryFromSize(13, 'awq')

      expect(result.baseMemory).toBe(13)
      expect(result.quantizedMemory).toBeCloseTo(3.25, 2) // 12.5% efficiency relative to fp32 (26GB)
      expect(result.overhead).toBeGreaterThan(0) // AWQ has overhead
      expect(result.totalMemory).toBeGreaterThan(result.quantizedMemory)
      expect(result.savingsPercent).toBeGreaterThan(70) // Significant savings vs fp16 base
    })

    it('should throw error for invalid model size', () => {
      expect(() => calculateModelWeightsMemoryFromSize(0, 'fp16')).toThrow('Base model size must be positive')
      expect(() => calculateModelWeightsMemoryFromSize(-5, 'fp16')).toThrow('Base model size must be positive')
    })

    it('should throw error for unsupported quantization', () => {
      expect(() => calculateModelWeightsMemoryFromSize(13, 'unsupported')).toThrow('Unsupported quantization format: unsupported')
    })
  })

  describe('calculateOptimalSwapSpace', () => {
    it('should calculate swap space for balanced strategy', () => {
      const swapSpace = calculateOptimalSwapSpace(80, 13, { priority: 'balanced' })

      expect(swapSpace).toBeGreaterThan(0)
      expect(swapSpace).toBeLessThan(16) // Should not exceed 16GB cap
      expect(swapSpace).toBeCloseTo(8, 0) // 10% of 80GB = 8GB
    })

    it('should calculate minimal swap for latency strategy', () => {
      const swapSpace = calculateOptimalSwapSpace(80, 13, { priority: 'latency' })

      expect(swapSpace).toBeGreaterThan(0)
      expect(swapSpace).toBeLessThan(5) // Should be minimal for latency
    })

    it('should calculate higher swap for throughput batch strategy', () => {
      const swapSpace = calculateOptimalSwapSpace(80, 13, { 
        priority: 'throughput', 
        workloadType: 'batch' 
      })

      expect(swapSpace).toBeGreaterThan(10) // Should be higher for batch processing
    })

    it('should respect minimum swap requirements', () => {
      const swapSpace = calculateOptimalSwapSpace(16, 13, { priority: 'latency' })

      expect(swapSpace).toBeGreaterThanOrEqual(1) // Should be at least 1GB
    })

    it('should respect maximum swap limits', () => {
      const swapSpace = calculateOptimalSwapSpace(200, 13, { priority: 'throughput' })

      expect(swapSpace).toBeLessThanOrEqual(16) // Should not exceed 16GB cap
    })
  })

  describe('calculateMemoryFragmentation', () => {
    it('should calculate fragmentation based on VRAM size', () => {
      const fragmentation80GB = calculateMemoryFragmentation(80, 32, 2048)
      const fragmentation16GB = calculateMemoryFragmentation(16, 32, 2048)

      expect(fragmentation80GB).toBeGreaterThan(0)
      expect(fragmentation16GB).toBeGreaterThan(0)
      
      // Check fragmentation rates (percentage) rather than absolute values
      const rate80GB = (fragmentation80GB / 80) * 100
      const rate16GB = (fragmentation16GB / 16) * 100
      expect(rate16GB).toBeGreaterThan(rate80GB) // Higher fragmentation rate for smaller VRAM
    })

    it('should account for batch size effects', () => {
      const fragmentationSmallBatch = calculateMemoryFragmentation(80, 8, 2048)
      const fragmentationLargeBatch = calculateMemoryFragmentation(80, 128, 2048)

      expect(fragmentationLargeBatch).toBeGreaterThan(fragmentationSmallBatch)
    })

    it('should account for sequence length effects', () => {
      const fragmentationShortSeq = calculateMemoryFragmentation(80, 32, 512)
      const fragmentationLongSeq = calculateMemoryFragmentation(80, 32, 4096)

      expect(fragmentationLongSeq).toBeGreaterThan(fragmentationShortSeq)
    })

    it('should have minimum fragmentation floor', () => {
      const fragmentation = calculateMemoryFragmentation(4, 1, 128)

      expect(fragmentation).toBeGreaterThanOrEqual(0.1) // Minimum 0.1GB
    })
  })

  describe('calculateReservedMemory', () => {
    it('should calculate balanced reservation by default', () => {
      const reserved = calculateReservedMemory(80)

      expect(reserved).toBeCloseTo(4, 0) // 5% of 80GB = 4GB
    })

    it('should use minimal reservation for throughput', () => {
      const reserved = calculateReservedMemory(80, { priority: 'throughput' })

      expect(reserved).toBeCloseTo(2.4, 1) // 3% of 80GB = 2.4GB
    })

    it('should use higher reservation for latency', () => {
      const reserved = calculateReservedMemory(80, { priority: 'latency' })

      expect(reserved).toBeCloseTo(6.4, 1) // 8% of 80GB = 6.4GB
    })

    it('should respect minimum reservation', () => {
      const reserved = calculateReservedMemory(4, { priority: 'throughput' })

      expect(reserved).toBeGreaterThanOrEqual(0.5) // Minimum 0.5GB
    })

    it('should respect maximum reservation', () => {
      const reserved = calculateReservedMemory(200, { priority: 'conservative' })

      expect(reserved).toBeLessThanOrEqual(8) // Maximum 8GB
    })
  })

  describe('calculateMemoryEfficiency', () => {
    it('should calculate efficiency metrics correctly', () => {
      const config = {
        totalVRAMGB: 80,
        usedMemory: 56, // 70% utilization
        modelWeightsGB: 13,
        batchSize: 32,
        quantization: 'fp16',
      }

      const efficiency = calculateMemoryEfficiency(config)

      expect(efficiency).toHaveProperty('overall')
      expect(efficiency).toHaveProperty('utilization')
      expect(efficiency).toHaveProperty('modelRatio')
      expect(efficiency).toHaveProperty('batchEfficiency')
      expect(efficiency).toHaveProperty('quantizationBonus')
      expect(efficiency).toHaveProperty('rating')

      expect(efficiency.overall).toBeGreaterThan(0)
      expect(efficiency.overall).toBeLessThanOrEqual(100)
      expect(efficiency.rating).toMatch(/Excellent|Very Good|Good|Fair|Poor|Very Poor/)
    })

    it('should give higher efficiency for better utilization', () => {
      const goodConfig = {
        totalVRAMGB: 80,
        usedMemory: 64, // 80% utilization - good
        modelWeightsGB: 32, // 40% model ratio - good
        batchSize: 64, // Good batch size
        quantization: 'awq', // Good quantization
      }

      const poorConfig = {
        totalVRAMGB: 80,
        usedMemory: 24, // 30% utilization - poor
        modelWeightsGB: 8, // 10% model ratio - poor
        batchSize: 4, // Poor batch size
        quantization: 'fp32', // No quantization benefit
      }

      const goodEfficiency = calculateMemoryEfficiency(goodConfig)
      const poorEfficiency = calculateMemoryEfficiency(poorConfig)

      expect(goodEfficiency.overall).toBeGreaterThan(poorEfficiency.overall)
    })
  })

  describe('getEfficiencyRating', () => {
    it('should return correct ratings for different scores', () => {
      expect(getEfficiencyRating(0.95)).toBe('Excellent')
      expect(getEfficiencyRating(0.85)).toBe('Very Good')
      expect(getEfficiencyRating(0.75)).toBe('Good')
      expect(getEfficiencyRating(0.65)).toBe('Fair')
      expect(getEfficiencyRating(0.55)).toBe('Poor')
      expect(getEfficiencyRating(0.45)).toBe('Very Poor')
    })
  })

  describe('analyzememoryPressure', () => {
    it('should analyze critical memory pressure correctly', () => {
      const analysis = analyzememoryPressure(96, 1.5)

      expect(analysis.level).toBe('Critical')
      expect(analysis.isStable).toBe(false)
      expect(analysis.recommendations).toContain('Reduce batch size immediately')
    })

    it('should analyze high memory pressure correctly', () => {
      const analysis = analyzememoryPressure(92, 3.2)

      expect(analysis.level).toBe('High')
      expect(analysis.isStable).toBe(false)
      expect(analysis.recommendations).toContain('Reduce batch size for stability')
    })

    it('should analyze moderate memory pressure correctly', () => {
      const analysis = analyzememoryPressure(85, 8)

      expect(analysis.level).toBe('Moderate')
      expect(analysis.isStable).toBe(true)
      expect(analysis.hasHeadroom).toBe(true)
    })

    it('should analyze low memory pressure correctly', () => {
      const analysis = analyzememoryPressure(65, 20)

      expect(analysis.level).toBe('Low')
      expect(analysis.isStable).toBe(true)
      expect(analysis.recommendations).toContain('Consider increasing batch size for better throughput')
    })

    it('should analyze very low memory pressure correctly', () => {
      const analysis = analyzememoryPressure(40, 35)

      expect(analysis.level).toBe('Very Low')
      expect(analysis.recommendations).toContain('Increase batch size significantly')
    })
  })

  describe('analyzeQuantizationBenefit', () => {
    it('should analyze fp16 quantization benefit', () => {
      const modelWeightsResult = {
        quantizationSavings: 6.5,
        savingsPercent: 50,
      }

      const analysis = analyzeQuantizationBenefit(modelWeightsResult, 'fp16')

      expect(analysis.format).toBe('fp16')
      expect(analysis.memorySavingsGB).toBe(6.5)
      expect(analysis.savingsPercent).toBe(50)
      expect(analysis.isRecommended).toBe(true)
    })

    it('should analyze AWQ quantization benefit', () => {
      const modelWeightsResult = {
        quantizationSavings: 11.4,
        savingsPercent: 87.7,
      }

      const analysis = analyzeQuantizationBenefit(modelWeightsResult, 'awq')

      expect(analysis.format).toBe('awq')
      expect(analysis.savingsPercent).toBeGreaterThan(75)
      expect(analysis.recommendation).toContain('Excellent memory savings')
      expect(analysis.isRecommended).toBe(true)
    })

    it('should handle unknown quantization format', () => {
      const modelWeightsResult = { quantizationSavings: 0 }
      const analysis = analyzeQuantizationBenefit(modelWeightsResult, 'unknown')

      expect(analysis.error).toBe('Unknown quantization format')
    })
  })

  describe('generateMemoryOptimizationRecommendations', () => {
    it('should generate high-priority recommendations for high memory usage', () => {
      const config = {
        totalVRAMGB: 80,
        utilizationPercent: 95,
        breakdown: {
          modelWeightsGB: 13,
          kvCacheMemory: 45,
          activationMemory: 8,
          systemOverhead: 4,
          fragmentationOverhead: 2,
        },
        quantization: 'fp16',
        batchSize: 64,
      }

      const recommendations = generateMemoryOptimizationRecommendations(config)

      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations[0].priority).toBe('High')
      expect(recommendations[0].title).toBe('Reduce Memory Usage')
    })

    it('should recommend increasing batch size for underutilized memory', () => {
      const config = {
        totalVRAMGB: 80,
        utilizationPercent: 50,
        breakdown: {
          modelWeightsGB: 13,
          kvCacheMemory: 15,
          activationMemory: 4,
          systemOverhead: 2,
          fragmentationOverhead: 1,
        },
        quantization: 'fp16',
        batchSize: 8,
      }

      const recommendations = generateMemoryOptimizationRecommendations(config)

      const batchRecommendation = recommendations.find(r => r.title === 'Increase Batch Size')
      expect(batchRecommendation).toBeDefined()
      expect(batchRecommendation.priority).toBe('Medium')
    })

    it('should recommend KV cache optimization for high KV cache usage', () => {
      const config = {
        totalVRAMGB: 80,
        utilizationPercent: 70,
        breakdown: {
          modelWeightsGB: 13,
          kvCacheMemory: 32, // 40% of VRAM
          activationMemory: 4,
          systemOverhead: 2,
          fragmentationOverhead: 1,
        },
        quantization: 'fp16',
        batchSize: 32,
      }

      const recommendations = generateMemoryOptimizationRecommendations(config)

      const kvRecommendation = recommendations.find(r => r.title === 'Optimize KV Cache Usage')
      expect(kvRecommendation).toBeDefined()
      expect(kvRecommendation.category).toBe('KV Cache')
    })

    it('should sort recommendations by priority', () => {
      const config = {
        totalVRAMGB: 80,
        utilizationPercent: 95, // Will generate high priority recommendation
        breakdown: {
          modelWeightsGB: 13,
          kvCacheMemory: 45,
          activationMemory: 8,
          systemOverhead: 4,
          fragmentationOverhead: 3.5, // Will generate low priority recommendation
        },
        quantization: 'fp16',
        batchSize: 8, // Will generate medium priority recommendation
      }

      const recommendations = generateMemoryOptimizationRecommendations(config)

      // Should be sorted by priority: High, Medium, Low
      expect(recommendations[0].priority).toBe('High')
      if (recommendations.length > 1) {
        const priorities = recommendations.map(r => r.priority)
        const uniquePriorities = [...new Set(priorities)]
        const priorityOrder = ['High', 'Medium', 'Low']
        
        for (let i = 1; i < uniquePriorities.length; i++) {
          const currentIndex = priorityOrder.indexOf(uniquePriorities[i])
          const previousIndex = priorityOrder.indexOf(uniquePriorities[i-1])
          expect(currentIndex).toBeGreaterThan(previousIndex)
        }
      }
    })
  })

  describe('calculateOptimalBatchSizeForVRAM', () => {
    it('should calculate reasonable batch size for available VRAM', () => {
      const batchSize = calculateOptimalBatchSizeForVRAM(80, 13, 'fp16')

      expect(batchSize).toBeGreaterThan(0)
      expect(batchSize).toBeLessThanOrEqual(256) // Should not exceed cap
    })

    it('should return smaller batch size for limited VRAM', () => {
      const batchSize = calculateOptimalBatchSizeForVRAM(16, 13, 'fp16')

      expect(batchSize).toBeGreaterThan(0)
      expect(batchSize).toBeLessThanOrEqual(16) // Should be capped for limited VRAM
    })

    it('should handle edge case with minimal VRAM', () => {
      const batchSize = calculateOptimalBatchSizeForVRAM(14, 13, 'fp16')

      expect(batchSize).toBeGreaterThanOrEqual(1) // Should be at least 1
    })
  })

  describe('calculateMaxConcurrentSequences', () => {
    it('should calculate maximum concurrent sequences', () => {
      const architecture = {
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32,
      }

      const maxSequences = calculateMaxConcurrentSequences(80, 13, 2048, architecture)

      expect(maxSequences).toBeGreaterThan(0)
      expect(maxSequences).toBeLessThan(1000) // Should be reasonable
    })

    it('should return at least 1 sequence even with limited VRAM', () => {
      const architecture = {
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32,
      }

      const maxSequences = calculateMaxConcurrentSequences(16, 13, 2048, architecture)

      expect(maxSequences).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Integration Tests', () => {
    it('should work end-to-end for typical vLLM deployment', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 13,
        quantization: 'fp16',
        batchSize: 32,
        maxSeqLen: 2048,
        seqLen: 512,
        kvCachePrecision: 'fp16',
        optimizationStrategy: { priority: 'balanced' },
      }

      const result = calculateVRAMBreakdown(config)

      // Should provide comprehensive breakdown
      expect(result.compatibility.supportsModel).toBe(true)
      expect(result.summary.utilizationPercent).toBeGreaterThan(0)
      expect(result.summary.utilizationPercent).toBeLessThan(95)
      
      // Should have reasonable memory allocation
      expect(result.breakdown.modelWeights.percentage).toBeGreaterThan(10)
      expect(result.breakdown.kvCache.percentage).toBeGreaterThan(5)
      expect(result.breakdown.activations.percentage).toBeGreaterThan(1)
      
      // Should provide useful analysis
      expect(result.analysis.memoryPressure.level).toMatch(/Very Low|Low|Moderate|High|Critical/)
      expect(result.analysis.optimizationRecommendations).toBeInstanceOf(Array)
      expect(result.analysis.quantizationBenefit.isRecommended).toBeDefined()
    })

    it('should handle memory-constrained scenario', () => {
      const config = {
        totalVRAMGB: 16,
        modelSizeGB: 13,
        quantization: 'awq', // More aggressive quantization needed
        batchSize: 8,
        maxSeqLen: 1024, // Shorter sequences
      }

      const result = calculateVRAMBreakdown(config)

      // Should still work but with tighter constraints
      expect(result.compatibility.supportsModel).toBe(true)
      expect(result.summary.utilizationPercent).toBeGreaterThan(50) // Should be high utilization (adjusted expectation)
      
      // Should recommend optimizations
      expect(result.analysis.optimizationRecommendations.length).toBeGreaterThan(0)
      expect(result.analysis.memoryPressure.level).toMatch(/Very Low|Low|Moderate|High/) // Any reasonable pressure level
    })
  })
})
