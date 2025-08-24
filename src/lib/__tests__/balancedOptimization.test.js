import { describe, it, expect } from 'vitest'
import {
  calculateBalancedBatchSize,
  calculateBalancedMemoryStrategy,
  estimateBalancedMetrics,
  calculateBalancedOptimizedConfig,
  optimizeForBalance,
} from '../calculationEngine.js'

describe('Balanced Optimization Functions', () => {
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

  describe('calculateBalancedBatchSize', () => {
    it('should calculate balanced batch size for general workload', () => {
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
        balanceTarget: 'general'
      }
      
      const result = calculateBalancedBatchSize(batchConfig)
      
      expect(result).toHaveProperty('maxNumSeqs')
      expect(result).toHaveProperty('maxNumBatchedTokens')
      expect(result).toHaveProperty('memoryUtilization')
      expect(result).toHaveProperty('balanceTarget')
      expect(result).toHaveProperty('reasoning')
      
      expect(result.maxNumSeqs).toBeGreaterThan(8) // At least minimum
      expect(result.maxNumSeqs).toBeLessThan(256) // Lower than throughput
      expect(result.maxNumBatchedTokens).toBe(4096) // Balanced default
      expect(result.balanceTarget).toBe('general')
      expect(result.reasoning.optimizationFocus).toBe('balanced_performance')
    })

    it('should handle web-api balance target with conservative settings', () => {
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
        balanceTarget: 'web-api'
      }
      
      const result = calculateBalancedBatchSize(batchConfig)
      
      expect(result.balanceTarget).toBe('web-api')
      expect(result.maxNumSeqs).toBeLessThanOrEqual(96) // Conservative for web APIs
      expect(result.reasoning.selectedTarget.priority).toBe('latency-focused')
    })

    it('should handle multi-user balance target with higher concurrency', () => {
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
        balanceTarget: 'multi-user'
      }
      
      const result = calculateBalancedBatchSize(batchConfig)
      
      expect(result.balanceTarget).toBe('multi-user')
      expect(result.maxNumSeqs).toBeLessThanOrEqual(160) // Higher for multi-user
      expect(result.reasoning.selectedTarget.priority).toBe('throughput-focused')
    })

    it('should handle cost-optimized balance target', () => {
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
        balanceTarget: 'cost-optimized'
      }
      
      const result = calculateBalancedBatchSize(batchConfig)
      
      expect(result.balanceTarget).toBe('cost-optimized')
      expect(result.maxNumSeqs).toBeLessThanOrEqual(64) // Lower for cost optimization
      expect(result.reasoning.selectedTarget.priority).toBe('efficiency')
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
      
      expect(() => calculateBalancedBatchSize(batchConfig)).toThrow('Available memory must be greater than model memory')
    })
  })

  describe('calculateBalancedMemoryStrategy', () => {
    it('should calculate balanced memory allocation', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        targetBatchSize: 96,
        workloadType: 'serving',
        balancePriority: 'balanced'
      }
      
      const result = calculateBalancedMemoryStrategy(config)
      
      expect(result).toHaveProperty('gpuMemoryUtilization')
      expect(result).toHaveProperty('allocatedVRAMGB')
      expect(result).toHaveProperty('kvCacheAllocationGB')
      expect(result).toHaveProperty('recommendedBlockSize')
      expect(result).toHaveProperty('balanceOptimizations')
      
      expect(result.gpuMemoryUtilization).toBe(0.85) // Balanced default
      expect(result.recommendedBlockSize).toBe(16) // Balanced block size
      expect(result.enableChunkedPrefill).toBe(true) // Enabled for reasonable batch size
      expect(result.balanceOptimizations.moderatePreemption).toBe(true)
    })

    it('should use performance settings for performance priority', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        targetBatchSize: 128,
        workloadType: 'serving',
        balancePriority: 'performance'
      }
      
      const result = calculateBalancedMemoryStrategy(config)
      
      expect(result.gpuMemoryUtilization).toBe(0.90) // Higher for performance
      expect(result.recommendedBlockSize).toBe(24) // Larger for performance
      expect(result.balanceOptimizations.adaptiveBatching).toBe(true)
    })

    it('should use conservative settings for conservative priority', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        targetBatchSize: 64,
        workloadType: 'serving',
        balancePriority: 'conservative'
      }
      
      const result = calculateBalancedMemoryStrategy(config)
      
      expect(result.gpuMemoryUtilization).toBe(0.80) // Lower for conservative
      expect(result.recommendedBlockSize).toBe(16)
      expect(result.balanceOptimizations.stableAllocation).toBe(true)
    })

    it('should throw error when total VRAM is less than model size', () => {
      const config = {
        totalVRAMGB: 10,
        modelSizeGB: 13.5,
        targetBatchSize: 96,
        workloadType: 'serving'
      }
      
      expect(() => calculateBalancedMemoryStrategy(config)).toThrow('Total VRAM must be greater than model size')
    })
  })

  describe('estimateBalancedMetrics', () => {
    it('should estimate balanced performance metrics', () => {
      const config = {
        maxNumSeqs: 96,
        modelSizeGB: 13.5,
        quantization: 'fp16',
        maxSequenceLength: 2048,
      }
      
      const result = estimateBalancedMetrics(config, mockGpuSpecs, 'balanced')
      
      expect(result).toHaveProperty('tokensPerSecond')
      expect(result).toHaveProperty('requestsPerSecond')
      expect(result).toHaveProperty('timeToFirstToken')
      expect(result).toHaveProperty('interTokenLatency')
      expect(result).toHaveProperty('balanceMetrics')
      expect(result).toHaveProperty('latencyPercentiles')
      expect(result).toHaveProperty('utilizationEfficiency')
      expect(result).toHaveProperty('recommendations')
      
      expect(result.tokensPerSecond).toBeGreaterThan(0)
      expect(result.timeToFirstToken).toBeGreaterThan(0)
      expect(result.balanceMetrics.overallBalanceScore).toBeGreaterThan(0)
      expect(result.balanceMetrics.overallBalanceScore).toBeLessThanOrEqual(1)
      expect(['excellent', 'good', 'fair', 'poor']).toContain(result.balanceMetrics.performanceClass)
      expect(result.optimizationLevel).toBe('balanced')
    })

    it('should handle performance optimization level', () => {
      const config = {
        maxNumSeqs: 128,
        modelSizeGB: 13.5,
        quantization: 'fp16',
        maxSequenceLength: 2048,
      }
      
      const result = estimateBalancedMetrics(config, mockGpuSpecs, 'performance')
      
      expect(result.optimizationLevel).toBe('performance')
      expect(result.utilizationEfficiency).toBe(0.75) // Higher utilization for performance
      expect(result.tokensPerSecond).toBeGreaterThan(0)
    })

    it('should handle conservative optimization level', () => {
      const config = {
        maxNumSeqs: 64,
        modelSizeGB: 13.5,
        quantization: 'fp16',
        maxSequenceLength: 2048,
      }
      
      const result = estimateBalancedMetrics(config, mockGpuSpecs, 'conservative')
      
      expect(result.optimizationLevel).toBe('conservative')
      expect(result.utilizationEfficiency).toBe(0.55) // Lower utilization for conservative
      expect(result.balanceMetrics).toBeDefined()
    })

    it('should provide performance analysis and recommendations', () => {
      const config = {
        maxNumSeqs: 96,
        modelSizeGB: 13.5,
        quantization: 'fp16',
        maxSequenceLength: 2048,
      }
      
      const result = estimateBalancedMetrics(config, mockGpuSpecs, 'balanced')
      
      expect(result.balanceMetrics.throughputScore).toBeGreaterThanOrEqual(0)
      expect(result.balanceMetrics.latencyScore).toBeGreaterThanOrEqual(0)
      expect(result.recommendations).toHaveProperty('increaseMemoryUtil')
      expect(result.recommendations).toHaveProperty('reduceBatchSize')
      expect(Array.isArray(result.bottlenecks)).toBe(true)
    })
  })

  describe('calculateBalancedOptimizedConfig', () => {
    it('should generate complete balanced configuration', () => {
      const config = {
        gpuSpecs: {
          totalVRAMGB: 80,
          memoryBandwidthGBps: 1935,
          tensorCores: true,
        },
        modelSpecs: mockModelSpecs,
        workloadSpecs: {
          expectedConcurrentUsers: 96,
          averageSequenceLength: 512,
          maxSequenceLength: 2048,
          workloadType: 'serving',
          balanceTarget: 'general',
        }
      }
      
      const result = calculateBalancedOptimizedConfig(config)
      
      expect(result).toHaveProperty('batchConfiguration')
      expect(result).toHaveProperty('memoryConfiguration')
      expect(result).toHaveProperty('balancedEstimate')
      expect(result).toHaveProperty('vllmParameters')
      expect(result).toHaveProperty('optimizationSummary')
      expect(result).toHaveProperty('vllmCommand')
      
      expect(result.batchConfiguration.maxNumSeqs).toBeLessThan(200) // Balanced range
      expect(result.batchConfiguration.maxNumSeqs).toBeGreaterThan(8) // More than minimum
      expect(result.memoryConfiguration.gpuMemoryUtilization).toBeLessThanOrEqual(0.90)
      expect(result.balancedEstimate.balanceMetrics.overallBalanceScore).toBeGreaterThan(0)
      expect(result.vllmCommand).toContain('python -m vllm.entrypoints.openai.api_server')
    })

    it('should include optimization summary with balance information', () => {
      const config = {
        gpuSpecs: {
          totalVRAMGB: 80,
          memoryBandwidthGBps: 1935,
        },
        modelSpecs: mockModelSpecs,
        workloadSpecs: {
          balanceTarget: 'web-api'
        }
      }
      
      const result = calculateBalancedOptimizedConfig(config)
      
      expect(result.optimizationSummary).toHaveProperty('primaryOptimizations')
      expect(result.optimizationSummary).toHaveProperty('tradeoffs')
      expect(result.optimizationSummary).toHaveProperty('expectedImprovements')
      
      expect(Array.isArray(result.optimizationSummary.primaryOptimizations)).toBe(true)
      expect(Array.isArray(result.optimizationSummary.tradeoffs)).toBe(true)
      expect(result.optimizationSummary.expectedImprovements).toHaveProperty('balanceScore')
      expect(result.optimizationSummary.expectedImprovements).toHaveProperty('throughputPerformance')
      expect(result.optimizationSummary.expectedImprovements).toHaveProperty('latencyPerformance')
    })

    it('should handle flat configuration parameters', () => {
      const flatConfig = {
        gpu: { memory: 80, count: 1 },
        model: 'meta-llama/Llama-2-7b-hf',
        quantization: 'fp16',
        balanceTarget: 'production',
        modelSpecs: mockModelSpecs,
        gpuSpecs: mockGpuSpecs,
        workloadSpecs: {
          balanceTarget: 'production'
        }
      }
      
      const result = calculateBalancedOptimizedConfig(flatConfig)
      
      expect(result).toBeDefined()
      expect(result.batchConfiguration.balanceTarget).toBe('production')
      expect(result.vllmCommand).toContain('python -m vllm.entrypoints.openai.api_server')
    })

    it('should configure chunked prefill for longer sequences', () => {
      const config = {
        gpuSpecs: { totalVRAMGB: 80 },
        modelSpecs: mockModelSpecs,
        workloadSpecs: {
          maxSequenceLength: 4096, // Long sequences
          balanceTarget: 'general'
        }
      }
      
      const result = calculateBalancedOptimizedConfig(config)
      
      expect(result.vllmCommand).toContain('--enable-chunked-prefill')
      expect(result.vllmCommand).toContain('--max-chunked-prefill-tokens')
    })
  })

  describe('optimizeForBalance', () => {
    it('should optimize for general workload with balanced settings', () => {
      const workloadProfile = {
        workloadType: 'general',
        averageInputLength: 256,
        averageOutputLength: 100,
        peakConcurrency: 96,
        performancePriority: 'balanced',
        costSensitivity: 'medium',
        reliabilityRequirement: 'standard',
      }
      
      const result = optimizeForBalance(workloadProfile)
      
      expect(result).toHaveProperty('workloadType')
      expect(result).toHaveProperty('balanceTarget')
      expect(result).toHaveProperty('optimizations')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('reasoning')
      
      expect(result.workloadType).toBe('general')
      expect(result.balanceTarget).toBe('general')
      expect(result.optimizations.batchingStrategy.maxNumSeqs).toBeLessThanOrEqual(128)
      expect(result.optimizations.balanceSettings.gpuMemoryUtilization).toBe(0.85)
      expect(result.optimizations.recommendedQuantization).toBe('fp16')
    })

    it('should optimize for web-api workload with latency focus', () => {
      const workloadProfile = {
        workloadType: 'web-api',
        averageInputLength: 200,
        averageOutputLength: 80,
        peakConcurrency: 64,
        performancePriority: 'latency',
        costSensitivity: 'low',
        reliabilityRequirement: 'high',
      }
      
      const result = optimizeForBalance(workloadProfile)
      
      expect(result.workloadType).toBe('web-api')
      expect(result.balanceTarget).toBe('web-api')
      expect(result.optimizations.batchingStrategy.maxNumSeqs).toBeLessThanOrEqual(96)
      expect(result.optimizations.balanceSettings.gpuMemoryUtilization).toBe(0.75) // 0.80 - 0.05 due to latency priority
      expect(result.optimizations.specialSettings).toHaveProperty('api-key')
    })

    it('should optimize for multi-user workload with throughput focus', () => {
      const workloadProfile = {
        workloadType: 'multi-user',
        averageInputLength: 300,
        averageOutputLength: 150,
        peakConcurrency: 128,
        performancePriority: 'throughput',
        costSensitivity: 'medium',
        reliabilityRequirement: 'standard',
      }
      
      const result = optimizeForBalance(workloadProfile)
      
      expect(result.workloadType).toBe('multi-user')
      expect(result.balanceTarget).toBe('multi-user')
      expect(result.optimizations.batchingStrategy.maxNumSeqs).toBeLessThanOrEqual(240) // 160 * 1.5 = 240, capped at 192
      expect(result.optimizations.balanceSettings.gpuMemoryUtilization).toBe(0.95) // 0.90 + 0.05 due to throughput priority
      expect(result.optimizations.specialSettings['enable-prefix-caching']).toBe(true)
    })

    it('should optimize for cost-optimized workload', () => {
      const workloadProfile = {
        workloadType: 'cost-optimized',
        averageInputLength: 200,
        averageOutputLength: 100,
        peakConcurrency: 48,
        performancePriority: 'balanced',
        costSensitivity: 'high',
        reliabilityRequirement: 'standard',
      }
      
      const result = optimizeForBalance(workloadProfile)
      
      expect(result.workloadType).toBe('cost-optimized')
      expect(result.balanceTarget).toBe('cost-optimized')
      expect(result.optimizations.batchingStrategy.maxNumSeqs).toBeLessThanOrEqual(64)
      expect(result.optimizations.recommendedQuantization).toBe('awq') // Cost-efficient
      expect(result.optimizations.specialSettings['disable-log-stats']).toBe(true)
    })

    it('should optimize for production workload with reliability focus', () => {
      const workloadProfile = {
        workloadType: 'production',
        averageInputLength: 256,
        averageOutputLength: 120,
        peakConcurrency: 80,
        performancePriority: 'balanced',
        costSensitivity: 'medium',
        reliabilityRequirement: 'high',
      }
      
      const result = optimizeForBalance(workloadProfile)
      
      expect(result.workloadType).toBe('production')
      expect(result.balanceTarget).toBe('production')
      expect(result.optimizations.batchingStrategy.maxNumSeqs).toBeLessThanOrEqual(96)
      expect(result.optimizations.balanceSettings.gpuMemoryUtilization).toBe(0.75) // Conservative for reliability
      expect(result.optimizations.specialSettings['enforce-eager']).toBe(false)
      expect(result.optimizations.specialSettings['disable-log-requests']).toBe(true)
    })

    it('should provide balance considerations and reasoning', () => {
      const workloadProfile = {
        workloadType: 'general',
        performancePriority: 'balanced',
        costSensitivity: 'medium',
        reliabilityRequirement: 'standard',
        peakConcurrency: 96,
      }
      
      const result = optimizeForBalance(workloadProfile)
      
      expect(result.reasoning).toHaveProperty('balanceConsiderations')
      expect(result.reasoning).toHaveProperty('performancePriority')
      expect(result.reasoning).toHaveProperty('costImpact')
      expect(result.reasoning).toHaveProperty('reliabilityLevel')
      expect(result.reasoning).toHaveProperty('expectedBalance')
      
      expect(Array.isArray(result.reasoning.balanceConsiderations)).toBe(true)
      expect(result.reasoning.balanceConsiderations.length).toBeGreaterThan(0)
      expect(result.reasoning.performancePriority).toBe('balanced')
      expect(result.reasoning.expectedBalance).toContain('96 concurrent users')
    })
  })

  describe('Integration Tests', () => {
    it('should work end-to-end for balanced optimization workflow', () => {
      // Step 1: Get balance-specific workload optimizations
      const workloadProfile = {
        workloadType: 'general',
        averageInputLength: 250,
        averageOutputLength: 100,
        peakConcurrency: 96,
        performancePriority: 'balanced',
        costSensitivity: 'medium',
        reliabilityRequirement: 'standard',
      }
      
      const workloadOpt = optimizeForBalance(workloadProfile)
      expect(workloadOpt).toBeDefined()
      expect(workloadOpt.workloadType).toBe('general')
      
      // Step 2: Apply to full configuration
      const enhancedConfig = {
        model: 'meta-llama/Llama-2-7b-hf',
        gpu: { model: 'A100', memory: 80, count: 1 },
        workload: { maxSeqLen: 2048, concurrentRequests: 96, averageTokensPerRequest: 350 },
        balanceTarget: workloadOpt.balanceTarget,
        memoryStrategy: workloadOpt.optimizations.memoryStrategy,
        modelSpecs: mockModelSpecs,
        gpuSpecs: mockGpuSpecs,
      }
      
      // Step 3: Calculate balanced configuration
      const balancedConfig = calculateBalancedOptimizedConfig(enhancedConfig)
      expect(balancedConfig).toBeDefined()
      expect(balancedConfig.vllmCommand).toBeDefined()
      
      // Verify the configuration is coherent and balanced
      expect(balancedConfig.batchConfiguration.maxNumSeqs).toBeGreaterThan(8) // Higher than minimum
      expect(balancedConfig.batchConfiguration.maxNumSeqs).toBeLessThan(200) // Lower than max throughput
      expect(balancedConfig.memoryConfiguration.gpuMemoryUtilization).toBeGreaterThan(0.75)
      expect(balancedConfig.memoryConfiguration.gpuMemoryUtilization).toBeLessThanOrEqual(0.95)
      expect(balancedConfig.balancedEstimate.balanceMetrics.overallBalanceScore).toBeGreaterThan(0)
      
      // Verify command generation works
      expect(typeof balancedConfig.vllmCommand).toBe('string')
      expect(balancedConfig.vllmCommand).toContain('python -m vllm.entrypoints.openai.api_server')
      
      // Verify balanced-specific optimizations
      expect(balancedConfig.balanceMetrics).toBeDefined()
      expect(balancedConfig.optimizationSummary.expectedImprovements.balanceScore).toContain('%')
      expect(balancedConfig.balancedEstimate.balanceMetrics.performanceClass).toBeDefined()
      
      // Verify both throughput and latency metrics are provided
      expect(balancedConfig.balancedEstimate.tokensPerSecond).toBeGreaterThan(0)
      expect(balancedConfig.balancedEstimate.timeToFirstToken).toBeGreaterThan(0)
    })

    it('should provide balanced performance between throughput and latency', () => {
      const config = {
        gpuSpecs: { totalVRAMGB: 80, memoryBandwidthGBps: 1935 },
        modelSpecs: mockModelSpecs,
        workloadSpecs: { balanceTarget: 'general' }
      }
      
      const balancedResult = calculateBalancedOptimizedConfig(config)
      
      // Balanced should be between throughput and latency extremes
      expect(balancedResult.batchConfiguration.maxNumSeqs).toBeLessThan(256) // Less than throughput max
      expect(balancedResult.batchConfiguration.maxNumSeqs).toBeGreaterThan(8) // More than minimum
      expect(balancedResult.memoryConfiguration.gpuMemoryUtilization).toBeLessThan(0.95) // Less than throughput
      expect(balancedResult.memoryConfiguration.gpuMemoryUtilization).toBeGreaterThan(0.75) // More than latency
      
      // Should have reasonable balance score
      expect(balancedResult.balancedEstimate.balanceMetrics.overallBalanceScore).toBeGreaterThan(0.3)
      expect(['excellent', 'good', 'fair']).toContain(balancedResult.balancedEstimate.balanceMetrics.performanceClass)
    })
  })
})
