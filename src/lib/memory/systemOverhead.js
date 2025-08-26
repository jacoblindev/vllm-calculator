/**
 * System Overhead Memory Calculation Module
 * 
 * This module provides functions for calculating system overhead memory usage
 * in vLLM deployments, including CUDA context, memory fragmentation,
 * runtime overhead, and other system-level memory requirements.
 */

import { Validators } from '../validation.js'

/**
 * Base system overhead components for vLLM
 */
const SYSTEM_OVERHEAD_COMPONENTS = {
  // Base overhead that's always present
  base: {
    cudaContext: 0.5,           // CUDA context overhead
    vllmRuntime: 0.3,          // vLLM runtime overhead
    pythonInterpreter: 0.2,    // Python interpreter
  },
  
  // Scaling factors based on model and batch size
  scaling: {
    modelSizeMultiplier: 0.05,  // 5% of model size
    batchSizeOverhead: 0.1,     // Per additional batch item
    fragmentationRate: 0.02,    // 2% fragmentation
  },
  
  // GPU-specific overhead
  gpu: {
    h100: { base: 0.8, scaling: 0.03 },
    a100: { base: 0.6, scaling: 0.04 },
    v100: { base: 0.5, scaling: 0.05 },
    rtx4090: { base: 0.4, scaling: 0.06 },
    default: { base: 0.5, scaling: 0.05 },
  }
}

/**
 * Calculate system overhead for vLLM runtime
 * @param {number} modelMemoryGB - Model memory usage in GB
 * @param {number} batchSize - Batch size
 * @param {object} options - Additional options
 * @param {string} options.gpuType - GPU type for specific overhead calculations
 * @param {number} options.totalVRAMGB - Total VRAM for fragmentation calculation
 * @param {boolean} options.multiGPU - Whether running multi-GPU setup
 * @returns {number} System overhead in GB
 */
export function calculateSystemOverhead(modelMemoryGB, batchSize = 1, options = {}) {
  Validators.positiveNumber(modelMemoryGB, 'modelMemoryGB')
  Validators.positiveNumber(batchSize, 'batchSize')
  Validators.object(options, [], 'options')

  const {
    gpuType = 'default',
    totalVRAMGB = 0,
    multiGPU = false
  } = options

  const components = SYSTEM_OVERHEAD_COMPONENTS
  const gpuOverhead = components.gpu[gpuType] || components.gpu.default

  // Base system overhead
  const baseOverhead = 
    components.base.cudaContext +
    components.base.vllmRuntime +
    components.base.pythonInterpreter +
    gpuOverhead.base

  // Model-proportional overhead
  const modelOverhead = modelMemoryGB * (components.scaling.modelSizeMultiplier + gpuOverhead.scaling)

  // Batch size overhead (additional overhead per batch item beyond the first)
  const batchOverhead = Math.max(0, (batchSize - 1)) * components.scaling.batchSizeOverhead

  // Memory fragmentation (if total VRAM is provided)
  const fragmentationOverhead = totalVRAMGB > 0 ? 
    (modelMemoryGB + baseOverhead) * components.scaling.fragmentationRate : 0

  // Multi-GPU overhead
  const multiGPUOverhead = multiGPU ? baseOverhead * 0.3 : 0

  const totalOverhead = baseOverhead + modelOverhead + batchOverhead + fragmentationOverhead + multiGPUOverhead

  return Math.round(totalOverhead * 1000) / 1000
}

/**
 * Calculate detailed system overhead breakdown
 * @param {object} config - Configuration object
 * @param {number} config.modelMemoryGB - Model memory usage in GB
 * @param {number} config.batchSize - Batch size
 * @param {number} config.totalVRAMGB - Total VRAM in GB
 * @param {string} config.gpuType - GPU type
 * @param {boolean} config.multiGPU - Multi-GPU setup
 * @param {string} config.deployment - 'development' | 'production' | 'research'
 * @returns {object} Detailed system overhead breakdown
 */
