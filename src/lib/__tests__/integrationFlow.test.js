/**
 * Integration Tests: Critical User Flows
 * 
 * These tests verify end-to-end functionality for the most important
 * user journeys in the vLLM Calculator application:
 * 
 * 1. GPU Selection → Model Selection → Configuration Output
 * 2. Hardware validation and compatibility checking
 * 3. Memory allocation and optimization strategies
 * 4. Error handling and edge cases in the complete flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  calculateVLLMMemoryUsage,
  checkModelGPUCompatibility,
  calculateThroughputOptimizedConfig,
  calculateBalancedOptimizedConfig
} from '../calculationEngine.js'
import { calculateVRAMBreakdown } from '../memory/vramBreakdown.js'
import { loadGPUData, loadModelData, validateGPU, validateModel } from '../dataLoader.js'

// Mock data for consistent testing
const mockGPUs = [
  { name: 'NVIDIA A100', vram_gb: 80, memory_bandwidth: 1935, compute_capability: '8.0' },
  { name: 'NVIDIA H100', vram_gb: 80, memory_bandwidth: 3350, compute_capability: '9.0' },
  { name: 'NVIDIA RTX 4090', vram_gb: 24, memory_bandwidth: 1008, compute_capability: '8.9' },
  { name: 'NVIDIA RTX 3090', vram_gb: 24, memory_bandwidth: 936, compute_capability: '8.6' }
]

const mockModels = [
  { 
    name: 'meta-llama/Llama-2-7b-hf', 
    size: 13.5, 
    parameters: 7000000000,
    quantization: 'fp16',
    memory_factor: 0.85, // Add memory factor for validation
    architecture: 'llama2'
  },
  { 
    name: 'meta-llama/Llama-2-13b-hf', 
    size: 26.0, 
    parameters: 13000000000,
    quantization: 'fp16',
    memory_factor: 0.80, // Add memory factor for validation
    architecture: 'llama2'
  },
  { 
    name: 'microsoft/DialoGPT-medium', 
    size: 1.2, 
    parameters: 345000000,
    quantization: 'fp16',
    memory_factor: 0.90, // Add memory factor for validation
    architecture: 'gpt2'
  }
]

describe('Integration Tests: Critical User Flows', () => {
  beforeEach(() => {
    // Reset any global state
    vi.clearAllMocks()
  })

  describe('Flow 1: Single GPU + Single Model → Configuration Generation', () => {
    it('should generate valid configurations for A100 + Llama-2-7B', () => {
      const gpuSelection = [{ gpu: mockGPUs[0], quantity: 1 }] // A100 80GB
      const modelSelection = [mockModels[0]] // Llama-2-7B
      
      // Calculate total resources
      const totalVRAM = gpuSelection.reduce((sum, sel) => sum + (sel.gpu.vram_gb * sel.quantity), 0)
      const totalModelSize = modelSelection.reduce((sum, model) => sum + model.size, 0)
      const gpuCount = gpuSelection.reduce((sum, sel) => sum + sel.quantity, 0)
      
      expect(totalVRAM).toBe(80)
      expect(totalModelSize).toBe(13.5)
      expect(gpuCount).toBe(1)
      
      // Test compatibility check
      const compatibility = checkModelGPUCompatibility({
        modelSize: totalModelSize,
        gpuSpecs: { memoryGB: totalVRAM },
        quantization: 'fp16'
      })
      
      expect(compatibility.compatible).toBe(true)
      expect(compatibility.utilizationPercent).toBeLessThan(80) // Should have headroom
      
      // Test configuration generation
      const baseConfig = {
        totalVRAMGB: totalVRAM,
        modelSizeGB: totalModelSize,
        gpuCount: gpuCount,
        maxSequenceLength: 2048
      }
      
      const throughputConfig = calculateThroughputOptimizedConfig(baseConfig)
      const balancedConfig = calculateBalancedOptimizedConfig(baseConfig)
      
      // Verify both configurations are valid
      expect(throughputConfig).toHaveProperty('vllmParameters')
      expect(throughputConfig).toHaveProperty('performanceEstimate')
      expect(balancedConfig).toHaveProperty('vllmParameters')
      expect(balancedConfig).toHaveProperty('performanceEstimate')
      
      // Verify key parameters are present
      expect(throughputConfig.vllmParameters).toHaveProperty('gpu-memory-utilization')
      expect(throughputConfig.vllmParameters).toHaveProperty('max-model-len')
      expect(balancedConfig.vllmParameters).toHaveProperty('gpu-memory-utilization')
      
      // Test VRAM breakdown
      const vramBreakdown = calculateVRAMBreakdown({
        totalVRAMGB: totalVRAM,
        modelSizeGB: totalModelSize,
        sequenceLength: 2048,
        batchSize: 16,
        dtype: 'fp16'
      })
      
      expect(vramBreakdown.summary.usedMemory).toBeGreaterThan(0)
      expect(vramBreakdown.compatibility.supportsModel).toBe(true)
    })

    it('should handle memory-constrained scenario (RTX 4090 + Llama-2-13B)', () => {
      const gpuSelection = [{ gpu: mockGPUs[2], quantity: 1 }] // RTX 4090 24GB
      const modelSelection = [mockModels[1]] // Llama-2-13B (26GB)
      
      const totalVRAM = gpuSelection.reduce((sum, sel) => sum + (sel.gpu.vram_gb * sel.quantity), 0)
      const totalModelSize = modelSelection.reduce((sum, model) => sum + model.size, 0)
      
      expect(totalVRAM).toBe(24)
      expect(totalModelSize).toBe(26.0)
      
      // Test compatibility - should fail without quantization
      const compatibility = checkModelGPUCompatibility({
        modelSize: totalModelSize,
        gpuSpecs: { memoryGB: totalVRAM },
        quantization: 'fp16'
      })
      
      expect(compatibility.compatible).toBe(false)
      expect(compatibility.recommendations).toContain('Consider using quantization or a larger GPU')
      
      // Test with quantization - should now be compatible
      const compatibilityWithQuant = checkModelGPUCompatibility({
        modelSize: totalModelSize * 0.65, // AWQ quantization ~35% compression
        gpuSpecs: { memoryGB: totalVRAM },
        quantization: 'awq'
      })
      
      expect(compatibilityWithQuant.compatible).toBe(true)
    })
  })

  describe('Flow 2: Multi-GPU + Multi-Model → Advanced Configuration', () => {
    it('should generate valid multi-GPU configurations', () => {
      const gpuSelection = [{ gpu: mockGPUs[0], quantity: 4 }] // 4x A100
      const modelSelection = [mockModels[1]] // Llama-2-13B
      
      const totalVRAM = gpuSelection.reduce((sum, sel) => sum + (sel.gpu.vram_gb * sel.quantity), 0)
      const totalModelSize = modelSelection.reduce((sum, model) => sum + model.size, 0)
      const gpuCount = gpuSelection.reduce((sum, sel) => sum + sel.quantity, 0)
      
      expect(totalVRAM).toBe(320) // 4 * 80GB
      expect(gpuCount).toBe(4)
      
      const baseConfig = {
        totalVRAMGB: totalVRAM,
        modelSizeGB: totalModelSize,
        gpuCount: gpuCount,
        maxSequenceLength: 4096,
        tensorParallelSize: gpuCount
      }
      
      const throughputConfig = calculateThroughputOptimizedConfig(baseConfig)
      
      expect(throughputConfig).toHaveProperty('vllmParameters')
      expect(throughputConfig.vllmParameters).toHaveProperty('tensor-parallel-size')
      expect(throughputConfig.vllmParameters['tensor-parallel-size']).toBe('4')
      
      // Verify scaling parameters are appropriate for multi-GPU
      const memoryUtil = parseFloat(throughputConfig.vllmParameters['gpu-memory-utilization'])
      expect(memoryUtil).toBeGreaterThan(0.7) // Should be able to use higher utilization
      expect(memoryUtil).toBeLessThanOrEqual(0.95)
    })

    it('should handle mixed GPU types gracefully', () => {
      const gpuSelection = [
        { gpu: mockGPUs[0], quantity: 2 }, // 2x A100 (80GB each)
        { gpu: mockGPUs[2], quantity: 2 }  // 2x RTX 4090 (24GB each)
      ]
      const modelSelection = [mockModels[0]] // Llama-2-7B
      
      const totalVRAM = gpuSelection.reduce((sum, sel) => sum + (sel.gpu.vram_gb * sel.quantity), 0)
      const gpuCount = gpuSelection.reduce((sum, sel) => sum + sel.quantity, 0)
      
      expect(totalVRAM).toBe(208) // (2 * 80) + (2 * 24)
      expect(gpuCount).toBe(4)
      
      // Mixed GPU setups should still generate valid configurations
      // but with conservative settings
      const baseConfig = {
        totalVRAMGB: totalVRAM,
        modelSizeGB: modelSelection[0].size,
        gpuCount: gpuCount,
        maxSequenceLength: 2048
      }
      
      const balancedConfig = calculateBalancedOptimizedConfig(baseConfig)
      
      expect(balancedConfig).toHaveProperty('vllmParameters')
      // Should use conservative memory utilization for mixed setups
      const memoryUtil = parseFloat(balancedConfig.vllmParameters['gpu-memory-utilization'])
      expect(memoryUtil).toBeLessThanOrEqual(0.85)
    })
  })

  describe('Flow 3: Validation and Error Handling', () => {
    it('should validate GPU and model data integrity', () => {
      // Test GPU validation
      mockGPUs.forEach(gpu => {
        expect(validateGPU(gpu)).toBe(true)
      })
      
      // Test invalid GPU
      const invalidGPU = { name: '', vram_gb: -1 }
      expect(validateGPU(invalidGPU)).toBe(false)
      
      // Test model validation
      mockModels.forEach(model => {
        expect(validateModel(model)).toBe(true)
      })
      
      // Test invalid model
      const invalidModel = { name: '', size: 0, quantization: '' }
      expect(validateModel(invalidModel)).toBe(false)
    })

    it('should handle impossible configurations gracefully', () => {
      // Test: Huge model on tiny GPU
      const hugeModel = { name: 'Huge Model', size: 500, parameters: 175000000000 }
      const tinyGPU = { name: 'Tiny GPU', vram_gb: 8 }
      
      const compatibility = checkModelGPUCompatibility({
        modelSize: hugeModel.size,
        gpuSpecs: { memoryGB: tinyGPU.vram_gb },
        quantization: 'fp16'
      })
      
      expect(compatibility.compatible).toBe(false)
      expect(compatibility.utilizationPercent).toBeGreaterThan(100)
    })

    it('should handle edge cases in VRAM breakdown', () => {
      // Test with very small model
      const smallConfig = {
        totalVRAMGB: 80,
        modelSizeGB: 0.1,
        sequenceLength: 512,
        batchSize: 1,
        dtype: 'fp16'
      }
      
      const smallBreakdown = calculateVRAMBreakdown(smallConfig)
      expect(smallBreakdown.summary.usedMemory).toBeGreaterThan(0)
      expect(smallBreakdown.compatibility.supportsModel).toBe(true)
      
      // Test with edge case parameters
      const edgeConfig = {
        totalVRAMGB: 24,
        modelSizeGB: 23.5, // Very close to GPU limit
        sequenceLength: 1024,
        batchSize: 1,
        dtype: 'fp16'
      }
      
      const edgeBreakdown = calculateVRAMBreakdown(edgeConfig)
      expect(edgeBreakdown.summary.usedMemory).toBeGreaterThan(0)
      // May or may not support model - depends on overhead calculations
    })
  })

  describe('Flow 4: Performance and Optimization Verification', () => {
    it('should generate different optimizations for different workload types', () => {
      const baseConfig = {
        totalVRAMGB: 80,
        modelSizeGB: 13.5,
        gpuCount: 1,
        maxSequenceLength: 2048
      }
      
      const throughputConfig = calculateThroughputOptimizedConfig(baseConfig)
      const balancedConfig = calculateBalancedOptimizedConfig(baseConfig)
      
      // Throughput config should prioritize memory efficiency
      const throughputMemUtil = parseFloat(throughputConfig.vllmParameters['gpu-memory-utilization'])
      const balancedMemUtil = parseFloat(balancedConfig.vllmParameters['gpu-memory-utilization'])
      
      // Configs should have different characteristics
      expect(throughputConfig.vllmParameters).not.toEqual(balancedConfig.vllmParameters)
      
      // Both should be valid ranges
      expect(throughputMemUtil).toBeGreaterThan(0.5)
      expect(throughputMemUtil).toBeLessThanOrEqual(0.95)
      expect(balancedMemUtil).toBeGreaterThan(0.5)
      expect(balancedMemUtil).toBeLessThanOrEqual(0.95)
    })

    it('should scale parameters appropriately with resource changes', () => {
      const smallConfig = {
        totalVRAMGB: 24,
        modelSizeGB: 7,
        gpuCount: 1,
        maxSequenceLength: 1024
      }
      
      const largeConfig = {
        totalVRAMGB: 320,
        modelSizeGB: 26,
        gpuCount: 4,
        maxSequenceLength: 4096
      }
      
      const smallOptimization = calculateThroughputOptimizedConfig(smallConfig)
      const largeOptimization = calculateThroughputOptimizedConfig(largeConfig)
      
      // Larger config should have higher batch sizes and sequence lengths
      const smallMaxSeqs = parseInt(smallOptimization.vllmParameters['max-num-seqs'] || '1')
      const largeMaxSeqs = parseInt(largeOptimization.vllmParameters['max-num-seqs'] || '1')
      
      expect(largeMaxSeqs).toBeGreaterThanOrEqual(smallMaxSeqs)
      
      // Large config should include tensor parallelism
      expect(largeOptimization.vllmParameters).toHaveProperty('tensor-parallel-size')
      expect(largeOptimization.vllmParameters['tensor-parallel-size']).toBe('4')
    })
  })

  describe('Flow 5: End-to-End Memory Analysis', () => {
    it('should provide comprehensive memory breakdown for typical deployment', () => {
      const deployment = {
        gpus: [{ gpu: mockGPUs[0], quantity: 2 }], // 2x A100
        models: [mockModels[0]], // Llama-2-7B
        workload: {
          sequenceLength: 2048,
          batchSize: 32,
          dtype: 'fp16'
        }
      }
      
      const totalVRAM = deployment.gpus.reduce((sum, sel) => sum + (sel.gpu.vram_gb * sel.quantity), 0)
      const totalModelSize = deployment.models.reduce((sum, model) => sum + model.size, 0)
      
      // Generate configuration
      const config = calculateThroughputOptimizedConfig({
        totalVRAMGB: totalVRAM,
        modelSizeGB: totalModelSize,
        gpuCount: 2,
        maxSequenceLength: deployment.workload.sequenceLength
      })
      
      // Generate VRAM breakdown
      const breakdown = calculateVRAMBreakdown({
        totalVRAMGB: totalVRAM,
        modelSizeGB: totalModelSize,
        sequenceLength: deployment.workload.sequenceLength,
        batchSize: deployment.workload.batchSize,
        dtype: deployment.workload.dtype
      })
      
      // Verify comprehensive analysis
      expect(config).toHaveProperty('vllmParameters')
      expect(config).toHaveProperty('performanceEstimate')
      expect(breakdown).toHaveProperty('breakdown')
      expect(breakdown).toHaveProperty('summary')
      expect(breakdown).toHaveProperty('compatibility')
      
      // Verify memory components
      expect(breakdown.breakdown).toHaveProperty('modelWeights')
      expect(breakdown.breakdown).toHaveProperty('kvCache')
      expect(breakdown.breakdown).toHaveProperty('activations')
      expect(breakdown.breakdown).toHaveProperty('systemOverhead')
      
      // Verify realistic values
      expect(breakdown.summary.usedMemory).toBeGreaterThan(totalModelSize)
      expect(breakdown.summary.usedMemory).toBeLessThan(totalVRAM)
      expect(breakdown.compatibility.supportsModel).toBe(true)
    })
  })
})
