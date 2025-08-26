/**
 * Unit tests for system overhead estimation module
 * 
 * Tests the system overhead calculation functionality to ensure:
 * - Accurate overhead estimation for different system configurations
 * - Proper handling of different GPU types and counts
 * - Correct framework and driver overhead calculations
 * - Valid memory fragmentation estimates
 */

import { describe, it, expect } from 'vitest'
import {
  calculateSystemOverhead,
  estimateFrameworkOverhead,
  estimateDriverOverhead,
  calculateMemoryFragmentation,
  estimateKVCacheOverhead,
  OVERHEAD_CATEGORIES,
  FRAMEWORK_OVERHEADS,
  GPU_DRIVER_OVERHEADS
} from '../systemOverhead.js'

describe('System Overhead Module', () => {
  describe('calculateSystemOverhead', () => {
    const mockConfig = {
      gpuCount: 1,
      gpuType: 'A100',
      totalMemoryGB: 80,
      framework: 'vllm',
      tensorParallelSize: 1,
      pipelineParallelSize: 1
    }

    it('should calculate total system overhead', () => {
      const result = calculateSystemOverhead(mockConfig)

      expect(result).toBeDefined()
      expect(result.totalOverheadGB).toBeGreaterThan(0)
      expect(result.breakdown).toBeDefined()
      expect(result.breakdown.framework).toBeGreaterThan(0)
      expect(result.breakdown.driver).toBeGreaterThan(0)
      expect(result.breakdown.fragmentation).toBeGreaterThan(0)
      expect(result.breakdown.kvCache).toBeGreaterThan(0)
    })

    it('should scale with GPU count', () => {
      const single = calculateSystemOverhead({
        ...mockConfig,
        gpuCount: 1
      })

      const multi = calculateSystemOverhead({
        ...mockConfig,
        gpuCount: 4
      })

      expect(multi.totalOverheadGB).toBeGreaterThan(single.totalOverheadGB)
      expect(multi.breakdown.communication).toBeGreaterThan(0) // Should have communication overhead
    })

    it('should handle different GPU types', () => {
      const v100 = calculateSystemOverhead({
        ...mockConfig,
        gpuType: 'V100',
        totalMemoryGB: 32
      })

      const a100 = calculateSystemOverhead({
        ...mockConfig,
        gpuType: 'A100',
        totalMemoryGB: 80
      })

      expect(a100).toBeDefined()
      expect(v100).toBeDefined()
      // Different GPUs may have different overhead characteristics
    })

    it('should handle tensor parallelism overhead', () => {
      const noTP = calculateSystemOverhead({
        ...mockConfig,
        tensorParallelSize: 1
      })

      const withTP = calculateSystemOverhead({
        ...mockConfig,
        tensorParallelSize: 4,
        gpuCount: 4
      })

      expect(withTP.totalOverheadGB).toBeGreaterThan(noTP.totalOverheadGB)
      expect(withTP.breakdown.tensorParallel).toBeGreaterThan(0)
    })

    it('should handle pipeline parallelism overhead', () => {
      const noPP = calculateSystemOverhead({
        ...mockConfig,
        pipelineParallelSize: 1
      })

      const withPP = calculateSystemOverhead({
        ...mockConfig,
        pipelineParallelSize: 2,
        gpuCount: 2
      })

      expect(withPP.totalOverheadGB).toBeGreaterThan(noPP.totalOverheadGB)
      expect(withPP.breakdown.pipelineParallel).toBeGreaterThan(0)
    })

    it('should include percentage of total memory', () => {
      const result = calculateSystemOverhead(mockConfig)

      expect(result.overheadPercentage).toBeDefined()
      expect(result.overheadPercentage).toBeGreaterThan(0)
      expect(result.overheadPercentage).toBeLessThan(50) // Should be reasonable
    })

    it('should provide optimization recommendations', () => {
      const result = calculateSystemOverhead({
        ...mockConfig,
        totalMemoryGB: 24 // Smaller memory
      })

      expect(result.recommendations).toBeDefined()
      expect(Array.isArray(result.recommendations)).toBe(true)
    })

    it('should handle mixed precision configurations', () => {
      const result = calculateSystemOverhead({
        ...mockConfig,
        dtype: 'float16',
        quantization: 'int8'
      })

      expect(result).toBeDefined()
      expect(result.breakdown.quantization).toBeDefined()
    })
  })

  describe('estimateFrameworkOverhead', () => {
    it('should estimate vLLM framework overhead', () => {
      const result = estimateFrameworkOverhead({
        framework: 'vllm',
        gpuCount: 1,
        totalMemoryGB: 80
      })

      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(10) // Should be reasonable
    })

    it('should estimate different framework overheads', () => {
      const vllm = estimateFrameworkOverhead({
        framework: 'vllm',
        gpuCount: 1,
        totalMemoryGB: 80
      })

      const transformers = estimateFrameworkOverhead({
        framework: 'transformers',
        gpuCount: 1,
        totalMemoryGB: 80
      })

      expect(vllm).toBeGreaterThan(0)
      expect(transformers).toBeGreaterThan(0)
      // Different frameworks should have different overheads
    })

    it('should scale with GPU count', () => {
      const single = estimateFrameworkOverhead({
        framework: 'vllm',
        gpuCount: 1,
        totalMemoryGB: 80
      })

      const multi = estimateFrameworkOverhead({
        framework: 'vllm',
        gpuCount: 8,
        totalMemoryGB: 640
      })

      expect(multi).toBeGreaterThan(single)
    })

    it('should handle unknown frameworks', () => {
      const result = estimateFrameworkOverhead({
        framework: 'unknown-framework',
        gpuCount: 1,
        totalMemoryGB: 80
      })

      expect(result).toBeGreaterThan(0) // Should provide reasonable default
    })
  })

  describe('estimateDriverOverhead', () => {
    it('should estimate CUDA driver overhead', () => {
      const result = estimateDriverOverhead({
        gpuType: 'A100',
        gpuCount: 1,
        totalMemoryGB: 80,
        driverVersion: '12.2'
      })

      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(5) // Should be reasonable
    })

    it('should scale with GPU count', () => {
      const single = estimateDriverOverhead({
        gpuType: 'A100',
        gpuCount: 1,
        totalMemoryGB: 80
      })

      const multi = estimateDriverOverhead({
        gpuType: 'A100',
        gpuCount: 4,
        totalMemoryGB: 320
      })

      expect(multi).toBeGreaterThan(single)
    })

    it('should handle different GPU types', () => {
      const v100 = estimateDriverOverhead({
        gpuType: 'V100',
        gpuCount: 1,
        totalMemoryGB: 32
      })

      const h100 = estimateDriverOverhead({
        gpuType: 'H100',
        gpuCount: 1,
        totalMemoryGB: 80
      })

      expect(v100).toBeGreaterThan(0)
      expect(h100).toBeGreaterThan(0)
    })

    it('should consider driver version effects', () => {
      const old = estimateDriverOverhead({
        gpuType: 'A100',
        gpuCount: 1,
        totalMemoryGB: 80,
        driverVersion: '11.8'
      })

      const new_ = estimateDriverOverhead({
        gpuType: 'A100',
        gpuCount: 1,
        totalMemoryGB: 80,
        driverVersion: '12.2'
      })

      expect(old).toBeGreaterThan(0)
      expect(new_).toBeGreaterThan(0)
      // Newer drivers might have different overhead characteristics
    })
  })

  describe('calculateMemoryFragmentation', () => {
    it('should estimate memory fragmentation', () => {
      const result = calculateMemoryFragmentation({
        totalMemoryGB: 80,
        usedMemoryGB: 60,
        allocationPattern: 'dynamic'
      })

      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(10) // Should be reasonable
    })

    it('should vary with allocation patterns', () => {
      const dynamic = calculateMemoryFragmentation({
        totalMemoryGB: 80,
        usedMemoryGB: 60,
        allocationPattern: 'dynamic'
      })

      const staticPattern = calculateMemoryFragmentation({
        totalMemoryGB: 80,
        usedMemoryGB: 60,
        allocationPattern: 'static'
      })

      expect(dynamic).toBeGreaterThan(staticPattern) // Dynamic should have more fragmentation
    })

    it('should scale with memory usage', () => {
      const low = calculateMemoryFragmentation({
        totalMemoryGB: 80,
        usedMemoryGB: 20,
        allocationPattern: 'dynamic'
      })

      const high = calculateMemoryFragmentation({
        totalMemoryGB: 80,
        usedMemoryGB: 70,
        allocationPattern: 'dynamic'
      })

      expect(high).toBeGreaterThan(low) // Higher usage should have more fragmentation
    })

    it('should handle edge cases', () => {
      const zero = calculateMemoryFragmentation({
        totalMemoryGB: 80,
        usedMemoryGB: 0,
        allocationPattern: 'static'
      })

      const full = calculateMemoryFragmentation({
        totalMemoryGB: 80,
        usedMemoryGB: 80,
        allocationPattern: 'dynamic'
      })

      expect(zero).toBe(0)
      expect(full).toBeGreaterThan(0)
    })
  })

  describe('estimateKVCacheOverhead', () => {
    it('should estimate KV cache overhead', () => {
      const result = estimateKVCacheOverhead({
        maxSequenceLength: 2048,
        maxBatchSize: 128,
        numLayers: 32,
        numHeads: 32,
        headDim: 128,
        dtype: 'float16'
      })

      expect(result).toBeGreaterThan(0)
    })

    it('should scale with sequence length', () => {
      const short = estimateKVCacheOverhead({
        maxSequenceLength: 1024,
        maxBatchSize: 128,
        numLayers: 32,
        numHeads: 32,
        headDim: 128,
        dtype: 'float16'
      })

      const long = estimateKVCacheOverhead({
        maxSequenceLength: 4096,
        maxBatchSize: 128,
        numLayers: 32,
        numHeads: 32,
        headDim: 128,
        dtype: 'float16'
      })

      expect(long).toBeGreaterThan(short)
      expect(long / short).toBeCloseTo(4, 1) // Should scale roughly linearly
    })

    it('should scale with batch size', () => {
      const small = estimateKVCacheOverhead({
        maxSequenceLength: 2048,
        maxBatchSize: 64,
        numLayers: 32,
        numHeads: 32,
        headDim: 128,
        dtype: 'float16'
      })

      const large = estimateKVCacheOverhead({
        maxSequenceLength: 2048,
        maxBatchSize: 256,
        maxLayers: 32,
        numHeads: 32,
        headDim: 128,
        dtype: 'float16'
      })

      expect(large).toBeGreaterThan(small)
    })

    it('should handle different data types', () => {
      const fp16 = estimateKVCacheOverhead({
        maxSequenceLength: 2048,
        maxBatchSize: 128,
        numLayers: 32,
        numHeads: 32,
        headDim: 128,
        dtype: 'float16'
      })

      const fp32 = estimateKVCacheOverhead({
        maxSequenceLength: 2048,
        maxBatchSize: 128,
        numLayers: 32,
        numHeads: 32,
        headDim: 128,
        dtype: 'float32'
      })

      expect(fp32).toBeGreaterThan(fp16)
      expect(fp32 / fp16).toBeCloseTo(2, 0.5) // Should roughly double
    })
  })

  describe('Constants validation', () => {
    it('should define overhead categories', () => {
      expect(OVERHEAD_CATEGORIES).toBeDefined()
      expect(OVERHEAD_CATEGORIES.framework).toBeDefined()
      expect(OVERHEAD_CATEGORIES.driver).toBeDefined()
      expect(OVERHEAD_CATEGORIES.fragmentation).toBeDefined()
      expect(OVERHEAD_CATEGORIES.kvCache).toBeDefined()
    })

    it('should define framework overheads', () => {
      expect(FRAMEWORK_OVERHEADS).toBeDefined()
      expect(FRAMEWORK_OVERHEADS.vllm).toBeDefined()
      expect(FRAMEWORK_OVERHEADS.transformers).toBeDefined()
      expect(FRAMEWORK_OVERHEADS.default).toBeDefined()
    })

    it('should define GPU driver overheads', () => {
      expect(GPU_DRIVER_OVERHEADS).toBeDefined()
      expect(GPU_DRIVER_OVERHEADS.A100).toBeDefined()
      expect(GPU_DRIVER_OVERHEADS.V100).toBeDefined()
      expect(GPU_DRIVER_OVERHEADS.default).toBeDefined()
    })

    it('should have reasonable overhead values', () => {
      Object.values(FRAMEWORK_OVERHEADS).forEach(overhead => {
        if (typeof overhead === 'object') {
          expect(overhead.baseGB).toBeGreaterThan(0)
          expect(overhead.baseGB).toBeLessThan(10)
          expect(overhead.perGpuGB).toBeGreaterThan(0)
          expect(overhead.perGpuGB).toBeLessThan(5)
        }
      })
    })
  })

  describe('Error handling and edge cases', () => {
    it('should handle zero GPU count', () => {
      const result = calculateSystemOverhead({
        gpuCount: 0,
        gpuType: 'A100',
        totalMemoryGB: 80,
        framework: 'vllm'
      })

      expect(result).toBeDefined()
      expect(result.totalOverheadGB).toBe(0)
    })

    it('should handle negative memory', () => {
      const result = calculateSystemOverhead({
        gpuCount: 1,
        gpuType: 'A100',
        totalMemoryGB: -10,
        framework: 'vllm'
      })

      expect(result).toBeDefined()
      // Should handle gracefully
    })

    it('should handle unknown GPU types', () => {
      const result = calculateSystemOverhead({
        gpuCount: 1,
        gpuType: 'UnknownGPU',
        totalMemoryGB: 80,
        framework: 'vllm'
      })

      expect(result).toBeDefined()
      expect(result.totalOverheadGB).toBeGreaterThan(0) // Should use defaults
    })

    it('should handle very large configurations', () => {
      const result = calculateSystemOverhead({
        gpuCount: 1024,
        gpuType: 'A100',
        totalMemoryGB: 81920, // 1024 * 80GB
        framework: 'vllm',
        tensorParallelSize: 8,
        pipelineParallelSize: 128
      })

      expect(result).toBeDefined()
      expect(result.totalOverheadGB).toBeGreaterThan(0)
    })

    it('should handle missing optional parameters', () => {
      const result = calculateSystemOverhead({
        gpuCount: 1,
        gpuType: 'A100',
        totalMemoryGB: 80,
        framework: 'vllm'
        // Missing tensor/pipeline parallel sizes
      })

      expect(result).toBeDefined()
      expect(result.totalOverheadGB).toBeGreaterThan(0)
    })
  })

  describe('Integration tests', () => {
    it('should provide realistic overhead estimates', () => {
      const result = calculateSystemOverhead({
        gpuCount: 1,
        gpuType: 'A100',
        totalMemoryGB: 80,
        framework: 'vllm',
        tensorParallelSize: 1,
        pipelineParallelSize: 1
      })

      // For a single A100, overhead should be 2-10GB
      expect(result.totalOverheadGB).toBeGreaterThan(2)
      expect(result.totalOverheadGB).toBeLessThan(10)
      expect(result.overheadPercentage).toBeLessThan(15)
    })

    it('should handle multi-GPU scenarios realistically', () => {
      const result = calculateSystemOverhead({
        gpuCount: 8,
        gpuType: 'A100',
        totalMemoryGB: 640,
        framework: 'vllm',
        tensorParallelSize: 8,
        pipelineParallelSize: 1
      })

      // Multi-GPU should have higher absolute overhead but similar percentage
      expect(result.totalOverheadGB).toBeGreaterThan(10)
      expect(result.totalOverheadGB).toBeLessThan(50)
      expect(result.overheadPercentage).toBeLessThan(20)
    })

    it('should work with all supported frameworks', () => {
      const frameworks = ['vllm', 'transformers', 'deepspeed']

      frameworks.forEach(framework => {
        const result = calculateSystemOverhead({
          gpuCount: 1,
          gpuType: 'A100',
          totalMemoryGB: 80,
          framework
        })

        expect(result).toBeDefined()
        expect(result.totalOverheadGB).toBeGreaterThan(0)
      })
    })
  })
})