export function calculateSystemOverheadBreakdown(config) {
  Validators.object(config, ['modelMemoryGB'], 'config')

  const {
    modelMemoryGB,
    batchSize = 1,
    totalVRAMGB = 0,
    gpuType = 'default',
    multiGPU = false,
    deployment = 'production'
  } = config

  const components = SYSTEM_OVERHEAD_COMPONENTS
  const gpuOverhead = components.gpu[gpuType] || components.gpu.default

  // Calculate individual components
  const breakdown = {
    base: {
      cudaContextGB: components.base.cudaContext,
      vllmRuntimeGB: components.base.vllmRuntime,
      pythonInterpreterGB: components.base.pythonInterpreter,
      gpuSpecificGB: gpuOverhead.base,
      totalBaseGB: components.base.cudaContext + components.base.vllmRuntime + 
                   components.base.pythonInterpreter + gpuOverhead.base
    },
    scaling: {
      modelProportionalGB: modelMemoryGB * (components.scaling.modelSizeMultiplier + gpuOverhead.scaling),
      batchOverheadGB: Math.max(0, (batchSize - 1)) * components.scaling.batchSizeOverhead,
      fragmentationGB: totalVRAMGB > 0 ? 
        (modelMemoryGB + components.base.cudaContext + components.base.vllmRuntime) * components.scaling.fragmentationRate : 0
    },
    optional: {
      multiGPUOverheadGB: multiGPU ? (components.base.cudaContext + components.base.vllmRuntime) * 0.3 : 0,
      deploymentOverheadGB: deployment === 'development' ? 0.2 : 0 // Extra overhead for development tools
    }
  }

  // Calculate totals
  const totalBaseGB = breakdown.base.totalBaseGB
  const totalScalingGB = breakdown.scaling.modelProportionalGB + 
                        breakdown.scaling.batchOverheadGB + 
                        breakdown.scaling.fragmentationGB
  const totalOptionalGB = breakdown.optional.multiGPUOverheadGB + breakdown.optional.deploymentOverheadGB
  const totalOverheadGB = totalBaseGB + totalScalingGB + totalOptionalGB

  return {
    totalOverheadGB: Math.round(totalOverheadGB * 1000) / 1000,
    breakdown,
    summary: {
      baseOverheadGB: Math.round(totalBaseGB * 1000) / 1000,
      scalingOverheadGB: Math.round(totalScalingGB * 1000) / 1000,
      optionalOverheadGB: Math.round(totalOptionalGB * 1000) / 1000,
    },
    config: {
      modelMemoryGB,
      batchSize,
      totalVRAMGB,
      gpuType,
      multiGPU,
      deployment,
    },
    percentages: {
      basePercent: Math.round((totalBaseGB / totalOverheadGB) * 100),
      scalingPercent: Math.round((totalScalingGB / totalOverheadGB) * 100),
      optionalPercent: Math.round((totalOptionalGB / totalOverheadGB) * 100),
    }
  }
}

/**
 * Estimate system overhead for different GPU types
 * @param {number} modelMemoryGB - Model memory in GB
 * @param {number} batchSize - Batch size
 * @param {string[]} gpuTypes - Array of GPU types to compare
 * @returns {object[]} Array of overhead calculations for different GPU types
 */
export function compareSystemOverheadByGPU(modelMemoryGB, batchSize, gpuTypes = ['h100', 'a100', 'v100', 'rtx4090']) {
  Validators.positiveNumber(modelMemoryGB, 'modelMemoryGB')
  Validators.positiveNumber(batchSize, 'batchSize')
  Validators.array(gpuTypes, 'gpuTypes')

  return gpuTypes.map(gpuType => {
    const overheadGB = calculateSystemOverhead(modelMemoryGB, batchSize, { gpuType })
    const gpuInfo = SYSTEM_OVERHEAD_COMPONENTS.gpu[gpuType] || SYSTEM_OVERHEAD_COMPONENTS.gpu.default
    
    return {
      gpuType,
      systemOverheadGB: overheadGB,
      baseOverheadGB: gpuInfo.base,
      scalingFactor: gpuInfo.scaling,
      totalMemoryWithOverhead: Math.round((modelMemoryGB + overheadGB) * 1000) / 1000,
      overheadPercent: Math.round((overheadGB / (modelMemoryGB + overheadGB)) * 100)
    }
  })
}

/**
 * Calculate memory fragmentation overhead
 * @param {number} totalVRAMGB - Total VRAM in GB
 * @param {number} allocatedMemoryGB - Currently allocated memory in GB
 * @param {object} options - Fragmentation calculation options
 * @param {string} options.allocatorType - 'pytorch' | 'vllm' | 'custom'
 * @param {number} options.fragmentationRate - Custom fragmentation rate
 * @returns {object} Fragmentation analysis
 */
