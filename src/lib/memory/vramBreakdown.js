/**
 * VRAM Breakdown and Memory Analysis Module
 * 
 * This module provides detailed VRAM breakdown calculations, memory analysis,
 * and optimization recommendations for vLLM deployments.
 * 
 * Key Features:
 * - Detailed VRAM breakdown with quantization support
 * - Memory fragmentation and overhead calculations
 * - System memory reservation and swap space management
 * - Memory efficiency analysis and optimization recommendations
 */

// Import validation utilities from dedicated module
import { 
  Validators, 
  VLLMValidators, 
  ValidationError,
} from '../validation.js'

// Import quantization utilities and other functions from main module
import {
  QUANTIZATION_FORMATS,
  calculateModelWeightsMemory,
} from '../quantization.js'

import {
  calculateKVCacheMemory,
  calculateActivationMemory,
  calculateSystemOverhead
} from '../calculationEngine.js'

import {
  estimateModelArchitecture
} from '../workload/modelArchitecture.js'

/**
 * Calculate detailed VRAM breakdown with quantization support
 * @param {object} config - Configuration object
 * @param {number} config.totalVRAMGB - Total VRAM available in GB
 * @param {number} config.modelSizeGB - Base model size in GB (before quantization)
 * @param {number} [config.numParams] - Number of parameters in billions (alternative to modelSizeGB)
 * @param {string} [config.quantization='fp16'] - Quantization format
 * @param {number} [config.batchSize=32] - Batch size for calculations
 * @param {number} [config.maxSeqLen=2048] - Maximum sequence length
 * @param {number} [config.seqLen=512] - Actual sequence length for activations
 * @param {object} [config.architecture] - Model architecture details
 * @param {string} [config.kvCachePrecision='fp16'] - KV cache precision
 * @param {number} [config.swapSpaceGB] - Custom swap space allocation
 * @param {object} [config.optimizationStrategy] - Memory optimization strategy
 * @returns {object} Detailed VRAM breakdown
 */
