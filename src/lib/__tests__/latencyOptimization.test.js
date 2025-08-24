import { describe, it, expect } from 'vitest'
import {
  calculateLatencyOptimalBatchSize,
  calculateLatencyMemoryStrategy,
  estimateLatencyMetrics,
  calculateLatencyOptimizedConfig,
  optimizeForLatency,
} from '../calculationEngine.js'

describe('Latency Optimization Functions', () => {
  // Mock model specs for testing
  const mockModelSpecs = {
    modelSizeGB: 13.5,
    numParams: 7000000000,
    layers: 32,
    hiddenSize: 4096,
    numHeads: 32,
    vocabSize: 32000,
  }

  // Mock GPU specs for testing
  const mockGpuSpecs = {
    gpuMemoryBandwidthGBps: 1935, // A100
    tensorCores: true,
    computeCapability: '8.0',
  }

  describe('calculateLatencyOptimalBatchSize', () => {
    it('should calculate optimal batch size for low latency', () => {
      const batchConfig = {
        availableMemoryGB: 80,
        modelMemoryGB: 13.5,
        maxSequenceLength: 2048,
        averageSequenceLength: 512,
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32,
        },
        latencyTarget: 'low'
      }
      
      const result = calculateLatencyOptimalBatchSize(batchConfig)
      
      expect(result).toHaveProperty('maxNumSeqs')
      expect(result).toHaveProperty('maxNumBatchedTokens')
      expect(result).toHaveProperty('memoryUtilization')
      expect(result).toHaveProperty('latencyTarget')
      expect(result).toHaveProperty('reasoning')
      
      expect(result.maxNumSeqs).toBeGreaterThan(0)
      expect(result.maxNumSeqs).toBeLessThanOrEqual(32) // Should be smaller than throughput optimization
      expect(result.maxNumBatchedTokens).toBe(2048) // Default for low latency
      expect(result.latencyTarget).toBe('low')
      expect(result.reasoning.optimizationFocus).toBe('minimize_latency')
    })

    it('should use minimal batch size for ultra-low latency', () => {
      const batchConfig = {
        availableMemoryGB: 80,
        modelMemoryGB: 13.5,
        maxSequenceLength: 2048,
        averageSequenceLength: 512,
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32,
        },
        latencyTarget: 'ultra-low'
      }
      
      const result = calculateLatencyOptimalBatchSize(batchConfig)
      
      expect(result.maxNumSeqs).toBeLessThanOrEqual(8) // Ultra-low latency limit
      expect(result.maxNumBatchedTokens).toBe(512) // Minimal batching
      expect(result.latencyTarget).toBe('ultra-low')
    })

    it('should handle balanced latency target', () => {
      const batchConfig = {
        availableMemoryGB: 80,
        modelMemoryGB: 13.5,
        maxSequenceLength: 2048,
        averageSequenceLength: 512,
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32,
        },
        latencyTarget: 'balanced'
      }
      
      const result = calculateLatencyOptimalBatchSize(batchConfig)
      
      expect(result.maxNumSeqs).toBeLessThanOrEqual(64) // Balanced limit
      expect(result.maxNumBatchedTokens).toBe(4096) // Moderate batching
      expect(result.latencyTarget).toBe('balanced')
    })

    it('should throw error when available memory is less than model memory', () => {
      const batchConfig = {
        availableMemoryGB: 10,
        modelMemoryGB: 13.5,
        maxSequenceLength: 2048,
        averageSequenceLength: 512,
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32,
        }
      }
      
      expect(() => calculateLatencyOptimalBatchSize(batchConfig)).toThrow('Available memory must be greater than model memory')
    })
  })

  describe('calculateLatencyMemoryStrategy', () => {
    it('should calculate conservative memory allocation for latency', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        targetBatchSize: 16,
        workloadType: 'serving',
        latencyPriority: 'high'
      }
      
      const result = calculateLatencyMemoryStrategy(config)
      
      expect(result).toHaveProperty('gpuMemoryUtilization')
      expect(result).toHaveProperty('allocatedVRAMGB')
      expect(result).toHaveProperty('kvCacheAllocationGB')
      expect(result).toHaveProperty('recommendedBlockSize')
      expect(result).toHaveProperty('latencyOptimizations')
      
      expect(result.gpuMemoryUtilization).toBeLessThanOrEqual(0.85) // Conservative for latency
      expect(result.recommendedBlockSize).toBeLessThanOrEqual(16) // Smaller for cache locality
      expect(result.enableChunkedPrefill).toBe(false) // Disabled for latency
      expect(result.latencyOptimizations.prioritizeFirstToken).toBe(true)
    })

    it('should use ultra-conservative settings for ultra-high latency priority', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        targetBatchSize: 8,
        workloadType: 'serving',
        latencyPriority: 'ultra-high'
      }
      
      const result = calculateLatencyMemoryStrategy(config)
      
      expect(result.gpuMemoryUtilization).toBe(0.75) // Most conservative
      expect(result.recommendedBlockSize).toBe(8) // Smallest block size
      expect(result.latencyOptimizations.aggressiveCaching).toBe(true)
    })

    it('should handle medium latency priority', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        targetBatchSize: 32,
        workloadType: 'serving',
        latencyPriority: 'medium'
      }
      
      const result = calculateLatencyMemoryStrategy(config)
      
      expect(result.gpuMemoryUtilization).toBe(0.85) // Less conservative
      expect(result.recommendedBlockSize).toBe(16)
    })

    it('should throw error when total VRAM is less than model size', () => {
      const config = {
        totalVRAMGB: 10,
        modelSizeGB: 13.5,
        targetBatchSize: 16,
        workloadType: 'serving'
      }
      
      expect(() => calculateLatencyMemoryStrategy(config)).toThrow('Total VRAM must be greater than model size')
    })
  })

  describe('estimateLatencyMetrics', () => {
    it('should estimate latency metrics with valid inputs', () => {
      const config = {
        maxNumSeqs: 16,
        maxNumBatchedTokens: 2048,
        modelSizeGB: 13.5,
        quantization: 'fp16',
        maxSequenceLength: 2048,
      }
      
      const result = estimateLatencyMetrics(config, mockGpuSpecs, 'low')
      
      expect(result).toHaveProperty('timeToFirstToken')
      expect(result).toHaveProperty('interTokenLatency')
      expect(result).toHaveProperty('totalLatency')
      expect(result).toHaveProperty('latencyPercentiles')
      expect(result).toHaveProperty('throughputTradeoff')
      expect(result).toHaveProperty('bottlenecks')
      expect(result).toHaveProperty('recommendations')
      
      expect(result.timeToFirstToken).toBeGreaterThan(0)
      expect(result.interTokenLatency).toBeGreaterThan(0)
      expect(result.latencyPercentiles.p50).toBeGreaterThan(0)
      expect(result.latencyPercentiles.p95).toBeGreaterThan(result.latencyPercentiles.p50)
      expect(result.latencyPercentiles.p99).toBeGreaterThan(result.latencyPercentiles.p95)
      expect(Array.isArray(result.bottlenecks)).toBe(true)
      expect(result.optimizationLevel).toBe('low')
    })

    it('should handle ultra-low latency optimization level', () => {
      const config = {
        maxNumSeqs: 8,
        maxNumBatchedTokens: 512,
        modelSizeGB: 13.5,
        quantization: 'fp16',
        maxSequenceLength: 1024,
      }
      
      const result = estimateLatencyMetrics(config, mockGpuSpecs, 'ultra-low')
      
      expect(result.optimizationLevel).toBe('ultra-low')
      expect(result.throughputTradeoff.utilizationEfficiency).toBe(0.5) // Lower utilization for ultra-low latency
      expect(result.timeToFirstToken).toBeGreaterThan(0)
    })

    it('should handle different quantization methods', () => {
      const config = {
        maxNumSeqs: 16,
        maxNumBatchedTokens: 2048,
        modelSizeGB: 13.5,
        quantization: 'awq',
        maxSequenceLength: 2048,
      }
      
      const result = estimateLatencyMetrics(config, mockGpuSpecs, 'low')
      
      expect(result).toHaveProperty('timeToFirstToken')
      expect(result).toHaveProperty('interTokenLatency')
      expect(result.optimizationLevel).toBe('low')
    })
  })

  describe('calculateLatencyOptimizedConfig', () => {
    it('should generate complete latency-optimized configuration', () => {
      const config = {
        gpuSpecs: {
          totalVRAMGB: 80,
          memoryBandwidthGBps: 1935,
          tensorCores: true,
        },
        modelSpecs: mockModelSpecs,
        workloadSpecs: {
          expectedConcurrentUsers: 16,
          averageSequenceLength: 512,
          maxSequenceLength: 2048,
          workloadType: 'serving',
          latencyTarget: 'low',
        }
      }
      
      const result = calculateLatencyOptimizedConfig(config)
      
      expect(result).toHaveProperty('batchConfiguration')
      expect(result).toHaveProperty('memoryConfiguration')
      expect(result).toHaveProperty('latencyEstimate')
      expect(result).toHaveProperty('vllmParameters')
      expect(result).toHaveProperty('optimizationSummary')
      expect(result).toHaveProperty('vllmCommand')
      
      expect(result.batchConfiguration.maxNumSeqs).toBeLessThanOrEqual(32) // Lower than throughput
      expect(result.memoryConfiguration.gpuMemoryUtilization).toBeLessThanOrEqual(0.85) // Conservative
      expect(result.latencyEstimate.timeToFirstToken).toBeGreaterThan(0)
      expect(result.vllmCommand).toContain('python -m vllm.entrypoints.openai.api_server')
    })

    it('should include optimization summary with expected properties', () => {
      const config = {
        gpuSpecs: {
          totalVRAMGB: 80,
          memoryBandwidthGBps: 1935,
        },
        modelSpecs: mockModelSpecs,
        workloadSpecs: {
          latencyTarget: 'ultra-low'
        }
      }
      
      const result = calculateLatencyOptimizedConfig(config)
      
      expect(result.optimizationSummary).toHaveProperty('primaryOptimizations')
      expect(result.optimizationSummary).toHaveProperty('tradeoffs')
      expect(result.optimizationSummary).toHaveProperty('expectedImprovements')
      
      expect(Array.isArray(result.optimizationSummary.primaryOptimizations)).toBe(true)
      expect(Array.isArray(result.optimizationSummary.tradeoffs)).toBe(true)
      expect(result.optimizationSummary.expectedImprovements).toHaveProperty('latencyReduction')
      expect(result.optimizationSummary.expectedImprovements).toHaveProperty('timeToFirstToken')
    })

    it('should handle flat configuration parameters', () => {
      const flatConfig = {
        gpu: { memory: 80, count: 1 },
        model: 'meta-llama/Llama-2-7b-hf',
        quantization: 'fp16',
        latencyTarget: 'balanced',
        modelSpecs: mockModelSpecs,
        gpuSpecs: mockGpuSpecs,
        workloadSpecs: {
          latencyTarget: 'balanced'
        }
      }
      
      const result = calculateLatencyOptimizedConfig(flatConfig)
      
      expect(result).toBeDefined()
      expect(result.batchConfiguration.latencyTarget).toBe('balanced')
      expect(result.vllmCommand).toContain('python -m vllm.entrypoints.openai.api_server')
    })
  })

  describe('optimizeForLatency', () => {
    it('should optimize for interactive workload with appropriate settings', () => {
      const workloadProfile = {
        workloadType: 'interactive',
        averageInputLength: 256,
        averageOutputLength: 50,
        peakConcurrency: 16,
        latencyRequirement: 'low',
        responseTimeTarget: 200,
      }
      
      const result = optimizeForLatency(workloadProfile)
      
      expect(result).toHaveProperty('workloadType')
      expect(result).toHaveProperty('latencyTarget')
      expect(result).toHaveProperty('optimizations')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('reasoning')
      
      expect(result.workloadType).toBe('interactive')
      expect(result.latencyTarget).toBe('low')
      expect(result.optimizations.batchingStrategy.maxNumSeqs).toBeLessThanOrEqual(16)
      expect(result.optimizations.specialSettings['disable-log-stats']).toBe(true)
      expect(result.optimizations.latencySettings.prioritizeFirstToken).toBe(true)
    })

    it('should optimize for realtime workload with minimal latency', () => {
      const workloadProfile = {
        workloadType: 'realtime',
        averageInputLength: 128,
        averageOutputLength: 32,
        peakConcurrency: 8,
        latencyRequirement: 'ultra-low',
        responseTimeTarget: 100,
      }
      
      const result = optimizeForLatency(workloadProfile)
      
      expect(result.workloadType).toBe('realtime')
      expect(result.latencyTarget).toBe('ultra-low')
      expect(result.optimizations.batchingStrategy.maxNumSeqs).toBeLessThanOrEqual(8)
      expect(result.optimizations.memoryStrategy).toBe('ultra-conservative')
      expect(result.optimizations.specialSettings['disable-chunked-prefill']).toBe(true)
    })

    it('should optimize for streaming workload', () => {
      const workloadProfile = {
        workloadType: 'streaming',
        averageInputLength: 300,
        averageOutputLength: 100,
        peakConcurrency: 24,
        latencyRequirement: 'low',
      }
      
      const result = optimizeForLatency(workloadProfile)
      
      expect(result.workloadType).toBe('streaming')
      expect(result.optimizations.specialSettings['stream-interval']).toBe(1)
      expect(result.optimizations.latencySettings.streamOptimized).toBe(true)
    })

    it('should optimize for API workload', () => {
      const workloadProfile = {
        workloadType: 'api',
        averageInputLength: 400,
        averageOutputLength: 200,
        peakConcurrency: 32,
        latencyRequirement: 'balanced',
      }
      
      const result = optimizeForLatency(workloadProfile)
      
      expect(result.workloadType).toBe('api')
      expect(result.latencyTarget).toBe('balanced')
      expect(result.optimizations.batchingStrategy.maxNumSeqs).toBeLessThanOrEqual(32)
      expect(result.optimizations.latencySettings.apiOptimized).toBe(true)
    })

    it('should provide latency considerations and reasoning', () => {
      const workloadProfile = {
        workloadType: 'interactive',
        latencyRequirement: 'ultra-low',
        peakConcurrency: 8,
      }
      
      const result = optimizeForLatency(workloadProfile)
      
      expect(result.reasoning).toHaveProperty('latencyConsiderations')
      expect(result.reasoning).toHaveProperty('latencyRequirement')
      expect(result.reasoning).toHaveProperty('expectedLatencyImprovement')
      
      expect(Array.isArray(result.reasoning.latencyConsiderations)).toBe(true)
      expect(result.reasoning.latencyConsiderations.length).toBeGreaterThan(0)
      expect(result.reasoning.latencyRequirement).toBe('ultra-low')
      expect(result.reasoning.expectedLatencyImprovement).toContain('%')
    })
  })

  describe('Integration Tests', () => {
    it('should work end-to-end for latency optimization workflow', () => {
      // Step 1: Get latency-specific workload optimizations
      const workloadProfile = {
        workloadType: 'interactive',
        averageInputLength: 200,
        averageOutputLength: 80,
        peakConcurrency: 16,
        latencyRequirement: 'low',
        responseTimeTarget: 150,
      }
      
      const workloadOpt = optimizeForLatency(workloadProfile)
      expect(workloadOpt).toBeDefined()
      expect(workloadOpt.workloadType).toBe('interactive')
      
      // Step 2: Apply to full configuration
      const enhancedConfig = {
        model: 'meta-llama/Llama-2-7b-hf',
        gpu: { model: 'A100', memory: 80, count: 1 },
        workload: { maxSeqLen: 2048, concurrentRequests: 16, averageTokensPerRequest: 280 },
        latencyTarget: workloadOpt.latencyTarget,
        memoryStrategy: workloadOpt.optimizations.memoryStrategy,
        modelSpecs: mockModelSpecs,
        gpuSpecs: mockGpuSpecs,
      }
      
      // Step 3: Calculate latency-optimized configuration
      const latencyConfig = calculateLatencyOptimizedConfig(enhancedConfig)
      expect(latencyConfig).toBeDefined()
      expect(latencyConfig.vllmCommand).toBeDefined()
      
      // Verify the configuration is coherent and optimized for latency
      expect(latencyConfig.batchConfiguration.maxNumSeqs).toBeGreaterThan(0)
      expect(latencyConfig.batchConfiguration.maxNumSeqs).toBeLessThanOrEqual(32) // Should be lower than throughput
      expect(latencyConfig.memoryConfiguration.gpuMemoryUtilization).toBeGreaterThan(0)
      expect(latencyConfig.memoryConfiguration.gpuMemoryUtilization).toBeLessThanOrEqual(0.85) // Conservative
      expect(latencyConfig.latencyEstimate.timeToFirstToken).toBeGreaterThan(0)
      expect(latencyConfig.latencyEstimate.interTokenLatency).toBeGreaterThan(0)
      
      // Verify command generation works
      expect(typeof latencyConfig.vllmCommand).toBe('string')
      expect(latencyConfig.vllmCommand).toContain('python -m vllm.entrypoints.openai.api_server')
      expect(latencyConfig.vllmCommand).toContain('--disable-log-stats') // Latency optimization
      
      // Verify latency-specific optimizations
      expect(latencyConfig.latencyMetrics).toBeDefined()
      expect(latencyConfig.optimizationSummary.expectedImprovements.timeToFirstToken).toContain('ms')
    })
  })
})
