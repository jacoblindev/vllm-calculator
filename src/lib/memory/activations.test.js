/**
 * Unit tests for activations memory calculation module
 * 
 * Tests the activation memory estimation functionality to ensure:
 * - Accurate memory calculations for different sequence lengths
 * - Proper handling of different batch sizes
 * - Correct scaling with model architecture
 * - Valid memory breakdown by component
 */

import { describe, it, expect } from 'vitest'
import {
  calculateActivationMemory,
  estimateAttentionMemory,
  estimateMLPActivations,
  calculateLayerNormMemory,
  ACTIVATION_DTYPES,
  MEMORY_OVERHEAD_FACTORS
} from './activations.js'

describe('Activations Memory Module', () => {
  const mockArchitecture = {
    layers: 32,
    hiddenSize: 4096,
    numHeads: 32,
    intermediateSize: 11008,
    vocabSize: 32000
  }

  describe('calculateActivationMemory', () => {
    it('should calculate total activation memory for given parameters', () => {
      const result = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      expect(result).toBeDefined()
      expect(result.totalMemoryGB).toBeGreaterThan(0)
      expect(result.breakdown).toBeDefined()
      expect(result.breakdown.attention).toBeGreaterThan(0)
      expect(result.breakdown.mlp).toBeGreaterThan(0)
      expect(result.breakdown.layerNorm).toBeGreaterThan(0)
      expect(result.breakdown.embeddings).toBeGreaterThan(0)
    })

    it('should scale with batch size', () => {
      const small = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 16,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      const large = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 64,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      expect(large.totalMemoryGB).toBeGreaterThan(small.totalMemoryGB)
      expect(large.totalMemoryGB / small.totalMemoryGB).toBeCloseTo(4, 1) // Should roughly scale by 4x
    })

    it('should scale with sequence length', () => {
      const short = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 512,
        dtype: 'float16'
      })

      const long = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 2048,
        dtype: 'float16'
      })

      expect(long.totalMemoryGB).toBeGreaterThan(short.totalMemoryGB)
      expect(long.totalMemoryGB / short.totalMemoryGB).toBeCloseTo(4, 1) // Should roughly scale by 4x
    })

    it('should handle different data types', () => {
      const fp16 = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      const fp32 = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float32'
      })

      expect(fp32.totalMemoryGB).toBeGreaterThan(fp16.totalMemoryGB)
      expect(fp32.totalMemoryGB / fp16.totalMemoryGB).toBeCloseTo(2, 0.5) // Should roughly double
    })

    it('should include gradient memory for training', () => {
      const inference = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float16',
        includeGradients: false
      })

      const training = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float16',
        includeGradients: true
      })

      expect(training.totalMemoryGB).toBeGreaterThan(inference.totalMemoryGB)
      expect(training.breakdown.gradients).toBeGreaterThan(0)
      expect(inference.breakdown.gradients).toBe(0)
    })

    it('should provide detailed breakdown', () => {
      const result = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      expect(result.breakdown).toBeDefined()
      expect(result.breakdown.attention).toBeGreaterThan(0)
      expect(result.breakdown.mlp).toBeGreaterThan(0)
      expect(result.breakdown.layerNorm).toBeGreaterThan(0)
      expect(result.breakdown.embeddings).toBeGreaterThan(0)
      expect(result.breakdown.overhead).toBeGreaterThan(0)
      
      // Total should roughly equal sum of components
      const sum = Object.values(result.breakdown).reduce((a, b) => a + b, 0)
      expect(Math.abs(result.totalMemoryGB - sum)).toBeLessThan(0.1)
    })

    it('should handle different model sizes', () => {
      const smallModel = {
        layers: 12,
        hiddenSize: 768,
        numHeads: 12,
        intermediateSize: 3072,
        vocabSize: 32000
      }

      const small = calculateActivationMemory({
        architecture: smallModel,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      const large = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      expect(large.totalMemoryGB).toBeGreaterThan(small.totalMemoryGB)
    })
  })

  describe('estimateAttentionMemory', () => {
    it('should calculate attention memory correctly', () => {
      const result = estimateAttentionMemory({
        batchSize: 32,
        sequenceLength: 1024,
        numHeads: 32,
        headDim: 128,
        layers: 32,
        dtype: 'float16'
      })

      expect(result).toBeGreaterThan(0)
    })

    it('should scale quadratically with sequence length', () => {
      const short = estimateAttentionMemory({
        batchSize: 32,
        sequenceLength: 512,
        numHeads: 32,
        headDim: 128,
        layers: 32,
        dtype: 'float16'
      })

      const long = estimateAttentionMemory({
        batchSize: 32,
        sequenceLength: 1024,
        numHeads: 32,
        headDim: 128,
        layers: 32,
        dtype: 'float16'
      })

      expect(long / short).toBeCloseTo(4, 1) // Should scale roughly quadratically
    })

    it('should scale linearly with number of heads', () => {
      const fewHeads = estimateAttentionMemory({
        batchSize: 32,
        sequenceLength: 1024,
        numHeads: 16,
        headDim: 128,
        layers: 32,
        dtype: 'float16'
      })

      const manyHeads = estimateAttentionMemory({
        batchSize: 32,
        sequenceLength: 1024,
        numHeads: 32,
        headDim: 128,
        layers: 32,
        dtype: 'float16'
      })

      expect(manyHeads / fewHeads).toBeCloseTo(2, 0.5) // Should scale roughly linearly
    })

    it('should handle different head dimensions', () => {
      const result64 = estimateAttentionMemory({
        batchSize: 32,
        sequenceLength: 1024,
        numHeads: 32,
        headDim: 64,
        layers: 32,
        dtype: 'float16'
      })

      const result128 = estimateAttentionMemory({
        batchSize: 32,
        sequenceLength: 1024,
        numHeads: 32,
        headDim: 128,
        layers: 32,
        dtype: 'float16'
      })

      expect(result128).toBeGreaterThan(result64)
    })
  })

  describe('estimateMLPActivations', () => {
    it('should calculate MLP activation memory', () => {
      const result = estimateMLPActivations({
        batchSize: 32,
        sequenceLength: 1024,
        hiddenSize: 4096,
        intermediateSize: 11008,
        layers: 32,
        dtype: 'float16'
      })

      expect(result).toBeGreaterThan(0)
    })

    it('should scale with intermediate size', () => {
      const small = estimateMLPActivations({
        batchSize: 32,
        sequenceLength: 1024,
        hiddenSize: 4096,
        intermediateSize: 8192,
        layers: 32,
        dtype: 'float16'
      })

      const large = estimateMLPActivations({
        batchSize: 32,
        sequenceLength: 1024,
        hiddenSize: 4096,
        intermediateSize: 16384,
        layers: 32,
        dtype: 'float16'
      })

      expect(large).toBeGreaterThan(small)
      expect(large / small).toBeCloseTo(2, 0.5) // Should scale with intermediate size
    })

    it('should scale linearly with sequence length and batch size', () => {
      const base = estimateMLPActivations({
        batchSize: 16,
        sequenceLength: 512,
        hiddenSize: 4096,
        intermediateSize: 11008,
        layers: 32,
        dtype: 'float16'
      })

      const scaled = estimateMLPActivations({
        batchSize: 32,
        sequenceLength: 1024,
        hiddenSize: 4096,
        intermediateSize: 11008,
        layers: 32,
        dtype: 'float16'
      })

      expect(scaled / base).toBeCloseTo(4, 1) // 2x batch * 2x sequence = 4x memory
    })
  })

  describe('calculateLayerNormMemory', () => {
    it('should calculate layer norm memory', () => {
      const result = calculateLayerNormMemory({
        batchSize: 32,
        sequenceLength: 1024,
        hiddenSize: 4096,
        layers: 32,
        dtype: 'float16'
      })

      expect(result).toBeGreaterThan(0)
    })

    it('should scale with model dimensions', () => {
      const small = calculateLayerNormMemory({
        batchSize: 32,
        sequenceLength: 1024,
        hiddenSize: 2048,
        layers: 16,
        dtype: 'float16'
      })

      const large = calculateLayerNormMemory({
        batchSize: 32,
        sequenceLength: 1024,
        hiddenSize: 4096,
        layers: 32,
        dtype: 'float16'
      })

      expect(large).toBeGreaterThan(small)
    })

    it('should handle different layer counts', () => {
      const result = calculateLayerNormMemory({
        batchSize: 32,
        sequenceLength: 1024,
        hiddenSize: 4096,
        layers: 48, // More layers
        dtype: 'float16'
      })

      expect(result).toBeGreaterThan(0)
    })
  })

  describe('ACTIVATION_DTYPES constant', () => {
    it('should define supported data types', () => {
      expect(ACTIVATION_DTYPES).toBeDefined()
      expect(ACTIVATION_DTYPES.float16).toBeDefined()
      expect(ACTIVATION_DTYPES.float32).toBeDefined()
      expect(ACTIVATION_DTYPES.bfloat16).toBeDefined()
    })

    it('should have correct byte sizes', () => {
      expect(ACTIVATION_DTYPES.float16.bytes).toBe(2)
      expect(ACTIVATION_DTYPES.float32.bytes).toBe(4)
      expect(ACTIVATION_DTYPES.bfloat16.bytes).toBe(2)
    })
  })

  describe('MEMORY_OVERHEAD_FACTORS constant', () => {
    it('should define memory overhead factors', () => {
      expect(MEMORY_OVERHEAD_FACTORS).toBeDefined()
      expect(MEMORY_OVERHEAD_FACTORS.attention).toBeDefined()
      expect(MEMORY_OVERHEAD_FACTORS.mlp).toBeDefined()
      expect(MEMORY_OVERHEAD_FACTORS.general).toBeDefined()
    })

    it('should have reasonable overhead factors', () => {
      expect(MEMORY_OVERHEAD_FACTORS.attention).toBeGreaterThan(1)
      expect(MEMORY_OVERHEAD_FACTORS.attention).toBeLessThan(2)
      expect(MEMORY_OVERHEAD_FACTORS.mlp).toBeGreaterThan(1)
      expect(MEMORY_OVERHEAD_FACTORS.mlp).toBeLessThan(2)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle zero batch size', () => {
      const result = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 0,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      expect(result).toBeDefined()
      expect(result.totalMemoryGB).toBe(0)
    })

    it('should handle zero sequence length', () => {
      const result = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 0,
        dtype: 'float16'
      })

      expect(result).toBeDefined()
      expect(result.totalMemoryGB).toBe(0)
    })

    it('should handle invalid data type', () => {
      const result = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'invalid-dtype'
      })

      expect(result).toBeDefined()
      // Should fallback to default dtype
    })

    it('should handle missing architecture fields', () => {
      const incompleteArch = {
        layers: 32,
        hiddenSize: 4096
        // Missing other fields
      }

      const result = calculateActivationMemory({
        architecture: incompleteArch,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      expect(result).toBeDefined()
      // Should handle missing fields gracefully
    })

    it('should handle very large parameters', () => {
      const result = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 1024,
        sequenceLength: 8192,
        dtype: 'float32'
      })

      expect(result).toBeDefined()
      expect(result.totalMemoryGB).toBeGreaterThan(0)
    })

    it('should handle very small models', () => {
      const tinyModel = {
        layers: 6,
        hiddenSize: 512,
        numHeads: 8,
        intermediateSize: 2048,
        vocabSize: 16000
      }

      const result = calculateActivationMemory({
        architecture: tinyModel,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      expect(result).toBeDefined()
      expect(result.totalMemoryGB).toBeGreaterThan(0)
    })
  })

  describe('Integration tests', () => {
    it('should work with realistic configurations', () => {
      const configs = [
        { batchSize: 1, sequenceLength: 2048, dtype: 'float16' }, // Chat
        { batchSize: 64, sequenceLength: 512, dtype: 'float16' }, // Batch
        { batchSize: 256, sequenceLength: 128, dtype: 'float16' }, // High throughput
        { batchSize: 8, sequenceLength: 4096, dtype: 'float32' } // Long context
      ]

      configs.forEach(config => {
        const result = calculateActivationMemory({
          architecture: mockArchitecture,
          ...config
        })

        expect(result).toBeDefined()
        expect(result.totalMemoryGB).toBeGreaterThan(0)
        expect(result.breakdown).toBeDefined()
      })
    })

    it('should maintain reasonable memory estimates', () => {
      const result = calculateActivationMemory({
        architecture: mockArchitecture,
        batchSize: 32,
        sequenceLength: 1024,
        dtype: 'float16'
      })

      // For a 7B model with reasonable batch/sequence, should be < 10GB
      expect(result.totalMemoryGB).toBeLessThan(10)
      expect(result.totalMemoryGB).toBeGreaterThan(0.1)
    })
  })
})
