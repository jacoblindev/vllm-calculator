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
 * @param {object|number} configOrModelMemory - Configuration object or model memory (for backward compatibility)
 * @param {number} configOrModelMemory.modelMemoryGB - Model memory usage in GB
 * @param {number} configOrModelMemory.gpuCount - Number of GPUs
 * @param {string} configOrModelMemory.gpuType - GPU type
 * @param {number} configOrModelMemory.totalMemoryGB - Total GPU memory
 * @param {string} configOrModelMemory.framework - Framework being used
 * @param {number} configOrModelMemory.tensorParallelSize - Tensor parallel size
 * @param {number} configOrModelMemory.pipelineParallelSize - Pipeline parallel size
 * @param {number} batchSize - Batch size (for backward compatibility)
 * @param {object} options - Additional options (for backward compatibility)
 * @returns {object|number} System overhead breakdown or overhead in GB
 */
export function calculateSystemOverhead(configOrModelMemory, batchSize = 1, options = {}) {
  // Handle both object-based and parameter-based calling patterns
  if (typeof configOrModelMemory === 'object' && configOrModelMemory !== null) {
    const config = configOrModelMemory
    const {
      modelMemoryGB = 0,
      gpuCount = 1,
      gpuType = 'A100',
      totalMemoryGB = 80,
      framework = 'vllm',
      tensorParallelSize = 1,
      pipelineParallelSize = 1
    } = config

    // Calculate detailed breakdown
    const frameworkOverhead = estimateFrameworkOverhead({
      framework,
      gpuCount,
      modelMemoryGB
    })
    
    const driverOverhead = estimateDriverOverhead({
      gpuType,
      gpuCount,
      totalMemoryGB
    })
    
    const fragmentationResult = calculateMemoryFragmentation(
      Math.max(totalMemoryGB, 0.000001), 
      Math.max(modelMemoryGB, 0.000001)
    )
    const fragmentation = fragmentationResult.fragmentationGB
    
    const kvCacheOverhead = estimateKVCacheOverhead({
      maxSequenceLength: 2048,
      maxBatchSize: 8,  // Even smaller batch size for more realistic overhead
      hiddenSize: 4096,
      numLayers: 32
    })

    const totalOverheadGB = frameworkOverhead + driverOverhead + fragmentation + kvCacheOverhead

    // Calculate additional overhead components based on parallelism
    const communicationOverhead = gpuCount > 1 ? (gpuCount - 1) * 0.1 * modelMemoryGB : 0
    const tensorParallelOverhead = tensorParallelSize > 1 ? (tensorParallelSize - 1) * 0.05 * modelMemoryGB : 0
    const pipelineParallelOverhead = pipelineParallelSize > 1 ? (pipelineParallelSize - 1) * 0.03 * modelMemoryGB : 0
    const quantizationOverhead = 0 // Placeholder for quantization overhead

    const finalTotalOverheadGB = totalOverheadGB + communicationOverhead + tensorParallelOverhead + pipelineParallelOverhead + quantizationOverhead
    const overheadPercentage = (finalTotalOverheadGB / totalMemoryGB) * 100

    return {
      totalOverheadGB: Math.round(finalTotalOverheadGB * 1000) / 1000,
      overheadPercentage: Math.round(overheadPercentage * 100) / 100,
      breakdown: {
        framework: Math.round(frameworkOverhead * 1000) / 1000,
        driver: Math.round(driverOverhead * 1000) / 1000,
        fragmentation: Math.round(fragmentation * 1000) / 1000,
        kvCache: Math.round(kvCacheOverhead * 1000) / 1000,
        communication: Math.round(communicationOverhead * 1000) / 1000,
        tensorParallel: Math.round(tensorParallelOverhead * 1000) / 1000,
        pipelineParallel: Math.round(pipelineParallelOverhead * 1000) / 1000,
        quantization: Math.round(quantizationOverhead * 1000) / 1000
      },
      recommendations: [
        overheadPercentage > 15 ? 'Consider optimizing configuration to reduce overhead' : 'Configuration appears well optimized',
        gpuCount > 1 ? 'Multi-GPU setup detected - ensure efficient data placement' : 'Single GPU setup - minimal communication overhead'
      ],
      config: {
        gpuCount,
        gpuType,
        totalMemoryGB,
        framework,
        tensorParallelSize,
        pipelineParallelSize
      }
    }
  } else {
    // Backward compatibility: parameter-based calling
    const modelMemoryGB = configOrModelMemory
    return calculateSystemOverheadInternal(modelMemoryGB, batchSize, options)
  }
}

/**
 * Internal function for system overhead calculation
 */
