import { describe, it, expect, beforeEach } from 'vitest'
import {
  LATENCY_OPTIMIZATION_CONFIGS,
  calculateLatencyOptimalBatchSize,
  calculateLatencyMemoryStrategy,
  estimateLatencyMetrics,
  calculateLatencyOptimizedConfig,
  optimizeForLatency,
  calculateVRAMUsage,
  canRunOnGPU,
} from './latencyOptimization.js'

describe('Latency Optimization Module', () => {
  // Test configuration constants
  describe('LATENCY_OPTIMIZATION_CONFIGS', () => {
    it('should have proper structure and values', () => {
      expect(LATENCY_OPTIMIZATION_CONFIGS).toBeDefined()
      expect(LATENCY_OPTIMIZATION_CONFIGS.gpu).toBeDefined()
      expect(LATENCY_OPTIMIZATION_CONFIGS.gpuMemoryUtilization).toBeDefined()
      expect(LATENCY_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsOptimal).toBe(32)
      expect(LATENCY_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsMinimal).toBe(8)
      expect(LATENCY_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.conservative).toBe(0.75)
    })
  })

  // Test calculateLatencyOptimalBatchSize
  describe('calculateLatencyOptimalBatchSize', () => {
    const baseConfig = {
      availableMemoryGB: 80,
      modelMemoryGB: 13.5,
      maxSequenceLength: 2048,
      averageSequenceLength: 512,
      architecture: {
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32,
      },
    }

    it('should calculate optimal batch size for low latency', () => {
      const result = calculateLatencyOptimalBatchSize({
        ...baseConfig,
        latencyTarget: 'low',
      })

      expect(result).toBeDefined()
      expect(result.maxNumSeqs).toBeGreaterThan(0)
      expect(result.maxNumSeqs).toBeLessThanOrEqual(32) // Should respect optimal limit
      expect(result.maxNumBatchedTokens).toBe(2048)
      expect(result.latencyTarget).toBe('low')
      expect(result.memoryUtilization).toBeGreaterThan(0)
      expect(result.memoryUtilization).toBeLessThan(1)
    })

    it('should calculate minimal batch size for ultra-low latency', () => {
      const result = calculateLatencyOptimalBatchSize({
        ...baseConfig,
        latencyTarget: 'ultra-low',
      })

      expect(result.maxNumSeqs).toBeLessThanOrEqual(8) // Should respect minimal limit
      expect(result.maxNumBatchedTokens).toBe(512)
      expect(result.latencyTarget).toBe('ultra-low')
    })

    it('should calculate balanced batch size', () => {
      const result = calculateLatencyOptimalBatchSize({
        ...baseConfig,
        latencyTarget: 'balanced',
      })

      expect(result.maxNumSeqs).toBeLessThanOrEqual(64)
      expect(result.maxNumBatchedTokens).toBe(4096)
      expect(result.latencyTarget).toBe('balanced')
    })

    it('should handle edge case with minimal available memory', () => {
      const result = calculateLatencyOptimalBatchSize({
        ...baseConfig,
        availableMemoryGB: 15, // Just slightly above model memory
      })

      expect(result.maxNumSeqs).toBeGreaterThanOrEqual(1) // Should have minimum viable batch
      expect(result.maxNumBatchedTokens).toBeGreaterThanOrEqual(256)
    })

    it('should throw error when available memory is not greater than model memory', () => {
      expect(() => {
        calculateLatencyOptimalBatchSize({
          ...baseConfig,
          availableMemoryGB: 13.5, // Equal to model memory
        })
      }).toThrow('Available memory must be greater than model memory')
    })

    it('should include reasoning in result', () => {
      const result = calculateLatencyOptimalBatchSize(baseConfig)
      
      expect(result.reasoning).toBeDefined()
      expect(result.reasoning.availableForBatching).toBeGreaterThan(0)
      expect(result.reasoning.optimizationFocus).toBe('minimize_latency')
    })
  })

  // Test calculateLatencyMemoryStrategy
  describe('calculateLatencyMemoryStrategy', () => {
    const baseConfig = {
      totalVRAMGB: 80,
      modelSizeGB: 13.5,
      workloadType: 'serving',
    }

    it('should calculate memory strategy for high latency priority', () => {
      const result = calculateLatencyMemoryStrategy({
        ...baseConfig,
        latencyPriority: 'high',
      })

      expect(result).toBeDefined()
      expect(result.gpuMemoryUtilization).toBe(0.80)
      expect(result.kvCacheAllocationGB).toBeGreaterThan(0)
      expect(result.recommendedBlockSize).toBe(16)
      expect(result.enableChunkedPrefill).toBe(false)
      expect(result.latencyOptimizations.prioritizeFirstToken).toBe(true)
    })

    it('should calculate ultra-high latency priority strategy', () => {
      const result = calculateLatencyMemoryStrategy({
        ...baseConfig,
        latencyPriority: 'ultra-high',
      })

      expect(result.gpuMemoryUtilization).toBe(0.75) // Most conservative
      expect(result.recommendedBlockSize).toBe(8) // Smallest block size
      expect(result.latencyOptimizations.aggressiveCaching).toBe(true)
    })

    it('should calculate medium latency priority strategy', () => {
      const result = calculateLatencyMemoryStrategy({
        ...baseConfig,
        latencyPriority: 'medium',
      })

      expect(result.gpuMemoryUtilization).toBe(0.85) // Less conservative
    })

    it('should throw error when total VRAM is not greater than model size', () => {
      expect(() => {
        calculateLatencyMemoryStrategy({
          ...baseConfig,
          totalVRAMGB: 13.5, // Equal to model size
        })
      }).toThrow('Total VRAM must be greater than model size')
    })

    it('should include proper memory breakdown', () => {
      const result = calculateLatencyMemoryStrategy(baseConfig)
      
      expect(result.memoryBreakdown).toBeDefined()
      expect(result.memoryBreakdown.model).toBe(13.5)
      expect(result.memoryBreakdown.kvCache).toBeGreaterThan(0)
      expect(result.memoryBreakdown.reserved).toBeGreaterThan(0)
    })
  })

  // Test estimateLatencyMetrics
  describe('estimateLatencyMetrics', () => {
    const baseConfig = {
      maxNumSeqs: 16,
      modelSizeGB: 13.5,
      quantization: 'fp16',
      maxSequenceLength: 2048,
    }
    
    const hardwareSpecs = {
      gpuMemoryBandwidthGBps: 900,
      tensorCores: true,
    }

    it('should estimate latency metrics for low optimization level', () => {
      const result = estimateLatencyMetrics(baseConfig, hardwareSpecs, 'low')

      expect(result).toBeDefined()
      expect(result.timeToFirstToken).toBeGreaterThan(0)
      expect(result.interTokenLatency).toBeGreaterThan(0)
      expect(result.totalLatency).toBeGreaterThan(result.timeToFirstToken)
      expect(result.optimizationLevel).toBe('low')
    })

    it('should estimate ultra-low latency metrics', () => {
      const result = estimateLatencyMetrics(baseConfig, hardwareSpecs, 'ultra-low')

      expect(result.optimizationLevel).toBe('ultra-low')
      expect(result.timeToFirstToken).toBeGreaterThanOrEqual(50) // Minimum realistic TTFT
    })

    it('should include latency percentiles', () => {
      const result = estimateLatencyMetrics(baseConfig, hardwareSpecs)

      expect(result.latencyPercentiles).toBeDefined()
      expect(result.latencyPercentiles.p50).toBeGreaterThan(0)
      expect(result.latencyPercentiles.p95).toBeGreaterThan(result.latencyPercentiles.p50)
      expect(result.latencyPercentiles.p99).toBeGreaterThan(result.latencyPercentiles.p95)
    })

    it('should include throughput tradeoff information', () => {
      const result = estimateLatencyMetrics(baseConfig, hardwareSpecs)

      expect(result.throughputTradeoff).toBeDefined()
      expect(result.throughputTradeoff.estimatedRequestsPerSec).toBeGreaterThan(0)
      expect(result.throughputTradeoff.concurrentCapacity).toBe(baseConfig.maxNumSeqs)
    })

    it('should identify bottlenecks and provide recommendations', () => {
      const result = estimateLatencyMetrics(baseConfig, hardwareSpecs)

      expect(Array.isArray(result.bottlenecks)).toBe(true)
      expect(result.recommendations).toBeDefined()
      expect(typeof result.recommendations.reduceSequenceLength).toBe('boolean')
      expect(typeof result.recommendations.enableSpeculation).toBe('boolean')
    })
  })

  // Test calculateLatencyOptimizedConfig
  describe('calculateLatencyOptimizedConfig', () => {
    const baseParams = {
      gpuSpecs: {
        totalVRAMGB: 80,
        memoryBandwidthGBps: 900,
        tensorCores: true,
      },
      modelSpecs: {
        modelSizeGB: 13.5,
        quantization: 'fp16',
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32,
        },
      },
      workloadSpecs: {
        expectedConcurrentUsers: 16,
        maxSequenceLength: 2048,
        latencyTarget: 'low',
      },
    }

    it('should generate complete latency-optimized configuration', () => {
      const result = calculateLatencyOptimizedConfig(baseParams)

      expect(result).toBeDefined()
      expect(result.batchConfiguration).toBeDefined()
      expect(result.memoryConfiguration).toBeDefined()
      expect(result.latencyEstimate).toBeDefined()
      expect(result.vllmParameters).toBeDefined()
      expect(result.vllmCommand).toBeDefined()
      expect(result.optimizationSummary).toBeDefined()
    })

    it('should work with flat parameter style', () => {
      const flatParams = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        quantization: 'fp16',
        maxSequenceLength: 2048,
        latencyTarget: 'low',
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32,
        },
      }

      const result = calculateLatencyOptimizedConfig(flatParams)
      expect(result).toBeDefined()
      expect(result.batchConfiguration).toBeDefined()
    })

    it('should handle ultra-low latency target', () => {
      const ultraLowParams = {
        ...baseParams,
        workloadSpecs: {
          ...baseParams.workloadSpecs,
          latencyTarget: 'ultra-low',
        },
      }

      const result = calculateLatencyOptimizedConfig(ultraLowParams)
      expect(result.batchConfiguration.maxNumSeqs).toBeLessThanOrEqual(8)
      expect(result.memoryConfiguration.gpuMemoryUtilization).toBe(0.75)
    })

    it('should generate valid vLLM command', () => {
      const result = calculateLatencyOptimizedConfig(baseParams)
      
      expect(result.vllmCommand).toContain('python -m vllm.entrypoints.openai.api_server')
      expect(result.vllmCommand).toContain('--max-num-seqs')
      expect(result.vllmCommand).toContain('--gpu-memory-utilization')
    })

    it('should include optimization summary with latency focus', () => {
      const result = calculateLatencyOptimizedConfig(baseParams)
      
      expect(result.optimizationSummary.primaryOptimizations).toBeDefined()
      expect(result.optimizationSummary.tradeoffs).toBeDefined()
      expect(result.optimizationSummary.expectedImprovements).toBeDefined()
      expect(result.optimizationSummary.expectedImprovements.timeToFirstToken).toBeDefined()
    })

    it('should throw error when model size cannot be determined', () => {
      const invalidParams = {
        ...baseParams,
        modelSpecs: {
          quantization: 'fp16',
        },
      }

      expect(() => {
        calculateLatencyOptimizedConfig(invalidParams)
      }).toThrow('Either modelSizeGB or numParams must be provided')
    })
  })

  // Test optimizeForLatency
  describe('optimizeForLatency', () => {
    const baseProfile = {
      workloadType: 'serving',
      averageInputLength: 256,
      averageOutputLength: 50,
      peakConcurrency: 16,
      latencyRequirement: 'low',
      responseTimeTarget: 200,
    }

    it('should optimize for general serving workload', () => {
      const result = optimizeForLatency(baseProfile)

      expect(result).toBeDefined()
      expect(result.workloadType).toBe('serving')
      expect(result.latencyTarget).toBe('low')
      expect(result.optimizations).toBeDefined()
      expect(result.recommendations).toBeDefined()
    })

    it('should optimize for interactive workload', () => {
      const result = optimizeForLatency({
        ...baseProfile,
        workloadType: 'interactive',
      })

      expect(result.optimizations.specialSettings['disable-log-stats']).toBe(true)
      expect(result.optimizations.latencySettings.prioritizeFirstToken).toBe(true)
    })

    it('should optimize for realtime workload', () => {
      const result = optimizeForLatency({
        ...baseProfile,
        workloadType: 'realtime',
      })

      expect(result.optimizations.specialSettings['disable-chunked-prefill']).toBe(true)
      expect(result.optimizations.recommendedQuantization).toBe('fp16')
    })

    it('should handle ultra-low latency requirement', () => {
      const result = optimizeForLatency({
        ...baseProfile,
        latencyRequirement: 'ultra-low',
      })

      expect(result.optimizations.batchingStrategy.maxNumSeqs).toBeLessThanOrEqual(8)
      expect(result.optimizations.memoryStrategy).toBe('ultra-conservative')
    })

    it('should include reasoning and considerations', () => {
      const result = optimizeForLatency(baseProfile)

      expect(result.reasoning).toBeDefined()
      expect(result.reasoning.latencyConsiderations).toBeDefined()
      expect(Array.isArray(result.reasoning.latencyConsiderations)).toBe(true)
      expect(result.reasoning.expectedLatencyImprovement).toBeDefined()
    })
  })

  // Test legacy functions
  describe('Legacy Functions', () => {
    describe('calculateVRAMUsage', () => {
      it('should calculate basic VRAM usage', () => {
        const result = calculateVRAMUsage(13.5, 1, 1, 2048, 1.2)
        expect(result).toBeGreaterThan(13.5)
        expect(typeof result).toBe('number')
      })

      it('should handle quantization factor', () => {
        const fp16Result = calculateVRAMUsage(13.5, 1, 1, 2048)
        const int8Result = calculateVRAMUsage(13.5, 0.5, 1, 2048)
        expect(int8Result).toBeLessThan(fp16Result)
      })

      it('should throw error for invalid model size', () => {
        expect(() => {
          calculateVRAMUsage(0)
        }).toThrow('Model size must be positive')
      })
    })

    describe('canRunOnGPU', () => {
      it('should return true when GPU has enough VRAM', () => {
        expect(canRunOnGPU(80, 40)).toBe(true)
      })

      it('should return false when GPU does not have enough VRAM', () => {
        expect(canRunOnGPU(40, 80)).toBe(false)
      })

      it('should return true when VRAM is exactly equal', () => {
        expect(canRunOnGPU(80, 80)).toBe(true)
      })
    })
  })

  // Integration tests
  describe('Integration Tests', () => {
    it('should work end-to-end for latency optimization', () => {
      // Test realistic scenario
      const params = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        numParams: 7,
        quantization: 'fp16',
        maxSequenceLength: 2048,
        expectedConcurrentUsers: 8,
        latencyTarget: 'low',
        workloadType: 'interactive',
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32,
        },
      }

      const config = calculateLatencyOptimizedConfig(params)
      expect(config).toBeDefined()
      
      // Verify latency optimizations are applied
      expect(config.batchConfiguration.maxNumSeqs).toBeLessThanOrEqual(32)
      expect(config.memoryConfiguration.gpuMemoryUtilization).toBeLessThanOrEqual(0.85)
      expect(config.latencyEstimate.timeToFirstToken).toBeGreaterThan(0)
      
      // Verify vLLM parameters are latency-optimized
      expect(config.vllmParameters['max-num-seqs']).toBeLessThanOrEqual(32)
      expect(config.vllmParameters['disable-log-stats']).toBe(true)
    })

    it('should provide consistent results across multiple calls', () => {
      const params = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        latencyTarget: 'low',
        architecture: { layers: 32, hiddenSize: 4096, numHeads: 32 },
      }

      const result1 = calculateLatencyOptimizedConfig(params)
      const result2 = calculateLatencyOptimizedConfig(params)

      expect(result1.batchConfiguration.maxNumSeqs).toBe(result2.batchConfiguration.maxNumSeqs)
      expect(result1.memoryConfiguration.gpuMemoryUtilization).toBe(result2.memoryConfiguration.gpuMemoryUtilization)
    })
  })
})