export function calculateVRAMBreakdown(config) {
  // Validate configuration object
  Validators.object(config, [], 'config')
  
  const {
    totalVRAMGB,
    modelSizeGB,
    numParams,
    quantization = 'fp16',
    batchSize = 32,
    maxSeqLen = 2048,
    seqLen = 512,
    architecture,
    kvCachePrecision = 'fp16',
    swapSpaceGB,
    optimizationStrategy,
  } = config

  // Validate required fields
  Validators.positiveNumber(totalVRAMGB, 'totalVRAMGB')
  
  // Validate either modelSizeGB or numParams is provided
  if (!modelSizeGB && !numParams) {
    throw new ValidationError('Either modelSizeGB or numParams must be provided', 'config', config)
  }

  if (modelSizeGB) {
    Validators.positiveNumber(modelSizeGB, 'modelSizeGB')
  }
  
  if (numParams) {
    Validators.positiveNumber(numParams, 'numParams')
  }

  // Validate other parameters
  const normalizedQuantization = VLLMValidators.quantizationFormat(quantization)
  VLLMValidators.batchSize(batchSize, 'batchSize')
  VLLMValidators.sequenceLength(maxSeqLen, 'maxSeqLen')
  VLLMValidators.sequenceLength(seqLen, 'seqLen')
  
  if (kvCachePrecision) {
    VLLMValidators.quantizationFormat(kvCachePrecision)
  }
  
  if (swapSpaceGB) {
    Validators.positiveNumber(swapSpaceGB, 'swapSpaceGB')
  }

  // Calculate model weights with quantization
  const modelWeightsResult = modelSizeGB 
    ? calculateModelWeightsMemoryFromSize(modelSizeGB, normalizedQuantization)
    : calculateModelWeightsMemory(numParams, normalizedQuantization)

  // Determine model architecture
  const arch = architecture || estimateModelArchitecture(numParams || (modelSizeGB / 2))

  // Calculate KV cache memory
  const kvCacheMemory = calculateKVCacheMemory(
    batchSize,
    maxSeqLen,
    arch.layers,
    arch.hiddenSize,
    arch.numHeads,
    kvCachePrecision
  )

  // Calculate activation memory
  // Map quantization format to activation precision
  const activationPrecisionMap = {
    'fp32': 'fp32',
    'fp16': 'fp16', 
    'bf16': 'bf16',
    'int8': 'fp16',    // INT8 models typically use FP16 activations
    'int4': 'fp16',    // INT4 models typically use FP16 activations
    'awq': 'fp16',     // AWQ models use FP16 activations
    'gptq': 'fp16',    // GPTQ models use FP16 activations
    'gguf': 'fp16',    // GGUF models use FP16 activations
    'default': 'fp16'
  }
  
  const activationPrecision = activationPrecisionMap[quantization] || activationPrecisionMap.default
  
  const activationMemory = calculateActivationMemory(
    batchSize,
    seqLen,
    arch.hiddenSize,
    arch.layers,
    activationPrecision
  )

  // Calculate system overhead and reserved memory
  const systemOverhead = calculateSystemOverhead(
    modelWeightsResult.totalMemory || modelWeightsResult,
    batchSize,
    { includeFragmentation: true, includeCudaContext: true }
  )

  // Calculate swap space
  const swapMemory = swapSpaceGB || calculateOptimalSwapSpace(
    totalVRAMGB,
    modelWeightsResult.totalMemory || modelWeightsResult,
    optimizationStrategy
  )

  // Calculate fragmentation overhead
  const fragmentationOverhead = calculateMemoryFragmentation(
    totalVRAMGB,
    batchSize,
    maxSeqLen,
    { quantization, architecture: arch }
  )

  // Calculate reserved memory for system operations
  const reservedMemory = calculateReservedMemory(
    totalVRAMGB,
    optimizationStrategy || { priority: 'balanced' }
  )

  // Total used memory
  const modelWeightsGB = modelWeightsResult.totalMemory || modelWeightsResult
  const usedMemory = modelWeightsGB + kvCacheMemory + activationMemory + systemOverhead + fragmentationOverhead
  const totalAllocated = usedMemory + swapMemory + reservedMemory
  const availableMemory = Math.max(0, totalVRAMGB - totalAllocated)

  // Calculate utilization percentages
  const utilizationPercent = (usedMemory / totalVRAMGB) * 100
  const allocationPercent = (totalAllocated / totalVRAMGB) * 100

  // Memory efficiency analysis
  const efficiency = calculateMemoryEfficiency({
    totalVRAMGB,
    usedMemory,
    modelWeightsGB,
    kvCacheMemory,
    batchSize,
    quantization
  })

  return {
    totalVRAMGB: Math.round(totalVRAMGB * 1000) / 1000,
    breakdown: {
      modelWeights: {
        sizeGB: Math.round(modelWeightsGB * 1000) / 1000,
        percentage: Math.round((modelWeightsGB / totalVRAMGB) * 100 * 10) / 10,
        quantization: quantization,
        quantizationSavings: modelWeightsResult.quantizationSavings || 0,
        baseSize: modelWeightsResult.baseMemory || modelWeightsGB,
        overhead: modelWeightsResult.overhead || 0,
      },
      kvCache: {
        sizeGB: Math.round(kvCacheMemory * 1000) / 1000,
        percentage: Math.round((kvCacheMemory / totalVRAMGB) * 100 * 10) / 10,
        precision: kvCachePrecision,
        batchSize: batchSize,
        maxSeqLen: maxSeqLen,
        layersSupported: arch.layers,
      },
      activations: {
        sizeGB: Math.round(activationMemory * 1000) / 1000,
        percentage: Math.round((activationMemory / totalVRAMGB) * 100 * 10) / 10,
        batchSize: batchSize,
        seqLen: seqLen,
        precision: quantization,
      },
      systemOverhead: {
        sizeGB: Math.round(systemOverhead * 1000) / 1000,
        percentage: Math.round((systemOverhead / totalVRAMGB) * 100 * 10) / 10,
        includes: ['CUDA context', 'driver overhead', 'kernel buffers'],
      },
      fragmentation: {
        sizeGB: Math.round(fragmentationOverhead * 1000) / 1000,
        percentage: Math.round((fragmentationOverhead / totalVRAMGB) * 100 * 10) / 10,
        cause: 'Memory allocation patterns and block alignment',
      },
      swap: {
        sizeGB: Math.round(swapMemory * 1000) / 1000,
        percentage: Math.round((swapMemory / totalVRAMGB) * 100 * 10) / 10,
        purpose: 'Overflow handling and memory pressure relief',
      },
      reserved: {
        sizeGB: Math.round(reservedMemory * 1000) / 1000,
        percentage: Math.round((reservedMemory / totalVRAMGB) * 100 * 10) / 10,
        purpose: 'System stability and emergency buffer',
      },
    },
    summary: {
      usedMemory: Math.round(usedMemory * 1000) / 1000,
      totalAllocated: Math.round(totalAllocated * 1000) / 1000,
      availableMemory: Math.round(availableMemory * 1000) / 1000,
      utilizationPercent: Math.round(utilizationPercent * 10) / 10,
      allocationPercent: Math.round(allocationPercent * 10) / 10,
      efficiency: efficiency,
    },
    analysis: {
      memoryPressure: analyzeMemoryPressure(utilizationPercent, availableMemory),
      quantizationBenefit: analyzeQuantizationBenefit(modelWeightsResult, quantization),
      optimizationRecommendations: generateMemoryOptimizationRecommendations({
        totalVRAMGB,
        utilizationPercent,
        breakdown: {
          modelWeightsGB,
          kvCacheMemory,
          activationMemory,
          systemOverhead,
          fragmentationOverhead,
        },
        quantization,
        batchSize,
        maxSeqLen,
      }),
    },
    compatibility: {
      supportsModel: totalAllocated <= totalVRAMGB,
      safetyMargin: Math.max(0, totalVRAMGB - totalAllocated),
      recommendedBatchSize: calculateOptimalBatchSizeForVRAM(totalVRAMGB, modelWeightsGB, kvCachePrecision),
      maxConcurrentSequences: calculateMaxConcurrentSequences(totalVRAMGB, modelWeightsGB, maxSeqLen, arch),
    }
  }
}