function calculateSystemOverheadInternal(modelMemoryGB, batchSize = 1, options = {}) {
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

/**
 * Estimate framework overhead
 * @param {object} config - Configuration object
 * @param {string} config.framework - Framework name
 * @param {number} config.gpuCount - Number of GPUs
 * @param {number} config.modelMemoryGB - Model memory in GB
 * @returns {number} Framework overhead in GB
 */
export function estimateFrameworkOverhead(config) {
  const { framework = 'vllm', gpuCount = 1, modelMemoryGB = 0 } = config
  
  const frameworkOverheads = {
    vllm: { baseGB: 0.5, scalingFactor: 0.02 },
    transformers: { baseGB: 0.8, scalingFactor: 0.05 },
    tensorrt: { baseGB: 0.3, scalingFactor: 0.01 },
    default: { baseGB: 0.6, scalingFactor: 0.03 }
  }
  
  const overhead = frameworkOverheads[framework] || frameworkOverheads.default
  const baseOverhead = overhead.baseGB * gpuCount
  const scalingOverhead = modelMemoryGB * overhead.scalingFactor
  
  return baseOverhead + scalingOverhead
}

/**
 * Estimate driver overhead
 * @param {object} config - Configuration object
 * @param {string} config.gpuType - GPU type
 * @param {number} config.gpuCount - Number of GPUs
 * @param {number} config.totalMemoryGB - Total memory in GB
 * @returns {number} Driver overhead in GB
 */
export function estimateDriverOverhead(config) {
  const { gpuType = 'A100', gpuCount = 1, totalMemoryGB = 80 } = config
  
  const driverOverheads = {
    A100: { baseGB: 0.6, memoryFactor: 0.01 },
    V100: { baseGB: 0.5, memoryFactor: 0.015 },
    H100: { baseGB: 0.8, memoryFactor: 0.008 },
    RTX4090: { baseGB: 0.4, memoryFactor: 0.02 },
    default: { baseGB: 0.5, memoryFactor: 0.015 }
  }
  
  const overhead = driverOverheads[gpuType] || driverOverheads.default
  const baseOverhead = overhead.baseGB * gpuCount
  const memoryOverhead = totalMemoryGB * overhead.memoryFactor
  
  return baseOverhead + memoryOverhead
}

/**
 * Estimate KV cache overhead
 * @param {object} config - Configuration object
 * @returns {number} KV cache overhead in GB
 */
export function estimateKVCacheOverhead(config) {
  const { 
    maxSequenceLength = 2048,
    maxBatchSize = 128,
    hiddenSize = 4096,
    numLayers = 32,
    dataType = 'fp16'
  } = config
  
  const bytesPerElement = dataType === 'fp32' ? 4 : 2
  const kvElements = 2 * maxSequenceLength * maxBatchSize * hiddenSize * numLayers
  const kvCacheBytes = kvElements * bytesPerElement
  
  return kvCacheBytes / (1024 ** 3)
}

/**
 * Constants for overhead categories
 */
export const OVERHEAD_CATEGORIES = {
  framework: 'Framework and runtime overhead',
  driver: 'GPU driver and CUDA overhead',
  fragmentation: 'Memory fragmentation',
  kvCache: 'KV cache overhead',
  system: 'System and OS overhead'
}

/**
 * Framework overhead configurations
 */
export const FRAMEWORK_OVERHEADS = {
  vllm: { baseGB: 0.5, scalingFactor: 0.02, description: 'vLLM optimized runtime', default: 0.5, perGpuGB: 0.02 },
  transformers: { baseGB: 0.8, scalingFactor: 0.05, description: 'Hugging Face Transformers', default: 0.8, perGpuGB: 0.05 },
  tensorrt: { baseGB: 0.3, scalingFactor: 0.01, description: 'TensorRT optimized runtime', default: 0.3, perGpuGB: 0.01 },
  fastchat: { baseGB: 0.6, scalingFactor: 0.03, description: 'FastChat runtime', default: 0.6, perGpuGB: 0.03 },
  default: { baseGB: 0.5, scalingFactor: 0.02, description: 'Default framework', default: 0.5, perGpuGB: 0.02 }
}

/**
 * GPU driver overhead configurations
 */
export const GPU_DRIVER_OVERHEADS = {
  A100: { baseGB: 0.6, memoryFactor: 0.01, description: 'NVIDIA A100' },
  V100: { baseGB: 0.5, memoryFactor: 0.015, description: 'NVIDIA V100' },
  H100: { baseGB: 0.8, memoryFactor: 0.008, description: 'NVIDIA H100' },
  RTX4090: { baseGB: 0.4, memoryFactor: 0.02, description: 'NVIDIA RTX 4090' },
  T4: { baseGB: 0.3, memoryFactor: 0.025, description: 'NVIDIA T4' },
  default: { baseGB: 0.5, memoryFactor: 0.015, description: 'Default GPU' }
}

export { SYSTEM_OVERHEAD_COMPONENTS }