export function calculateMemoryFragmentation(totalVRAMGB, allocatedMemoryGB, options = {}) {
  Validators.positiveNumber(totalVRAMGB, 'totalVRAMGB')
  Validators.positiveNumber(allocatedMemoryGB, 'allocatedMemoryGB')
  Validators.object(options, [], 'options')

  const {
    allocatorType = 'vllm',
    fragmentationRate = null
  } = options

  // Default fragmentation rates by allocator type
  const defaultFragmentationRates = {
    pytorch: 0.05,    // PyTorch default allocator
    vllm: 0.02,       // vLLM optimized allocator
    custom: 0.03      // Custom allocator
  }

  const effectiveFragmentationRate = fragmentationRate || defaultFragmentationRates[allocatorType] || 0.02

  const fragmentationGB = allocatedMemoryGB * effectiveFragmentationRate
  const availableMemoryGB = totalVRAMGB - allocatedMemoryGB - fragmentationGB
  const utilizationPercent = ((allocatedMemoryGB + fragmentationGB) / totalVRAMGB) * 100

  return {
    totalVRAMGB,
    allocatedMemoryGB,
    fragmentationGB: Math.round(fragmentationGB * 1000) / 1000,
    availableMemoryGB: Math.round(Math.max(0, availableMemoryGB) * 1000) / 1000,
    utilizationPercent: Math.round(utilizationPercent * 10) / 10,
    fragmentationPercent: Math.round((fragmentationGB / totalVRAMGB) * 100 * 10) / 10,
    allocatorType,
    effectiveFragmentationRate,
    recommendations: generateFragmentationRecommendations(totalVRAMGB, allocatedMemoryGB, fragmentationGB)
  }
}

/**
 * Generate recommendations for reducing system overhead
 * @param {object} overheadBreakdown - System overhead breakdown
 * @returns {string[]} Array of optimization recommendations
 */
function generateFragmentationRecommendations(totalVRAMGB, allocatedMemoryGB, fragmentationGB) {
  const recommendations = []
  const fragmentationPercent = (fragmentationGB / totalVRAMGB) * 100
  const utilizationPercent = (allocatedMemoryGB / totalVRAMGB) * 100

  if (fragmentationPercent > 5) {
    recommendations.push('High memory fragmentation detected. Consider using vLLM\'s optimized memory allocator.')
  }

  if (utilizationPercent > 90) {
    recommendations.push('Very high memory utilization. Reduce batch size or model size to prevent OOM errors.')
  }

  if (fragmentationGB > 2) {
    recommendations.push('Significant memory fragmentation. Consider restarting the process periodically.')
  }

  if (totalVRAMGB > 40 && fragmentationPercent < 2) {
    recommendations.push('Efficient memory usage on large GPU. Current configuration is well optimized.')
  }

  return recommendations
}

/**
 * Optimize system overhead for specific deployment scenarios
 * @param {object} config - Current configuration
 * @param {string} optimizationTarget - 'minimal' | 'balanced' | 'performance'
 * @returns {object} Optimized configuration and expected overhead reduction
 */
export function optimizeSystemOverhead(config, optimizationTarget = 'balanced') {
  Validators.object(config, ['modelMemoryGB'], 'config')
  Validators.string(optimizationTarget, 'optimizationTarget')

  const { modelMemoryGB, batchSize = 1, gpuType = 'default' } = config
  const currentOverhead = calculateSystemOverhead(modelMemoryGB, batchSize, { gpuType })

  const optimizations = {
    minimal: {
      batchSizeMultiplier: 0.7,
      useOptimizedAllocator: true,
      description: 'Minimize overhead at cost of throughput'
    },
    balanced: {
      batchSizeMultiplier: 0.85,
      useOptimizedAllocator: true,
      description: 'Balance overhead and performance'
    },
    performance: {
      batchSizeMultiplier: 1.0,
      useOptimizedAllocator: true,
      description: 'Optimize for performance, accept higher overhead'
    }
  }

  const optimization = optimizations[optimizationTarget] || optimizations.balanced
  
  const optimizedConfig = {
    ...config,
    batchSize: Math.max(1, Math.floor(batchSize * optimization.batchSizeMultiplier))
  }

  const optimizedOverhead = calculateSystemOverhead(
    optimizedConfig.modelMemoryGB,
    optimizedConfig.batchSize,
    { gpuType: optimizedConfig.gpuType }
  )

  const overheadReduction = currentOverhead - optimizedOverhead
  const reductionPercent = (overheadReduction / currentOverhead) * 100

  return {
    original: {
      config,
      overheadGB: currentOverhead
    },
    optimized: {
      config: optimizedConfig,
      overheadGB: optimizedOverhead
    },
    reduction: {
      overheadGB: Math.round(overheadReduction * 1000) / 1000,
      percentage: Math.round(reductionPercent * 10) / 10
    },
    optimizationTarget,
    description: optimization.description,
    recommendations: [
      'Use vLLM\'s optimized memory allocator',
      'Consider CUDA memory pool for better fragmentation management',
      'Monitor memory usage patterns for further optimization'
    ]
  }
}

/**
 * Get supported GPU types for overhead calculations
 * @returns {string[]} Array of supported GPU types
 */
export function getSupportedGPUTypes() {
  return Object.keys(SYSTEM_OVERHEAD_COMPONENTS.gpu).filter(type => type !== 'default')
}

export { SYSTEM_OVERHEAD_COMPONENTS }