/**
 * Calculate model weights memory from a given size with quantization applied
 * @param {number} baseSizeGB - Base model size in GB (in fp16 precision)
 * @param {string} quantization - Quantization format
 * @returns {object} Memory calculation result
 */
export function calculateModelWeightsMemoryFromSize(baseSizeGB, quantization = 'fp16') {
  if (baseSizeGB <= 0) {
    throw new Error('Base model size must be positive')
  }

  const quantConfig = QUANTIZATION_FORMATS[quantization]
  if (!quantConfig) {
    throw new Error(`Unsupported quantization format: ${quantization}`)
  }

  // For fp16, the base size is already in fp16 - no further quantization needed
  // For other formats, calculate relative to fp16 base
  const fp16MemoryEfficiency = QUANTIZATION_FORMATS.fp16.memoryEfficiency // 0.5
  const baseMemoryFP32 = baseSizeGB / fp16MemoryEfficiency // Convert fp16 base to fp32 equivalent
  
  const quantizedSize = baseMemoryFP32 * quantConfig.memoryEfficiency
  const overhead = quantizedSize * (quantConfig.overhead || 0)
  const totalMemory = quantizedSize + overhead
  const quantizationSavings = baseSizeGB - totalMemory // Savings compared to fp16 base

  return {
    baseMemory: baseSizeGB,
    quantizedMemory: quantizedSize,
    overhead: overhead,
    totalMemory: totalMemory,
    quantizationSavings: Math.max(0, quantizationSavings), // No negative savings
    savingsPercent: Math.max(0, (quantizationSavings / baseSizeGB) * 100),
    quantization: quantization,
  }
}

/**
 * Calculate optimal swap space based on VRAM and optimization strategy
 * @param {number} totalVRAMGB - Total VRAM available
 * @param {number} modelSizeGB - Model size in GB
 * @param {object} strategy - Optimization strategy
 * @returns {number} Optimal swap space in GB
 */
