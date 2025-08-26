/**
 * Unit tests for optimization configuration constants
 * 
 * Tests the centralized configuration module to ensure:
 * - All config objects are properly defined
 * - Configuration values are within valid ranges
 * - All expected properties exist
 * - Type consistency across configurations
 */

import { describe, it, expect } from 'vitest'
import {
  OPTIMIZATION_STRATEGIES,
  PERFORMANCE_PROFILES,
  WORKLOAD_TYPES,
  PERFORMANCE_PRIORITIES,
  QUANTIZATION_CONFIGS,
  TENSOR_PARALLEL_CONFIGS,
  PIPELINE_PARALLEL_CONFIGS,
  MEMORY_OPTIMIZATION_CONFIGS,
  SERVING_CONFIGS,
  VLLM_PARAMETERS,
  HARDWARE_CONFIGS,
  THROUGHPUT_OPTIMIZATION_CONFIGS,
  LATENCY_OPTIMIZATION_CONFIGS,
  BALANCED_OPTIMIZATION_CONFIGS
} from './optimizationConfigs.js'

describe('Optimization Configs Module', () => {
  describe('THROUGHPUT_OPTIMIZATION_CONFIGS', () => {
    it('should have all required properties', () => {
      expect(THROUGHPUT_OPTIMIZATION_CONFIGS).toBeDefined()
      expect(THROUGHPUT_OPTIMIZATION_CONFIGS.gpu).toBeDefined()
      expect(THROUGHPUT_OPTIMIZATION_CONFIGS.gpuMemoryUtilization).toBeDefined()
      expect(THROUGHPUT_OPTIMIZATION_CONFIGS.batchOptimization).toBeDefined()
    })

    it('should have valid GPU configuration values', () => {
      const gpu = THROUGHPUT_OPTIMIZATION_CONFIGS.gpu
      expect(gpu.maxNumSeqsOptimal).toBeGreaterThan(0)
      expect(gpu.maxNumBatchedTokensOptimal).toBeGreaterThan(0)
      expect(gpu.maxNumSeqsOptimal).toBeLessThan(gpu.maxNumSeqsMaximal)
    })

    it('should have valid memory utilization ranges', () => {
      const mem = THROUGHPUT_OPTIMIZATION_CONFIGS.gpuMemoryUtilization
      expect(mem.conservative).toBeGreaterThan(0)
      expect(mem.conservative).toBeLessThan(1)
      expect(mem.aggressive).toBeGreaterThan(mem.conservative)
      expect(mem.aggressive).toBeLessThan(1)
    })

    it('should have batch optimization settings', () => {
      const batch = THROUGHPUT_OPTIMIZATION_CONFIGS.batchOptimization
      expect(batch.targetBatchUtilization).toBeGreaterThan(0)
      expect(batch.targetBatchUtilization).toBeLessThan(1)
      expect(Array.isArray(batch.optimalBatchSizes)).toBe(true)
    })
  })

  describe('LATENCY_OPTIMIZATION_CONFIGS', () => {
    it('should have all required properties', () => {
      expect(LATENCY_OPTIMIZATION_CONFIGS).toBeDefined()
      expect(LATENCY_OPTIMIZATION_CONFIGS.gpu).toBeDefined()
      expect(LATENCY_OPTIMIZATION_CONFIGS.gpuMemoryUtilization).toBeDefined()
      expect(LATENCY_OPTIMIZATION_CONFIGS.responseTimeTargets).toBeDefined()
    })

    it('should favor low latency over throughput', () => {
      const latencyGpu = LATENCY_OPTIMIZATION_CONFIGS.gpu
      const throughputGpu = THROUGHPUT_OPTIMIZATION_CONFIGS.gpu
      
      // Latency should use smaller batch sizes
      expect(latencyGpu.maxNumSeqsOptimal).toBeLessThan(throughputGpu.maxNumSeqsOptimal)
      expect(latencyGpu.maxNumBatchedTokensOptimal).toBeLessThan(throughputGpu.maxNumBatchedTokensOptimal)
    })

    it('should have conservative memory utilization', () => {
      const latencyMem = LATENCY_OPTIMIZATION_CONFIGS.gpuMemoryUtilization
      const throughputMem = THROUGHPUT_OPTIMIZATION_CONFIGS.gpuMemoryUtilization
      
      expect(latencyMem.conservative).toBeLessThanOrEqual(throughputMem.conservative)
      expect(latencyMem.balanced).toBeLessThanOrEqual(throughputMem.balanced)
    })
  })

  describe('BALANCED_OPTIMIZATION_CONFIGS', () => {
    it('should have all required properties', () => {
      expect(BALANCED_OPTIMIZATION_CONFIGS).toBeDefined()
      expect(BALANCED_OPTIMIZATION_CONFIGS.gpu).toBeDefined()
      expect(BALANCED_OPTIMIZATION_CONFIGS.gpuMemoryUtilization).toBeDefined()
      expect(BALANCED_OPTIMIZATION_CONFIGS.targets).toBeDefined()
    })

    it('should have values between latency and throughput', () => {
      const balancedGpu = BALANCED_OPTIMIZATION_CONFIGS.gpu
      const latencyGpu = LATENCY_OPTIMIZATION_CONFIGS.gpu
      const throughputGpu = THROUGHPUT_OPTIMIZATION_CONFIGS.gpu
      
      // Balanced should be between latency and throughput
      expect(balancedGpu.maxNumSeqsOptimal).toBeGreaterThanOrEqual(latencyGpu.maxNumSeqsOptimal)
      expect(balancedGpu.maxNumSeqsOptimal).toBeLessThanOrEqual(throughputGpu.maxNumSeqsOptimal)
    })

    it('should have optimization targets for different workloads', () => {
      const targets = BALANCED_OPTIMIZATION_CONFIGS.targets
      
      expect(targets.general).toBeDefined()
      expect(targets['web-api']).toBeDefined()
      expect(targets['multi-user']).toBeDefined()
      expect(targets['cost-optimized']).toBeDefined()
      expect(targets.production).toBeDefined()
      
      // Each target should have required properties
      Object.values(targets).forEach(target => {
        expect(target.priority).toBeDefined()
        expect(target.memoryUtil).toBeGreaterThan(0)
        expect(target.memoryUtil).toBeLessThan(1)
        expect(target.maxSeqs).toBeGreaterThan(0)
      })
    })
  })

  describe('WORKLOAD_TYPES', () => {
    it('should have all expected workload types', () => {
      expect(WORKLOAD_TYPES).toBeDefined()
      expect(WORKLOAD_TYPES.chat).toBeDefined()
      expect(WORKLOAD_TYPES.completion).toBeDefined()
      expect(WORKLOAD_TYPES['code-generation']).toBeDefined()
      expect(WORKLOAD_TYPES.batch).toBeDefined()
      expect(WORKLOAD_TYPES.serving).toBeDefined()
      expect(WORKLOAD_TYPES.embedding).toBeDefined()
    })

    it('should have consistent structure for all workload types', () => {
      Object.values(WORKLOAD_TYPES).forEach(workload => {
        expect(workload.name).toBeDefined()
        expect(workload.description).toBeDefined()
        expect(workload.characteristics).toBeDefined()
        expect(workload.optimizations).toBeDefined()
        
        // Characteristics should have required properties
        const chars = workload.characteristics
        expect(chars.averageInputLength).toBeGreaterThan(0)
        expect(chars.averageOutputLength).toBeGreaterThanOrEqual(0)
        expect(chars.burstiness).toBeDefined()
        expect(chars.latencyRequirement).toBeDefined()
        expect(chars.throughputPriority).toBeDefined()
        
        // Optimizations should have required properties
        const opts = workload.optimizations
        expect(opts.priority).toBeDefined()
        expect(opts.batchingStrategy).toBeDefined()
        expect(opts.memoryStrategy).toBeDefined()
        expect(Array.isArray(opts.specialFeatures)).toBe(true)
      })
    })

    it('should have appropriate characteristics for each workload', () => {
      // Chat should prioritize latency
      expect(WORKLOAD_TYPES.chat.characteristics.latencyRequirement).toBe('low')
      expect(WORKLOAD_TYPES.chat.optimizations.priority).toBe('latency')
      
      // Batch should prioritize throughput
      expect(WORKLOAD_TYPES.batch.characteristics.throughputPriority).toBe('very-high')
      expect(WORKLOAD_TYPES.batch.optimizations.priority).toBe('throughput')
      
      // Embedding should have no text output
      expect(WORKLOAD_TYPES.embedding.characteristics.averageOutputLength).toBe(0)
    })
  })

  describe('PERFORMANCE_PRIORITIES', () => {
    it('should have all priority levels', () => {
      expect(PERFORMANCE_PRIORITIES).toBeDefined()
      expect(PERFORMANCE_PRIORITIES.latency).toBeDefined()
      expect(PERFORMANCE_PRIORITIES.throughput).toBeDefined()
      expect(PERFORMANCE_PRIORITIES.balanced).toBeDefined()
      expect(PERFORMANCE_PRIORITIES.quality).toBeDefined()
    })

    it('should have consistent structure for all priorities', () => {
      Object.values(PERFORMANCE_PRIORITIES).forEach(priority => {
        expect(priority.name).toBeDefined()
        expect(priority.batchSizeMultiplier).toBeGreaterThan(0)
        expect(priority.memoryUtilization).toBeGreaterThan(0)
        expect(priority.memoryUtilization).toBeLessThanOrEqual(1)
        expect(priority.specialSettings).toBeDefined()
      })
    })

    it('should have appropriate multipliers for each priority', () => {
      // Latency should have lower batch size multiplier
      expect(PERFORMANCE_PRIORITIES.latency.batchSizeMultiplier).toBeLessThan(1)
      
      // Throughput should have higher batch size multiplier
      expect(PERFORMANCE_PRIORITIES.throughput.batchSizeMultiplier).toBeGreaterThan(1)
      
      // Balanced should be around 1
      expect(PERFORMANCE_PRIORITIES.balanced.batchSizeMultiplier).toBe(1.0)
    })
  })

  describe('VLLM_PARAMETERS', () => {
    it('should be defined and have parameters', () => {
      expect(VLLM_PARAMETERS).toBeDefined()
      expect(Object.keys(VLLM_PARAMETERS).length).toBeGreaterThan(0)
    })

    it('should have required model parameter', () => {
      expect(VLLM_PARAMETERS.model).toBeDefined()
      expect(VLLM_PARAMETERS.model.type).toBe('string')
      expect(VLLM_PARAMETERS.model.required).toBe(true)
    })

    it('should have consistent parameter structure', () => {
      Object.entries(VLLM_PARAMETERS).forEach(([key, param]) => {
        expect(param.type).toBeDefined()
        expect(param.description).toBeDefined()
        expect(typeof param.type).toBe('string')
        expect(typeof param.description).toBe('string')
        
        // If options are provided, should be an array
        if (param.options) {
          expect(Array.isArray(param.options)).toBe(true)
        }
      })
    })

    it('should have memory-related parameters', () => {
      expect(VLLM_PARAMETERS['gpu-memory-utilization']).toBeDefined()
      expect(VLLM_PARAMETERS['max-model-len']).toBeDefined()
      expect(VLLM_PARAMETERS['max-num-seqs']).toBeDefined()
      expect(VLLM_PARAMETERS['max-num-batched-tokens']).toBeDefined()
    })

    it('should have performance-related parameters', () => {
      expect(VLLM_PARAMETERS['tensor-parallel-size']).toBeDefined()
      expect(VLLM_PARAMETERS['block-size']).toBeDefined()
      expect(VLLM_PARAMETERS['enable-chunked-prefill']).toBeDefined()
    })
  })

  describe('HARDWARE_CONFIGS', () => {
    it('should be defined and have GPU optimizations', () => {
      expect(HARDWARE_CONFIGS).toBeDefined()
      expect(HARDWARE_CONFIGS.gpuOptimizations).toBeDefined()
    })

    it('should have configurations for common GPUs', () => {
      const gpuOpts = HARDWARE_CONFIGS.gpuOptimizations
      
      // Should have at least a few common GPU types
      expect(Object.keys(gpuOpts).length).toBeGreaterThan(0)
      
      // Each GPU config should have required properties
      Object.values(gpuOpts).forEach(gpu => {
        expect(gpu.memoryBandwidth).toBeGreaterThan(0)
        expect(gpu.recommendedBlockSize).toBeGreaterThan(0)
        expect(gpu.maxBatchSize).toBeGreaterThan(0)
      })
    })
  })

  describe('Configuration Consistency', () => {
    it('should have no conflicting optimization strategies', () => {
      // Latency configs should consistently favor speed over throughput
      expect(LATENCY_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsOptimal)
        .toBeLessThan(THROUGHPUT_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsOptimal)
      
      // Balanced should be between the two
      expect(BALANCED_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsOptimal)
        .toBeGreaterThanOrEqual(LATENCY_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsOptimal)
      expect(BALANCED_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsOptimal)
        .toBeLessThanOrEqual(THROUGHPUT_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsOptimal)
    })

    it('should have workload types matching performance priorities', () => {
      // Workload types should reference valid performance priorities
      Object.values(WORKLOAD_TYPES).forEach(workload => {
        const priority = workload.optimizations.priority
        
        // Priority should be one of the defined performance priorities or a strategy
        const validPriorities = [...Object.keys(PERFORMANCE_PRIORITIES), 'latency', 'throughput', 'balanced', 'quality']
        expect(validPriorities).toContain(priority)
      })
    })
  })
})
