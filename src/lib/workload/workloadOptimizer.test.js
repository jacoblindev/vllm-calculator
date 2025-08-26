/**
 * Unit tests for workload optimizer module
 * 
 * Tests the workload optimization functionality to ensure:
 * - Proper optimization for different workload types
 * - Correct configuration generation
 * - Valid workload-specific recommendations
 * - Integration with optimization strategies
 */

import { describe, it, expect } from 'vitest'
import {
  optimizeForWorkload,
  generateWorkloadConfiguration,
  WORKLOAD_TYPES,
  PERFORMANCE_PRIORITIES
} from '../workloadOptimizer.js'

describe('Workload Optimizer Module', () => {
  describe('optimizeForWorkload', () => {
    const mockConfig = {
      modelSize: 7,
      gpuSpecs: { memoryGB: 24 },
      architecture: {
        layers: 32,
        hiddenSize: 4096,
        numHeads: 32
      }
    }

    it('should optimize for chat workload with low latency', () => {
      const result = optimizeForWorkload({
        ...mockConfig,
        workloadType: 'chat'
      })

      expect(result).toBeDefined()
      expect(result.config).toBeDefined()
      
      // Chat workload should prioritize latency
      if (result.config['max-num-seqs']) {
        expect(result.config['max-num-seqs']).toBeLessThan(256) // Should be reasonable for latency
      }
    })

    it('should optimize for batch workload with high throughput', () => {
      const result = optimizeForWorkload({
        ...mockConfig,
        workloadType: 'batch'
      })

      expect(result).toBeDefined()
      expect(result.config).toBeDefined()
      
      // Batch workload should prioritize throughput
      if (result.config['max-num-seqs']) {
        expect(result.config['max-num-seqs']).toBeGreaterThan(32) // Should allow higher batch sizes
      }
    })

    it('should handle serving workload with balanced optimization', () => {
      const result = optimizeForWorkload({
        ...mockConfig,
        workloadType: 'serving'
      })

      expect(result).toBeDefined()
      expect(result.config).toBeDefined()
      expect(result.metrics).toBeDefined()
    })

    it('should apply performance priorities correctly', () => {
      const latencyResult = optimizeForWorkload({
        ...mockConfig,
        workloadType: 'chat',
        preferences: { performancePriority: 'latency' }
      })

      const throughputResult = optimizeForWorkload({
        ...mockConfig,
        workloadType: 'chat',
        preferences: { performancePriority: 'throughput' }
      })

      expect(latencyResult).toBeDefined()
      expect(throughputResult).toBeDefined()
      
      // Different priorities should produce different configurations
      expect(JSON.stringify(latencyResult.config)).not.toBe(JSON.stringify(throughputResult.config))
    })

    it('should handle embedding workload with no text output', () => {
      const result = optimizeForWorkload({
        ...mockConfig,
        workloadType: 'embedding'
      })

      expect(result).toBeDefined()
      expect(result.config).toBeDefined()
      
      // Embedding workload should be optimized for throughput
      if (result.config['max-num-seqs']) {
        expect(result.config['max-num-seqs']).toBeGreaterThan(64) // Should allow high batch sizes
      }
    })

    it('should provide metrics and considerations', () => {
      const result = optimizeForWorkload({
        ...mockConfig,
        workloadType: 'serving'
      })

      expect(result.metrics).toBeDefined()
      expect(result.considerations).toBeDefined()
      expect(Array.isArray(result.considerations)).toBe(true)
    })

    it('should handle invalid workload type gracefully', () => {
      const result = optimizeForWorkload({
        ...mockConfig,
        workloadType: 'invalid-workload'
      })

      expect(result).toBeDefined()
      // Should fallback to default serving workload
    })

    it('should respect memory constraints', () => {
      const lowMemoryConfig = {
        ...mockConfig,
        gpuSpecs: { memoryGB: 8 } // Lower memory
      }

      const result = optimizeForWorkload({
        ...lowMemoryConfig,
        workloadType: 'batch'
      })

      expect(result).toBeDefined()
      expect(result.config).toBeDefined()
      
      // Should adjust for lower memory availability
      if (result.config['gpu-memory-utilization']) {
        expect(result.config['gpu-memory-utilization']).toBeLessThanOrEqual(0.95)
      }
    })
  })

  describe('generateWorkloadConfiguration', () => {
    const mockParams = {
      workloadType: 'serving',
      modelSize: 7,
      gpuSpecs: { memoryGB: 24 },
      expectedLoad: 'moderate'
    }

    it('should generate valid configuration for serving workload', () => {
      const config = generateWorkloadConfiguration(mockParams)

      expect(config).toBeDefined()
      expect(config.workloadType).toBe('serving')
      expect(config.recommendations).toBeDefined()
      expect(Array.isArray(config.recommendations)).toBe(true)
    })

    it('should handle different expected load levels', () => {
      const lightConfig = generateWorkloadConfiguration({
        ...mockParams,
        expectedLoad: 'light'
      })

      const heavyConfig = generateWorkloadConfiguration({
        ...mockParams,
        expectedLoad: 'heavy'
      })

      expect(lightConfig).toBeDefined()
      expect(heavyConfig).toBeDefined()
      
      // Different loads should produce different configurations
      expect(JSON.stringify(lightConfig)).not.toBe(JSON.stringify(heavyConfig))
    })

    it('should include cost optimization recommendations', () => {
      const config = generateWorkloadConfiguration({
        ...mockParams,
        priorities: ['cost-optimization']
      })

      expect(config).toBeDefined()
      expect(config.recommendations.some(rec => 
        rec.toLowerCase().includes('cost') || 
        rec.toLowerCase().includes('efficiency')
      )).toBe(true)
    })

    it('should handle multiple priorities', () => {
      const config = generateWorkloadConfiguration({
        ...mockParams,
        priorities: ['latency', 'cost-optimization']
      })

      expect(config).toBeDefined()
      expect(config.recommendations).toBeDefined()
      expect(config.recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('WORKLOAD_TYPES re-export', () => {
    it('should re-export WORKLOAD_TYPES correctly', () => {
      expect(WORKLOAD_TYPES).toBeDefined()
      expect(WORKLOAD_TYPES.chat).toBeDefined()
      expect(WORKLOAD_TYPES.serving).toBeDefined()
      expect(WORKLOAD_TYPES.batch).toBeDefined()
    })
  })

  describe('PERFORMANCE_PRIORITIES re-export', () => {
    it('should re-export PERFORMANCE_PRIORITIES correctly', () => {
      expect(PERFORMANCE_PRIORITIES).toBeDefined()
      expect(PERFORMANCE_PRIORITIES.latency).toBeDefined()
      expect(PERFORMANCE_PRIORITIES.throughput).toBeDefined()
      expect(PERFORMANCE_PRIORITIES.balanced).toBeDefined()
    })
  })

  describe('Integration with optimization strategies', () => {
    it('should work with all workload types', () => {
      const mockConfig = {
        modelSize: 7,
        gpuSpecs: { memoryGB: 24 },
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32
        }
      }

      Object.keys(WORKLOAD_TYPES).forEach(workloadType => {
        const result = optimizeForWorkload({
          ...mockConfig,
          workloadType
        })

        expect(result).toBeDefined()
        expect(result.config).toBeDefined()
      })
    })

    it('should provide workload-specific considerations', () => {
      const mockConfig = {
        modelSize: 7,
        gpuSpecs: { memoryGB: 24 },
        architecture: {
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32
        }
      }

      const chatResult = optimizeForWorkload({
        ...mockConfig,
        workloadType: 'chat'
      })

      const batchResult = optimizeForWorkload({
        ...mockConfig,
        workloadType: 'batch'
      })

      expect(chatResult.considerations).toBeDefined()
      expect(batchResult.considerations).toBeDefined()
      
      // Different workloads should have different considerations
      expect(JSON.stringify(chatResult.considerations)).not.toBe(JSON.stringify(batchResult.considerations))
    })
  })

  describe('Error handling', () => {
    it('should handle missing required parameters', () => {
      expect(() => {
        optimizeForWorkload({})
      }).not.toThrow() // Should handle gracefully
    })

    it('should handle invalid GPU specs', () => {
      const result = optimizeForWorkload({
        modelSize: 7,
        gpuSpecs: { memoryGB: -1 }, // Invalid
        workloadType: 'serving'
      })

      expect(result).toBeDefined()
      // Should handle invalid specs gracefully
    })

    it('should handle very large models', () => {
      const result = optimizeForWorkload({
        modelSize: 175, // Very large model
        gpuSpecs: { memoryGB: 24 },
        workloadType: 'serving'
      })

      expect(result).toBeDefined()
      expect(result.config).toBeDefined()
      // Should provide recommendations for handling large models
    })

    it('should handle very small models', () => {
      const result = optimizeForWorkload({
        modelSize: 0.5, // Very small model
        gpuSpecs: { memoryGB: 24 },
        workloadType: 'serving'
      })

      expect(result).toBeDefined()
      expect(result.config).toBeDefined()
    })
  })
})