export function calculateOptimalSwapSpace(totalVRAMGB, modelSizeGB, strategy = {}) {
  const { priority = 'balanced', workloadType = 'serving' } = strategy

  let swapRatio = 0.1 // Default 10% of VRAM

  switch (priority) {
    case 'throughput':
      swapRatio = workloadType === 'batch' ? 0.2 : 0.15 // Higher for batch processing
      break
    case 'latency':
      swapRatio = 0.05 // Minimal swap for latency
      break
    case 'balanced':
      swapRatio = 0.1 // Moderate swap space
      break
    default:
      swapRatio = 0.1
  }

  const maxSwap = Math.min(16, totalVRAMGB * 0.25) // Cap at 16GB or 25% of VRAM
  const minSwap = Math.max(1, modelSizeGB * 0.1) // At least 10% of model size or 1GB

  return Math.min(maxSwap, Math.max(minSwap, totalVRAMGB * swapRatio))
}

/**
 * Calculate memory fragmentation overhead
 * @param {number} totalVRAMGB - Total VRAM available
 * @param {number} batchSize - Batch size
 * @param {number} maxSeqLen - Maximum sequence length
 * @param {object} options - Additional options
 * @returns {number} Fragmentation overhead in GB
 */
export function calculateMemoryFragmentation(totalVRAMGB, batchSize, maxSeqLen, options = {}) {
  const { quantization = 'fp16' } = options

  // Base fragmentation rate depends on VRAM size - smaller VRAM has higher fragmentation
  let baseFragmentationRate = 0.02 // 2% base fragmentation

  // Smaller VRAM has worse allocation efficiency
  if (totalVRAMGB <= 16) {
    baseFragmentationRate = 0.025
  } else if (totalVRAMGB >= 40) {
    baseFragmentationRate = 0.018
  } else if (totalVRAMGB >= 80) {
    baseFragmentationRate = 0.015
  }

  // Batch size affects fragmentation
  const batchFragmentationFactor = Math.max(0.5, Math.min(2.0, batchSize / 32))
  
  // Sequence length affects memory allocation patterns
  const seqLenFactor = Math.max(0.8, Math.min(1.5, maxSeqLen / 2048))

  // Quantization affects alignment requirements
  const quantConfig = QUANTIZATION_FORMATS[quantization]
  const alignmentFactor = quantConfig ? (1 + (quantConfig.overhead || 0)) : 1

  const fragmentationOverhead = totalVRAMGB * baseFragmentationRate * 
                               batchFragmentationFactor * 
                               seqLenFactor * 
                               alignmentFactor

  return Math.max(0.1, fragmentationOverhead) // Minimum 0.1GB fragmentation
}

/**
 * Calculate reserved memory for system operations
 * @param {number} totalVRAMGB - Total VRAM available
 * @param {object} strategy - Optimization strategy
 * @returns {number} Reserved memory in GB
 */
export function calculateReservedMemory(totalVRAMGB, strategy = {}) {
  const { priority = 'balanced' } = strategy

  let reservationRate = 0.05 // Default 5% reservation

  switch (priority) {
    case 'throughput':
      reservationRate = 0.03 // Aggressive: minimal reservation
      break
    case 'latency':
      reservationRate = 0.08 // Conservative: more reservation for stability
      break
    case 'balanced':
      reservationRate = 0.05 // Moderate reservation
      break
    case 'conservative':
      reservationRate = 0.1 // High reservation for maximum stability
      break
    default:
      reservationRate = 0.05
  }

  const minReserved = 0.5 // Minimum 0.5GB reserved
  const maxReserved = Math.min(8, totalVRAMGB * 0.15) // Maximum 8GB or 15% of VRAM

  return Math.min(maxReserved, Math.max(minReserved, totalVRAMGB * reservationRate))
}

/**
 * Calculate memory efficiency metrics
 * @param {object} config - Configuration object
 * @returns {object} Efficiency analysis
 */
