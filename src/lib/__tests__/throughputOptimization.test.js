import { describe, it, expect } from 'vitest'
import {
  calculateOptimalBatchSize,
  calculateMemoryAllocationStrategy,
  estimateThroughputMetrics,
  calculateThroughputOptimizedConfig,
  optimizeForWorkload,
  generateVLLMCommand,
} from '../calculationEngine.js'

describe('Throughput Optimization Functions', () => {
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

  describe('calculateOptimalBatchSize', () => {
    it('should calculate optimal batch size for single GPU', () => {
      const batchConfig = {
        availableMemoryGB: 80,
        modelMemoryGB: 13.5,
        maxSequenceLength: 2048,
        averageSequenceLength: 512,
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32,
        }
      }
      
      const result = calculateOptimalBatchSize(batchConfig)
      
      expect(result).toHaveProperty('maxNumSeqs')
      expect(result).toHaveProperty('maxNumBatchedTokens')
      expect(result).toHaveProperty('memoryUtilization')
      expect(result).toHaveProperty('reasoning')
      
      expect(result.maxNumSeqs).toBeGreaterThan(0)
      expect(result.maxNumBatchedTokens).toBeGreaterThan(0)
      expect(result.memoryUtilization).toBeGreaterThan(0)
      expect(result.memoryUtilization).toBeLessThanOrEqual(1)
    })

    it('should throw error when available memory is less than model memory', () => {
      const invalidConfig = {
        availableMemoryGB: 10, // Less than model size
        modelMemoryGB: 13.5,
        maxSequenceLength: 2048,
        averageSequenceLength: 512,
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32,
        }
      }
      
      expect(() => calculateOptimalBatchSize(invalidConfig)).toThrow('Available memory must be greater than model memory')
    })

    it('should handle multi-GPU memory calculations', () => {
      const multiGpuConfig = {
        availableMemoryGB: 320, // 4x A100
        modelMemoryGB: 13.5,
        maxSequenceLength: 2048,
        averageSequenceLength: 512,
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32,
        }
      }
      
      const result = calculateOptimalBatchSize(multiGpuConfig)
      
      expect(result.maxNumSeqs).toBeGreaterThan(0)
      expect(result.memoryUtilization).toBeLessThanOrEqual(1)
    })
  })

  describe('calculateMemoryAllocationStrategy', () => {
    it('should calculate memory allocation for serving workload', () => {
      const memoryConfig = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        workloadType: 'serving'
      }
      
      const result = calculateMemoryAllocationStrategy(memoryConfig)
      
      expect(result).toHaveProperty('gpuMemoryUtilization')
      expect(result).toHaveProperty('swapSpaceGB')
      expect(result).toHaveProperty('allocatedVRAMGB')
      expect(result).toHaveProperty('memoryBreakdown')
      expect(result).toHaveProperty('workloadOptimization')
      
      expect(result.gpuMemoryUtilization).toBeGreaterThan(0)
      expect(result.gpuMemoryUtilization).toBeLessThanOrEqual(1)
      expect(result.workloadOptimization).toBe('serving')
    })

    it('should use aggressive memory utilization for batch workload', () => {
      const batchConfig = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        workloadType: 'batch'
      }
      
      const result = calculateMemoryAllocationStrategy(batchConfig)
      
      expect(result.workloadOptimization).toBe('batch')
      expect(result.gpuMemoryUtilization).toBeGreaterThan(0.9) // Aggressive utilization
      expect(result.swapSpaceGB).toBeGreaterThan(0)
    })

    it('should use conservative memory utilization for mixed workload', () => {
      const mixedConfig = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        workloadType: 'mixed'
      }
      
      const result = calculateMemoryAllocationStrategy(mixedConfig)
      
      expect(result.workloadOptimization).toBe('mixed')
      expect(result.gpuMemoryUtilization).toBeLessThan(0.9) // Conservative utilization
    })

    it('should throw error when total VRAM is less than model size', () => {
      const invalidConfig = {
        totalVRAMGB: 10, // Less than model size
        modelSizeGB: 13.5,
        workloadType: 'serving'
      }
      
      expect(() => calculateMemoryAllocationStrategy(invalidConfig)).toThrow('Total VRAM must be greater than model size')
    })
  })

  describe('estimateThroughputMetrics', () => {
    it('should estimate throughput metrics with valid inputs', () => {
      const throughputConfig = {
        maxNumSeqs: 128,
        maxNumBatchedTokens: 8192,
        modelSizeGB: 13.5,
        quantization: 'fp16',
        maxSequenceLength: 2048,
      }
      
      const result = estimateThroughputMetrics(throughputConfig, mockGpuSpecs)
      
      expect(result).toHaveProperty('tokensPerSecond')
      expect(result).toHaveProperty('requestsPerSecond')
      expect(result).toHaveProperty('latencyEstimate')
      expect(result).toHaveProperty('utilizationEfficiency')
      expect(result).toHaveProperty('bottlenecks')
      
      expect(result.tokensPerSecond).toBeGreaterThan(0)
      expect(result.requestsPerSecond).toBeGreaterThan(0)
      expect(result.latencyEstimate.p50).toBeGreaterThan(0)
      expect(result.latencyEstimate.p95).toBeGreaterThan(result.latencyEstimate.p50)
      expect(Array.isArray(result.bottlenecks)).toBe(true)
    })

    it('should handle different quantization methods', () => {
      const quantizationTypes = ['fp16', 'int8', 'awq', 'gptq']
      
      quantizationTypes.forEach(quantization => {
        const config = {
          maxNumSeqs: 128,
          maxNumBatchedTokens: 8192,
          modelSizeGB: 13.5,
          quantization,
          maxSequenceLength: 2048,
        }
        
        const result = estimateThroughputMetrics(config, mockGpuSpecs)
        expect(result.tokensPerSecond).toBeGreaterThan(0)
        expect(result.requestsPerSecond).toBeGreaterThan(0)
      })
    })
  })

  describe('calculateThroughputOptimizedConfig', () => {
    it('should generate complete throughput-optimized configuration', () => {
      const fullConfig = {
        model: 'meta-llama/Llama-2-7b-hf',
        gpu: {
          model: 'A100',
          memory: 80,
          count: 1,
        },
        workload: {
          maxSeqLen: 2048,
          concurrentRequests: 100,
          averageTokensPerRequest: 512,
        },
        modelSpecs: mockModelSpecs,
        gpuSpecs: mockGpuSpecs,
      }
      
      const result = calculateThroughputOptimizedConfig(fullConfig)
      
      expect(result).toHaveProperty('batchConfiguration')
      expect(result).toHaveProperty('memoryConfiguration')
      expect(result).toHaveProperty('performanceEstimate')
      expect(result).toHaveProperty('vllmParameters')
      expect(result).toHaveProperty('optimizationSummary')
      expect(result).toHaveProperty('vllmCommand')
      
      // Verify nested structures
      expect(result.batchConfiguration).toHaveProperty('maxNumSeqs')
      expect(result.memoryConfiguration).toHaveProperty('gpuMemoryUtilization')
      expect(result.performanceEstimate).toHaveProperty('tokensPerSecond')
      expect(result.vllmParameters).toHaveProperty('model')
      expect(typeof result.vllmCommand).toBe('string')
    })

    it('should include optimization summary with expected properties', () => {
      const config = {
        model: 'meta-llama/Llama-2-7b-hf',
        gpu: { model: 'A100', memory: 80, count: 1 },
        workload: { maxSeqLen: 2048, concurrentRequests: 100, averageTokensPerRequest: 512 },
        modelSpecs: mockModelSpecs,
        gpuSpecs: mockGpuSpecs,
      }
      
      const result = calculateThroughputOptimizedConfig(config)
      
      expect(result.optimizationSummary).toHaveProperty('primaryOptimizations')
      expect(result.optimizationSummary).toHaveProperty('tradeoffs')
      expect(result.optimizationSummary).toHaveProperty('expectedImprovements')
      
      expect(Array.isArray(result.optimizationSummary.primaryOptimizations)).toBe(true)
      expect(Array.isArray(result.optimizationSummary.tradeoffs)).toBe(true)
    })
  })

  describe('optimizeForWorkload', () => {
    it('should optimize for chat workload with appropriate settings', () => {
      const workloadProfile = {
        workloadType: 'chat',
        averageInputLength: 100,
        averageOutputLength: 50,
        peakConcurrency: 50,
        latencyRequirement: 'low',
        throughputPriority: 'medium',
      }
      
      const result = optimizeForWorkload(workloadProfile)
      
      expect(result.workloadType).toBe('chat')
      expect(result.optimizations.recommendedQuantization).toBe('fp16') // Quality for chat
      expect(result.optimizations.specialSettings['enable-prefix-caching']).toBe(true)
      expect(result.recommendations.batchConfiguration.enableChunkedPrefill).toBe(true)
      expect(result.inputProfile.averageInputLength).toBe(100)
      expect(result.inputProfile.averageOutputLength).toBe(50)
      expect(result.inputProfile.totalSequenceLength).toBe(150)
    })

    it('should optimize for batch workload with aggressive settings', () => {
      const workloadProfile = {
        workloadType: 'batch',
        averageInputLength: 512,
        averageOutputLength: 200,
        peakConcurrency: 1000,
        latencyRequirement: 'high',
        throughputPriority: 'high',
      }
      
      const result = optimizeForWorkload(workloadProfile)
      
      expect(result.workloadType).toBe('batch')
      expect(result.optimizations.recommendedQuantization).toBe('awq') // Memory efficiency
      expect(result.optimizations.memoryStrategy).toBe('aggressive')
      expect(result.optimizations.specialSettings['disable-log-stats']).toBe(true)
    })

    it('should optimize for code generation with precision settings', () => {
      const workloadProfile = {
        workloadType: 'code-generation',
        averageInputLength: 1000,
        averageOutputLength: 500,
        peakConcurrency: 20,
        latencyRequirement: 'balanced',
        throughputPriority: 'medium',
      }
      
      const result = optimizeForWorkload(workloadProfile)
      
      expect(result.workloadType).toBe('code-generation')
      expect(result.optimizations.recommendedQuantization).toBe('fp16') // Precision for code
      expect(result.optimizations.specialSettings['enable-prefix-caching']).toBe(true)
      expect(result.recommendations.batchConfiguration.enableChunkedPrefill).toBe(true)
    })

    it('should provide workload considerations and reasoning', () => {
      const workloadProfile = { workloadType: 'completion' }
      const result = optimizeForWorkload(workloadProfile)
      
      expect(result.reasoning.workloadConsiderations).toBeDefined()
      expect(Array.isArray(result.reasoning.workloadConsiderations)).toBe(true)
      expect(result.reasoning.workloadConsiderations.length).toBeGreaterThan(0)
    })
  })

  describe('generateVLLMCommand', () => {
    it('should generate basic vLLM command with required parameters', () => {
      const sampleConfig = {
        model: 'meta-llama/Llama-2-7b-hf',
        maxNumSeqs: 128,
        maxNumBatchedTokens: 8192,
        gpuMemoryUtilization: 0.9,
      }
      
      const command = generateVLLMCommand(sampleConfig)
      
      expect(typeof command).toBe('string')
      expect(command).toContain('python -m vllm.entrypoints.openai.api_server')
      expect(command).toContain('--model meta-llama/Llama-2-7b-hf')
      expect(command).toContain('--max-num-seqs 128')
      expect(command).toContain('--max-num-batched-tokens 8192')
      expect(command).toContain('--gpu-memory-utilization 0.9')
    })

    it('should include all specified parameters when provided', () => {
      const fullConfig = {
        model: 'meta-llama/Llama-2-7b-hf',
        maxNumSeqs: 128,
        maxNumBatchedTokens: 8192,
        gpuMemoryUtilization: 0.9,
        maxModelLen: 2048,
        quantization: 'awq',
        swapSpace: 4,
        enableChunkedPrefill: true,
      }
      
      const command = generateVLLMCommand(fullConfig)
      
      expect(command).toContain('--max-model-len 2048')
      expect(command).toContain('--quantization awq')
      expect(command).toContain('--swap-space 4')
      expect(command).toContain('--enable-chunked-prefill')
    })

    it('should handle optional parameters correctly', () => {
      const minimalConfig = {
        model: 'meta-llama/Llama-2-7b-hf',
      }
      
      const command = generateVLLMCommand(minimalConfig)
      
      expect(command).toContain('--model meta-llama/Llama-2-7b-hf')
      expect(command).not.toContain('--quantization')
      expect(command).not.toContain('--enable-chunked-prefill')
    })

    it('should handle boolean flags correctly', () => {
      const configWithFlags = {
        model: 'meta-llama/Llama-2-7b-hf',
        enableChunkedPrefill: true,
        enforceEager: false,
        disableLogStats: true,
      }
      
      const command = generateVLLMCommand(configWithFlags)
      
      expect(command).toContain('--enable-chunked-prefill')
      expect(command).not.toContain('--enforce-eager') // false flags should not appear
      expect(command).toContain('--disable-log-stats')
    })
  })

  describe('Integration Tests', () => {
    it('should work end-to-end for throughput optimization workflow', () => {
      // Step 1: Get workload optimizations
      const workloadProfile = {
        workloadType: 'serving',
        averageInputLength: 300,
        averageOutputLength: 150,
        peakConcurrency: 100,
        latencyRequirement: 'balanced',
        throughputPriority: 'high',
      }
      
      const workloadOpt = optimizeForWorkload(workloadProfile)
      expect(workloadOpt).toBeDefined()
      expect(workloadOpt.workloadType).toBe('serving')
      
      // Step 2: Apply to full configuration
      const enhancedConfig = {
        model: 'meta-llama/Llama-2-7b-hf',
        gpu: { model: 'A100', memory: 80, count: 1 },
        workload: { maxSeqLen: 2048, concurrentRequests: 100, averageTokensPerRequest: 512 },
        quantization: workloadOpt.recommendations.quantization,
        memoryStrategy: workloadOpt.optimizations.memoryStrategy,
        modelSpecs: mockModelSpecs,
        gpuSpecs: mockGpuSpecs,
      }
      
      // Step 3: Calculate throughput-optimized configuration
      const throughputConfig = calculateThroughputOptimizedConfig(enhancedConfig)
      expect(throughputConfig).toBeDefined()
      expect(throughputConfig.vllmCommand).toBeDefined()
      
      // Verify the configuration is coherent
      expect(throughputConfig.batchConfiguration.maxNumSeqs).toBeGreaterThan(0)
      expect(throughputConfig.memoryConfiguration.gpuMemoryUtilization).toBeGreaterThan(0)
      expect(throughputConfig.performanceEstimate.tokensPerSecond).toBeGreaterThan(0)
      
      // Verify command generation works
      expect(typeof throughputConfig.vllmCommand).toBe('string')
      expect(throughputConfig.vllmCommand).toContain('python -m vllm.entrypoints.openai.api_server')
    })
  })
})
