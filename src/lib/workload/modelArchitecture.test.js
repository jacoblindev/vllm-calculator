/**
 * Unit tests for model architecture estimation module
 * 
 * Tests the model architecture estimation functionality to ensure:
 * - Accurate architecture estimation from model size
 * - Proper handling of different model families
 * - Valid memory usage calculations
 * - Correct parameter distributions
 */

import { describe, it, expect } from 'vitest'
import {
  estimateModelArchitecture,
  calculateModelParameters,
  estimateLayerWiseMemory,
  getModelFamilySpecs,
  SUPPORTED_ARCHITECTURES
} from './modelArchitecture.js'

describe('Model Architecture Estimation Module', () => {
  describe('estimateModelArchitecture', () => {
    it('should estimate architecture for 7B model', () => {
      const result = estimateModelArchitecture(7)

      expect(result).toBeDefined()
      expect(result.layers).toBeGreaterThan(20)
      expect(result.layers).toBeLessThan(50)
      expect(result.hiddenSize).toBeGreaterThan(3000)
      expect(result.hiddenSize).toBeLessThan(6000)
      expect(result.numHeads).toBeGreaterThan(16)
      expect(result.numHeads).toBeLessThan(64)
      expect(result.vocabSize).toBeDefined()
    })

    it('should estimate architecture for 13B model', () => {
      const result = estimateModelArchitecture(13)

      expect(result).toBeDefined()
      expect(result.layers).toBeGreaterThan(30)
      expect(result.hiddenSize).toBeGreaterThan(4000)
      expect(result.numHeads).toBeGreaterThan(24)
    })

    it('should estimate architecture for 70B model', () => {
      const result = estimateModelArchitecture(70)

      expect(result).toBeDefined()
      expect(result.layers).toBeGreaterThan(60)
      expect(result.hiddenSize).toBeGreaterThan(6000)
      expect(result.numHeads).toBeGreaterThan(48)
    })

    it('should handle small models correctly', () => {
      const result = estimateModelArchitecture(1)

      expect(result).toBeDefined()
      expect(result.layers).toBeGreaterThan(10)
      expect(result.hiddenSize).toBeGreaterThan(1000)
      expect(result.numHeads).toBeGreaterThan(8)
    })

    it('should handle very large models', () => {
      const result = estimateModelArchitecture(175)

      expect(result).toBeDefined()
      expect(result.layers).toBeGreaterThan(80)
      expect(result.hiddenSize).toBeGreaterThan(10000)
      expect(result.numHeads).toBeGreaterThan(80)
    })

    it('should include vocabulary size estimation', () => {
      const result = estimateModelArchitecture(7)

      expect(result.vocabSize).toBeDefined()
      expect(result.vocabSize).toBeGreaterThan(30000)
      expect(result.vocabSize).toBeLessThan(100000)
    })

    it('should include intermediate size calculation', () => {
      const result = estimateModelArchitecture(7)

      expect(result.intermediateSize).toBeDefined()
      expect(result.intermediateSize).toBeGreaterThan(result.hiddenSize * 2)
      expect(result.intermediateSize).toBeLessThan(result.hiddenSize * 5)
    })

    it('should handle custom architecture type', () => {
      const result = estimateModelArchitecture(7, 'llama')

      expect(result).toBeDefined()
      expect(result.architecture).toBe('llama')
    })

    it('should maintain consistent scaling relationships', () => {
      const small = estimateModelArchitecture(7)
      const large = estimateModelArchitecture(70)

      // Larger models should have more layers and hidden size
      expect(large.layers).toBeGreaterThan(small.layers)
      expect(large.hiddenSize).toBeGreaterThan(small.hiddenSize)
      expect(large.numHeads).toBeGreaterThan(small.numHeads)
    })
  })

  describe('calculateModelParameters', () => {
    it('should calculate parameters for valid architecture', () => {
      const architecture = {
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32,
        vocabSize: 32000,
        intermediateSize: 11008
      }

      const result = calculateModelParameters(architecture)

      expect(result).toBeDefined()
      expect(result.totalParameters).toBeGreaterThan(6e9) // Should be around 7B
      expect(result.totalParameters).toBeLessThan(8e9)
      expect(result.embedding).toBeDefined()
      expect(result.attention).toBeDefined()
      expect(result.feedforward).toBeDefined()
      expect(result.layerNorm).toBeDefined()
    })

    it('should break down parameters by component', () => {
      const architecture = {
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32,
        vocabSize: 32000,
        intermediateSize: 11008
      }

      const result = calculateModelParameters(architecture)

      expect(result.embedding).toBeGreaterThan(0)
      expect(result.attention).toBeGreaterThan(0)
      expect(result.feedforward).toBeGreaterThan(0)
      expect(result.layerNorm).toBeGreaterThan(0)

      // Total should equal sum of components
      const sum = result.embedding + result.attention + result.feedforward + result.layerNorm
      expect(Math.abs(result.totalParameters - sum)).toBeLessThan(1000) // Allow small rounding differences
    })

    it('should handle different vocabulary sizes', () => {
      const baseArch = {
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32,
        intermediateSize: 11008
      }

      const smallVocab = calculateModelParameters({ ...baseArch, vocabSize: 16000 })
      const largeVocab = calculateModelParameters({ ...baseArch, vocabSize: 64000 })

      expect(largeVocab.embedding).toBeGreaterThan(smallVocab.embedding)
      expect(largeVocab.totalParameters).toBeGreaterThan(smallVocab.totalParameters)
    })

    it('should handle missing intermediate size', () => {
      const architecture = {
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32,
        vocabSize: 32000
        // No intermediateSize
      }

      const result = calculateModelParameters(architecture)

      expect(result).toBeDefined()
      expect(result.totalParameters).toBeGreaterThan(0)
      // Should calculate intermediate size automatically
    })
  })

  describe('estimateLayerWiseMemory', () => {
    const mockArchitecture = {
      layers: 32,
      hiddenSize: 4096,
      numHeads: 32,
      vocabSize: 32000,
      intermediateSize: 11008
    }

    it('should estimate memory usage per layer', () => {
      const result = estimateLayerWiseMemory(mockArchitecture, 1024) // 1024 batch size

      expect(result).toBeDefined()
      expect(result.activations).toBeDefined()
      expect(result.weights).toBeDefined()
      expect(result.gradients).toBeDefined()
      expect(result.total).toBeDefined()
    })

    it('should scale with batch size', () => {
      const small = estimateLayerWiseMemory(mockArchitecture, 512)
      const large = estimateLayerWiseMemory(mockArchitecture, 2048)

      expect(large.activations).toBeGreaterThan(small.activations)
      expect(large.total).toBeGreaterThan(small.total)
      // Weights shouldn't scale with batch size
      expect(large.weights).toBe(small.weights)
    })

    it('should handle different sequence lengths', () => {
      const result = estimateLayerWiseMemory(mockArchitecture, 1024, 2048) // 2048 sequence length

      expect(result).toBeDefined()
      expect(result.activations).toBeGreaterThan(0)
      expect(result.total).toBeGreaterThan(result.weights)
    })

    it('should include attention memory overhead', () => {
      const result = estimateLayerWiseMemory(mockArchitecture, 1024, 1024)

      expect(result).toBeDefined()
      expect(result.attention).toBeDefined()
      expect(result.attention).toBeGreaterThan(0)
    })

    it('should handle training vs inference mode', () => {
      const inference = estimateLayerWiseMemory(mockArchitecture, 1024, 1024, false)
      const training = estimateLayerWiseMemory(mockArchitecture, 1024, 1024, true)

      expect(training.total).toBeGreaterThan(inference.total)
      expect(training.gradients).toBeGreaterThan(0)
      expect(inference.gradients).toBe(0)
    })
  })

  describe('getModelFamilySpecs', () => {
    it('should return specs for llama family', () => {
      const specs = getModelFamilySpecs('llama')

      expect(specs).toBeDefined()
      expect(specs.architecture).toBe('llama')
      expect(specs.layerScaling).toBeDefined()
      expect(specs.hiddenScaling).toBeDefined()
      expect(specs.headScaling).toBeDefined()
    })

    it('should return specs for gpt family', () => {
      const specs = getModelFamilySpecs('gpt')

      expect(specs).toBeDefined()
      expect(specs.architecture).toBe('gpt')
      expect(specs.layerScaling).toBeDefined()
    })

    it('should return specs for mistral family', () => {
      const specs = getModelFamilySpecs('mistral')

      expect(specs).toBeDefined()
      expect(specs.architecture).toBe('mistral')
    })

    it('should handle unknown family with default specs', () => {
      const specs = getModelFamilySpecs('unknown-family')

      expect(specs).toBeDefined()
      expect(specs.architecture).toBe('transformer')
    })

    it('should include scaling factors', () => {
      const specs = getModelFamilySpecs('llama')

      expect(specs.layerScaling).toBeGreaterThan(0)
      expect(specs.hiddenScaling).toBeGreaterThan(0)
      expect(specs.headScaling).toBeGreaterThan(0)
    })

    it('should include specific architectural details', () => {
      const specs = getModelFamilySpecs('llama')

      expect(specs.attentionType).toBeDefined()
      expect(specs.normType).toBeDefined()
      expect(specs.activationType).toBeDefined()
    })
  })

  describe('SUPPORTED_ARCHITECTURES constant', () => {
    it('should define supported architectures', () => {
      expect(SUPPORTED_ARCHITECTURES).toBeDefined()
      expect(Array.isArray(SUPPORTED_ARCHITECTURES)).toBe(true)
      expect(SUPPORTED_ARCHITECTURES.length).toBeGreaterThan(0)
    })

    it('should include common architectures', () => {
      expect(SUPPORTED_ARCHITECTURES).toContain('llama')
      expect(SUPPORTED_ARCHITECTURES).toContain('gpt')
      expect(SUPPORTED_ARCHITECTURES).toContain('mistral')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle zero model size', () => {
      const result = estimateModelArchitecture(0)

      expect(result).toBeDefined()
      expect(result.layers).toBeGreaterThan(0)
      expect(result.hiddenSize).toBeGreaterThan(0)
    })

    it('should handle negative model size', () => {
      const result = estimateModelArchitecture(-1)

      expect(result).toBeDefined()
      // Should handle gracefully
    })

    it('should handle extremely large models', () => {
      const result = estimateModelArchitecture(1000)

      expect(result).toBeDefined()
      expect(result.layers).toBeDefined()
      expect(result.hiddenSize).toBeDefined()
    })

    it('should handle fractional model sizes', () => {
      const result = estimateModelArchitecture(6.7)

      expect(result).toBeDefined()
      expect(result.layers).toBeGreaterThan(0)
      expect(result.hiddenSize).toBeGreaterThan(0)
    })

    it('should handle invalid architecture in calculateModelParameters', () => {
      const result = calculateModelParameters({})

      expect(result).toBeDefined()
      // Should handle missing fields gracefully
    })

    it('should handle zero batch size in estimateLayerWiseMemory', () => {
      const mockArchitecture = {
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32,
        vocabSize: 32000
      }

      const result = estimateLayerWiseMemory(mockArchitecture, 0)

      expect(result).toBeDefined()
      expect(result.total).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Integration tests', () => {
    it('should work end-to-end for common model sizes', () => {
      const commonSizes = [1, 3, 7, 13, 30, 70]

      commonSizes.forEach(size => {
        const architecture = estimateModelArchitecture(size)
        const parameters = calculateModelParameters(architecture)
        const memory = estimateLayerWiseMemory(architecture, 1024)

        expect(architecture).toBeDefined()
        expect(parameters).toBeDefined()
        expect(memory).toBeDefined()
        
        // Sanity checks
        expect(parameters.totalParameters).toBeGreaterThan(size * 0.8e9) // At least 80% of expected
        expect(parameters.totalParameters).toBeLessThan(size * 1.5e9) // At most 150% of expected
      })
    })

    it('should maintain consistency across related functions', () => {
      const architecture = estimateModelArchitecture(7)
      const parameters = calculateModelParameters(architecture)

      expect(architecture).toBeDefined()
      expect(parameters).toBeDefined()
      expect(parameters.totalParameters).toBeGreaterThan(5e9)
      expect(parameters.totalParameters).toBeLessThan(9e9)
    })
  })
})