export function calculateMemoryEfficiency(config) {
  const {
    totalVRAMGB,
    usedMemory,
    modelWeightsGB,
    batchSize,
    quantization,
  } = config

  const utilizationRatio = usedMemory / totalVRAMGB
  const modelToTotalRatio = modelWeightsGB / totalVRAMGB

  // Calculate efficiency scores
  const utilizationEfficiency = Math.max(0, Math.min(1, (utilizationRatio - 0.5) / 0.4)) // Optimal range: 50-90%
  const modelEfficiency = Math.max(0, Math.min(1, (modelToTotalRatio * 2))) // Higher model ratio is better
  const batchEfficiency = Math.max(0, Math.min(1, Math.log(batchSize + 1) / Math.log(128))) // Log scale efficiency
  
  // Quantization efficiency bonus
  const quantConfig = QUANTIZATION_FORMATS[quantization]
  const quantizationEfficiency = quantConfig ? (1 - quantConfig.memoryEfficiency) : 0

  const overallEfficiency = (
    utilizationEfficiency * 0.4 +
    modelEfficiency * 0.3 +
    batchEfficiency * 0.2 +
    quantizationEfficiency * 0.1
  )

  return {
    overall: Math.round(overallEfficiency * 100),
    utilization: Math.round(utilizationEfficiency * 100),
    modelRatio: Math.round(modelEfficiency * 100),
    batchEfficiency: Math.round(batchEfficiency * 100),
    quantizationBonus: Math.round(quantizationEfficiency * 100),
    rating: getEfficiencyRating(overallEfficiency),
  }
}

/**
 * Get efficiency rating based on score
 * @param {number} score - Efficiency score (0-1)
 * @returns {string} Rating description
 */
export function getEfficiencyRating(score) {
  if (score >= 0.9) return 'Excellent'
  if (score >= 0.8) return 'Very Good'
  if (score >= 0.7) return 'Good'
  if (score >= 0.6) return 'Fair'
  if (score >= 0.5) return 'Poor'
  return 'Very Poor'
}

/**
 * Analyze memory pressure level
 * @param {number} utilizationPercent - Memory utilization percentage
 * @param {number} availableMemory - Available memory in GB
 * @returns {object} Memory pressure analysis
 */
export function analyzeMemoryPressure(utilizationPercent, availableMemory) {
  let level, description, recommendations

  if (utilizationPercent >= 95) {
    level = 'Critical'
    description = 'Memory usage is at critical levels. System instability likely.'
    recommendations = [
      'Reduce batch size immediately',
      'Use more aggressive quantization',
      'Consider model sharding across multiple GPUs',
      'Reduce maximum sequence length',
    ]
  } else if (utilizationPercent >= 90) {
    level = 'High'
    description = 'High memory pressure. Performance degradation possible.'
    recommendations = [
      'Reduce batch size for stability',
      'Monitor for OOM errors',
      'Consider using int8 or 4-bit quantization',
      'Implement gradual scaling',
    ]
  } else if (utilizationPercent >= 80) {
    level = 'Moderate'
    description = 'Moderate memory usage. Generally safe for production.'
    recommendations = [
      'Monitor memory usage during peak loads',
      'Have scaling plans ready',
      'Consider memory optimizations for efficiency',
    ]
  } else if (utilizationPercent >= 60) {
    level = 'Low'
    description = 'Comfortable memory usage with good headroom.'
    recommendations = [
      'Consider increasing batch size for better throughput',
      'Opportunity to use higher precision if quality is important',
      'Room for handling traffic spikes',
    ]
  } else {
    level = 'Very Low'
    description = 'Memory is underutilized. Efficiency could be improved.'
    recommendations = [
      'Increase batch size significantly',
      'Consider using higher precision formats',
      'Optimize for throughput rather than memory conservation',
      'Consider running multiple models or larger model variants',
    ]
  }

  return {
    level,
    description,
    utilizationPercent,
    availableMemoryGB: availableMemory,
    recommendations,
    isStable: utilizationPercent < 90,
    hasHeadroom: availableMemory > 2.0,
  }
}

