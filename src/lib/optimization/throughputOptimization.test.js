/**
 * Unit tests for throughput optimization module
 */

import { describe, it, expect } from 'vitest'
import {
  THROUGHPUT_OPTIMIZATION_CONFIGS,
  calculateOptimalBatchSize,
  calculateMemoryAllocationStrategy,
  estimateThroughputMetrics,
  calculateThroughputOptimizedConfig,
  generateVLLMCommand,
  optimizeForWorkload,
  estimateModelArchitecture,
  calculateVLLMMemoryUsage
} from './throughputOptimization.js'

describe('Throughput Optimization Module', () => {
  describe('THROUGHPUT_OPTIMIZATION_CONFIGS', () => {
    it('should contain required configuration values', () => {
      expect(THROUGHPUT_OPTIMIZATION_CONFIGS).toBeDefined()
      expect(THROUGHPUT_OPTIMIZATION_CONFIGS.cpu).toBeDefined()
      expect(THROUGHPUT_OPTIMIZATION_CONFIGS.gpu).toBeDefined()
      expect(THROUGHPUT_OPTIMIZATION_CONFIGS.gpuMemoryUtilization).toBeDefined()
      expect(THROUGHPUT_OPTIMIZATION_CONFIGS.chunkedPrefillThreshold).toBe(8192)
    })
  })

  describe('calculateOptimalBatchSize', () => {
    const testArchitecture = {
      layers: 32,
      hiddenSize: 4096,
      numHeads: 32
    }

    it('should calculate optimal batch size for given configuration', () => {
      const config = {
        availableMemoryGB: 64,
        modelMemoryGB: 16,
        maxSequenceLength: 2048,
        averageSequenceLength: 512,
        architecture: testArchitecture
      }

      const result = calculateOptimalBatchSize(config)

      expect(result).toHaveProperty('maxNumSeqs')
      expect(result).toHaveProperty('maxNumBatchedTokens')
      expect(result).toHaveProperty('kvCacheMemoryGB')
      expect(result).toHaveProperty('activationMemoryGB')
      expect(result.maxNumSeqs).toBeGreaterThan(0)
      expect(result.maxNumBatchedTokens).toBeGreaterThan(0)
    })

    it('should throw error when model memory exceeds available memory', () => {
      const config = {
        availableMemoryGB: 16,
        modelMemoryGB: 32,
        maxSequenceLength: 2048,
        averageSequenceLength: 512,
        architecture: testArchitecture
      }

      expect(() => calculateOptimalBatchSize(config)).toThrow()
    })

    it('should respect optimal configuration limits', () => {
      const config = {
        availableMemoryGB: 80,
        modelMemoryGB: 8,
        maxSequenceLength: 2048,
        averageSequenceLength: 512,
        architecture: testArchitecture
      }

      const result = calculateOptimalBatchSize(config)

      expect(result.maxNumSeqs).toBeLessThanOrEqual(THROUGHPUT_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsOptimal)
    })
  })

  describe('calculateMemoryAllocationStrategy', () => {
    it('should calculate memory strategy for serving workload', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 16,
        workloadType: 'serving'
      }

      const result = calculateMemoryAllocationStrategy(config)

      expect(result).toHaveProperty('gpuMemoryUtilization')
      expect(result).toHaveProperty('allocatedVRAMGB')
      expect(result).toHaveProperty('kvCacheAllocationGB')
      expect(result).toHaveProperty('recommendedBlockSize')
      expect(result.workloadOptimization).toBe('serving')
      expect(result.gpuMemoryUtilization).toBe(THROUGHPUT_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.balanced)
    })

    it('should use aggressive memory for batch workload', () => {
      const config = {
        totalVRAMGB: 80,
        modelSizeGB: 16,
        workloadType: 'batch'
      }

      const result = calculateMemoryAllocationStrategy(config)

      expect(result.gpuMemoryUtilization).toBe(THROUGHPUT_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.aggressive)
      expect(result.swapSpaceGB).toBeGreaterThan(0)
    })

    it('should throw error when model size exceeds total VRAM', () => {
      const config = {
        totalVRAMGB: 16,
        modelSizeGB: 32
      }

      expect(() => calculateMemoryAllocationStrategy(config)).toThrow()
    })
  })

  describe('estimateThroughputMetrics', () => {
    it('should estimate performance metrics', () => {
      const config = {
        maxNumSeqs: 128,
        maxNumBatchedTokens: 4096,
        modelSizeGB: 16,
        quantization: 'fp16',
        maxSequenceLength: 2048
      }

      const hardwareSpecs = {
        gpuMemoryBandwidthGBps: 900,
        tensorCores: true
      }

      const result = estimateThroughputMetrics(config, hardwareSpecs)

      expect(result).toHaveProperty('tokensPerSecond')
      expect(result).toHaveProperty('requestsPerSecond')
      expect(result).toHaveProperty('latencyEstimate')
      expect(result).toHaveProperty('bottlenecks')
      expect(result.tokensPerSecond).toBeGreaterThan(0)
      expect(result.requestsPerSecond).toBeGreaterThan(0)
    })

    it('should include quantization impact', () => {
      const config = {
        maxNumSeqs: 64,
        maxNumBatchedTokens: 2048,
        modelSizeGB: 8,
        quantization: 'int8'
      }

      const result = estimateThroughputMetrics(config, {})

      expect(result).toHaveProperty('quantizationImpact')
      expect(result.quantizationImpact).toHaveProperty('format')
      expect(result.quantizationImpact).toHaveProperty('speedupFactor')
    })
  })

  describe('calculateThroughputOptimizedConfig', () => {
    it('should generate complete throughput-optimized configuration', () => {
      const params = {
        gpuSpecs: {
          totalVRAMGB: 80,
          memoryBandwidthGBps: 900,
          tensorCores: true
        },
        modelSpecs: {
          numParams: 7,
          quantization: 'fp16'
        },
        workloadSpecs: {
          expectedConcurrentUsers: 100,
          workloadType: 'serving'
        }
      }

      const result = calculateThroughputOptimizedConfig(params)

      expect(result).toHaveProperty('batchConfiguration')
      expect(result).toHaveProperty('memoryConfiguration')
      expect(result).toHaveProperty('performanceEstimate')
      expect(result).toHaveProperty('vllmParameters')
      expect(result).toHaveProperty('optimizationSummary')
    })

    it('should handle flat parameter style', () => {
      const params = {
        totalVRAMGB: 40,
        numParams: 13,
        quantization: 'fp16',
        expectedConcurrentUsers: 50
      }

      const result = calculateThroughputOptimizedConfig(params)

      expect(result).toHaveProperty('batchConfiguration')
      expect(result).toHaveProperty('vllmCommand')
      expect(result.vllmCommand).toContain('python -m vllm.entrypoints.openai.api_server')
    })

    it('should throw error without model size or parameters', () => {
      const params = {
        gpuSpecs: { totalVRAMGB: 80 },
        modelSpecs: {}, // No size or params
        workloadSpecs: {}
      }

      expect(() => calculateThroughputOptimizedConfig(params)).toThrow()
    })
  })

  describe('generateVLLMCommand', () => {
    it('should generate valid vLLM command string', () => {
      const args = {
        model: 'test-model',
        'gpu-memory-utilization': 0.9,
        'max-num-seqs': 128,
        port: 8000,
        'enable-chunked-prefill': true
      }

      const command = generateVLLMCommand(args)

      expect(command).toContain('python -m vllm.entrypoints.openai.api_server')
      expect(command).toContain('--model test-model')
      expect(command).toContain('--gpu-memory-utilization 0.9')
      expect(command).toContain('--max-num-seqs 128')
      expect(command).toContain('--port 8000')
      expect(command).toContain('--enable-chunked-prefill')
    })

    it('should handle boolean and undefined values correctly', () => {
      const args = {
        model: 'test',
        'enable-feature': true,
        'disable-feature': false,
        'undefined-value': undefined
      }

      const command = generateVLLMCommand(args)

      expect(command).toContain('--enable-feature')
      expect(command).not.toContain('--disable-feature')
      expect(command).not.toContain('--undefined-value')
    })
  })

  describe('optimizeForWorkload', () => {
    it('should optimize for chat workload', () => {
      const workloadProfile = {
        workloadType: 'chat',
        averageInputLength: 256,
        averageOutputLength: 128,
        peakConcurrency: 64,
        latencyRequirement: 'low'
      }

      const result = optimizeForWorkload(workloadProfile)

      expect(result.workloadType).toBe('chat')
      expect(result.recommendations.quantization).toBe('fp16')
      expect(result.recommendations.specialFeatures).toHaveProperty('enable-prefix-caching')
    })

    it('should optimize for batch workload', () => {
      const workloadProfile = {
        workloadType: 'batch',
        throughputPriority: 'high'
      }

      const result = optimizeForWorkload(workloadProfile)

      expect(result.optimizations.recommendedQuantization).toBe('awq')
      expect(result.optimizations.memoryStrategy).toBe('aggressive')
      expect(result.recommendations.specialFeatures).toHaveProperty('disable-log-stats')
    })

    it('should adjust for latency requirements', () => {
      const workloadProfile = {
        workloadType: 'serving',
        latencyRequirement: 'low',
        peakConcurrency: 256,
        throughputPriority: 'low' // Set to low to not override latency settings
      }

      const result = optimizeForWorkload(workloadProfile)

      expect(result.optimizations.batchingStrategy.maxNumSeqs).toBeLessThanOrEqual(64)
    })
  })

  describe('estimateModelArchitecture', () => {
    it('should estimate architecture for common model sizes', () => {
      const arch7B = estimateModelArchitecture(7)
      expect(arch7B).toMatchObject({
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32
      })

      const arch13B = estimateModelArchitecture(13)
      expect(arch13B).toMatchObject({
        layers: 40,
        hiddenSize: 5120,
        numHeads: 40
      })

      const arch175B = estimateModelArchitecture(175)
      expect(arch175B).toMatchObject({
        layers: 96,
        hiddenSize: 12288,
        numHeads: 96
      })
    })

    it('should find closest architecture for intermediate sizes', () => {
      const arch8B = estimateModelArchitecture(8)
      // Should be closest to 7B
      expect(arch8B).toMatchObject({
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32
      })
    })
  })

  describe('calculateVLLMMemoryUsage', () => {
    const testArchitecture = {
      layers: 32,
      hiddenSize: 4096,
      numHeads: 32
    }

    it('should calculate memory usage with model size', () => {
      const config = {
        modelSizeGB: 16,
        batchSize: 8,
        maxSeqLen: 2048,
        seqLen: 512,
        architecture: testArchitecture
      }

      const result = calculateVLLMMemoryUsage(config)

      expect(result).toHaveProperty('modelWeights')
      expect(result).toHaveProperty('kvCache')
      expect(result).toHaveProperty('activations')
      expect(result).toHaveProperty('systemOverhead')
      expect(result).toHaveProperty('totalMemory')
      expect(result).toHaveProperty('breakdown')
      expect(result.modelWeights).toBe(16)
      expect(result.totalMemory).toBeGreaterThan(16)
    })

    it('should calculate memory usage with parameter count', () => {
      const config = {
        numParams: 7,
        modelPrecision: 'fp16',
        batchSize: 4,
        maxSeqLen: 1024
      }

      const result = calculateVLLMMemoryUsage(config)

      expect(result.modelWeights).toBeGreaterThan(0)
      expect(result.totalMemory).toBeGreaterThan(result.modelWeights)
      expect(result.breakdown.modelWeightsPercent).toBeGreaterThan(0)
      expect(result.breakdown.modelWeightsPercent).toBeLessThanOrEqual(100)
    })

    it('should throw error without model size or parameters', () => {
      const config = {
        batchSize: 1
      }

      expect(() => calculateVLLMMemoryUsage(config)).toThrow()
    })

    it('should handle different precisions', () => {
      const configFP16 = {
        numParams: 7,
        modelPrecision: 'fp16',
        kvCachePrecision: 'fp16',
        batchSize: 1,
        maxSeqLen: 1024
      }

      const configFP32 = {
        ...configFP16,
        modelPrecision: 'fp32'
      }

      const resultFP16 = calculateVLLMMemoryUsage(configFP16)
      const resultFP32 = calculateVLLMMemoryUsage(configFP32)

      expect(resultFP32.modelWeights).toBeGreaterThan(resultFP16.modelWeights)
    })
  })
})