/**
 * Analyze quantization benefits
 * @param {object} modelWeightsResult - Model weights calculation result
 * @param {string} quantization - Quantization format used
 * @returns {object} Quantization analysis
 */
export function analyzeQuantizationBenefit(modelWeightsResult, quantization) {
  const quantConfig = QUANTIZATION_FORMATS[quantization]
  if (!quantConfig) {
    return { error: 'Unknown quantization format' }
  }

  const memorySavings = modelWeightsResult.quantizationSavings || 0
  const savingsPercent = modelWeightsResult.savingsPercent || 0
  const qualityImpact = quantConfig.qualityLoss || 0

  let recommendation, tradeoffAnalysis

  if (savingsPercent >= 75) {
    recommendation = 'Excellent memory savings with acceptable quality trade-off'
    tradeoffAnalysis = 'Highly recommended for memory-constrained deployments'
  } else if (savingsPercent >= 50) {
    recommendation = 'Good memory savings with moderate quality impact'
    tradeoffAnalysis = 'Recommended for most production deployments'
  } else if (savingsPercent >= 25) {
    recommendation = 'Moderate savings with minimal quality loss'
    tradeoffAnalysis = 'Good balance for quality-sensitive applications'
  } else {
    recommendation = 'Minimal savings - consider higher precision if memory allows'
    tradeoffAnalysis = 'Higher precision may be worthwhile if VRAM is sufficient'
  }

  return {
    format: quantization,
    memorySavingsGB: memorySavings,
    savingsPercent: savingsPercent,
    qualityLoss: qualityImpact * 100, // Convert to percentage
    bitsPerParam: quantConfig.bitsPerParam,
    recommendation,
    tradeoffAnalysis,
    efficiency: quantConfig.memoryEfficiency,
    isRecommended: savingsPercent >= 25 && qualityImpact <= 0.05,
  }
}

/**
 * Generate memory optimization recommendations
 * @param {object} config - Configuration and breakdown data
 * @returns {array} Array of optimization recommendations
 */
export function generateMemoryOptimizationRecommendations(config) {
  const {
    totalVRAMGB,
    utilizationPercent,
    breakdown,
    quantization,
    batchSize,
  } = config

  const recommendations = []

  // High memory usage recommendations
  if (utilizationPercent > 90) {
    recommendations.push({
      priority: 'High',
      category: 'Immediate Action',
      title: 'Reduce Memory Usage',
      description: 'Memory usage is critically high and may cause instability',
      actions: [
        'Reduce batch size by 25-50%',
        'Implement more aggressive quantization (int8 or int4)',
        'Reduce maximum sequence length',
        'Enable memory-efficient attention mechanisms',
      ],
    })
  }

  // Quantization recommendations
  const quantConfig = QUANTIZATION_FORMATS[quantization]
  if (quantConfig && quantConfig.memoryEfficiency > 0.5) {
    recommendations.push({
      priority: 'Medium',
      category: 'Quantization',
      title: 'Consider More Aggressive Quantization',
      description: 'Further memory savings possible with advanced quantization',
      actions: [
        'Try AWQ or GPTQ for better quality-size trade-offs',
        'Consider 4-bit quantization for maximum memory savings',
        'Evaluate int8 dynamic quantization for activations',
      ],
    })
  }

  // Batch size optimization
  if (batchSize < 16 && utilizationPercent < 70) {
    recommendations.push({
      priority: 'Medium',
      category: 'Performance',
      title: 'Increase Batch Size',
      description: 'Memory is underutilized, can increase throughput',
      actions: [
        `Increase batch size to ${Math.min(64, Math.floor(batchSize * 2))}`,
        'Monitor memory usage during peak loads',
        'Implement gradual batch size scaling',
      ],
    })
  }

  // KV cache optimization
  const kvCachePercent = (breakdown.kvCacheMemory / totalVRAMGB) * 100
  if (kvCachePercent > 30) {
    recommendations.push({
      priority: 'Medium',
      category: 'KV Cache',
      title: 'Optimize KV Cache Usage',
      description: 'KV cache is consuming significant memory',
      actions: [
        'Reduce maximum sequence length if possible',
        'Implement KV cache compression',
        'Use int8 precision for KV cache',
        'Enable selective KV cache eviction',
      ],
    })
  }

  // Fragmentation recommendations
  const fragmentationPercent = (breakdown.fragmentationOverhead / totalVRAMGB) * 100
  if (fragmentationPercent > 3) {
    recommendations.push({
      priority: 'Low',
      category: 'Memory Management',
      title: 'Reduce Memory Fragmentation',
      description: 'Memory fragmentation is higher than optimal',
      actions: [
        'Use consistent batch sizes to improve allocation patterns',
        'Implement memory pre-allocation strategies',
        'Consider memory pool allocation for frequent operations',
      ],
    })
  }

  // Architecture-specific recommendations
  if (totalVRAMGB >= 80) {
    recommendations.push({
      priority: 'Low',
      category: 'High-End Optimization',
      title: 'Leverage High VRAM Capacity',
      description: 'High VRAM capacity allows for advanced optimizations',
      actions: [
        'Consider running larger model variants',
        'Implement model parallelism for even larger models',
        'Use higher precision where quality is critical',
        'Optimize for maximum throughput',
      ],
    })
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { High: 3, Medium: 2, Low: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  })
}

/**
 * Calculate optimal batch size for given VRAM constraints
 * @param {number} totalVRAMGB - Total VRAM available
 * @param {number} modelSizeGB - Model size in GB
 * @param {string} kvCachePrecision - KV cache precision
 * @returns {number} Recommended batch size
 */
export function calculateOptimalBatchSizeForVRAM(totalVRAMGB, modelSizeGB, kvCachePrecision = 'fp16') {
  const availableForInference = (totalVRAMGB * 0.85) - modelSizeGB // 85% utilization, minus model
  
  if (availableForInference <= 0) {
    return 1 // Minimum viable batch size
  }
  
  // Rough estimation: each sequence needs memory for KV cache and activations
  // This is a conservative estimate based on typical transformer models
  const bytesPerParam = kvCachePrecision === 'fp16' ? 2 : 4
  const estimatedMemoryPerSequence = 0.1 + (bytesPerParam * 0.001) // Base overhead + precision factor
  
  // Calculate based on available memory
  const maxSequences = Math.floor(availableForInference / estimatedMemoryPerSequence)
  
  // Apply reasonable bounds and adjust for VRAM size
  let recommendedBatchSize = maxSequences
  
  if (totalVRAMGB <= 16) {
    recommendedBatchSize = Math.min(recommendedBatchSize, 16) // Limited VRAM
  } else if (totalVRAMGB <= 24) {
    recommendedBatchSize = Math.min(recommendedBatchSize, 32)
  } else if (totalVRAMGB <= 48) {
    recommendedBatchSize = Math.min(recommendedBatchSize, 64)
  } else {
    recommendedBatchSize = Math.min(recommendedBatchSize, 256) // Cap at 256
  }
  
  return Math.max(1, recommendedBatchSize) // At least 1
}

/**
 * Calculate maximum concurrent sequences for given constraints
 * @param {number} totalVRAMGB - Total VRAM available
 * @param {number} modelSizeGB - Model size in GB
 * @param {number} maxSeqLen - Maximum sequence length
 * @param {object} architecture - Model architecture
 * @returns {number} Maximum concurrent sequences
 */
export function calculateMaxConcurrentSequences(totalVRAMGB, modelSizeGB, maxSeqLen, architecture) {
  const availableMemory = totalVRAMGB * 0.9 - modelSizeGB // 90% utilization
  const kvCachePerSequence = calculateKVCacheMemory(
    1, // Single sequence
    maxSeqLen,
    architecture.layers,
    architecture.hiddenSize,
    architecture.numHeads,
    'fp16'
  )
  
  const activationPerSequence = 0.1 // Rough estimate in GB
  const memoryPerSequence = kvCachePerSequence + activationPerSequence
  
  return Math.max(1, Math.floor(availableMemory / memoryPerSequence))
}
