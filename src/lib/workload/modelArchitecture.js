/**
 * Model Architecture Estimation Module for vLLM
 * 
 * This module provides functions for estimating model architecture parameters
 * and calculating memory usage based on model specifications.
 * 
 * Key features:
 * - Architecture parameter estimation based on model size
 * - Memory usage calculations for different components
 * - Support for various model precisions and configurations
 * 
 * References:
 * - Transformer architecture patterns
 * - Common model sizes (Llama, GPT, etc.)
 * - vLLM memory calculation documentation
 */

// Import required calculation functions
import { calculateKVCacheMemory } from '../memory/kvCache.js'
import { calculateActivationMemory } from '../memory/activations.js'
import { calculateModelWeightsMemory } from '../quantization.js'

// ================================
// MODEL ARCHITECTURE ESTIMATION
// ================================

/**
 * Standard transformer architecture configurations for common model sizes
 */
export const MODEL_ARCHITECTURE_PRESETS = {
  // Small models (experimental/testing)
  0.1: { layers: 6, hiddenSize: 512, numHeads: 8, vocabSize: 32000, intermediateSize: 2048, architecture: 'llama', name: 'tiny' },
  0.5: { layers: 12, hiddenSize: 768, numHeads: 12, vocabSize: 32000, intermediateSize: 3072, architecture: 'llama', name: 'small' },
  
  // Medium models (1-3B)
  1: { layers: 16, hiddenSize: 1024, numHeads: 16, vocabSize: 32000, intermediateSize: 4096, architecture: 'llama', name: 'medium-1b' },
  1.5: { layers: 20, hiddenSize: 1280, numHeads: 20, vocabSize: 32000, intermediateSize: 5120, architecture: 'llama', name: 'medium-1.5b' },
  3: { layers: 24, hiddenSize: 1536, numHeads: 24, vocabSize: 32000, intermediateSize: 6144, architecture: 'llama', name: 'medium-3b' },
  
  // Large models (7-13B)
  7: { layers: 32, hiddenSize: 4096, numHeads: 32, vocabSize: 32000, intermediateSize: 11008, architecture: 'llama', name: 'large-7b' },     // Llama-2 7B, Mistral 7B
  8: { layers: 32, hiddenSize: 4096, numHeads: 32, vocabSize: 32000, intermediateSize: 11008, architecture: 'llama', name: 'large-8b' },     // Llama-3 8B
  13: { layers: 40, hiddenSize: 5120, numHeads: 40, vocabSize: 32000, intermediateSize: 13824, architecture: 'llama', name: 'large-13b' },   // Llama-2 13B
  
  // Very large models (30-70B)
  30: { layers: 60, hiddenSize: 6656, numHeads: 52, vocabSize: 32000, intermediateSize: 17920, architecture: 'llama', name: 'xl-30b' },      // Code Llama 34B
  34: { layers: 60, hiddenSize: 6656, numHeads: 52, vocabSize: 32000, intermediateSize: 17920, architecture: 'llama', name: 'xl-34b' },      // Code Llama 34B
  65: { layers: 80, hiddenSize: 8192, numHeads: 64, vocabSize: 32000, intermediateSize: 22016, architecture: 'llama', name: 'xl-65b' },      // Llama-2 70B
  70: { layers: 80, hiddenSize: 8192, numHeads: 64, vocabSize: 32000, intermediateSize: 22016, architecture: 'llama', name: 'xl-70b' },      // Llama-2 70B
  
  // Massive models (100B+)
  175: { layers: 96, hiddenSize: 12288, numHeads: 96, name: 'xxl-175b' },  // GPT-3 175B
  405: { layers: 126, hiddenSize: 16384, numHeads: 128, name: 'xxl-405b' }, // Llama-3 405B
}

/**
 * Estimate model architecture parameters from number of parameters
 * @param {number} numParams - Number of parameters in billions
 * @returns {object} Estimated architecture parameters
 */
export function estimateModelArchitecture(numParams) {
  if (!numParams || numParams <= 0) {
    throw new Error('Number of parameters must be a positive number')
  }

  // Find the closest preset architecture
  const presetSizes = Object.keys(MODEL_ARCHITECTURE_PRESETS).map(Number).sort((a, b) => a - b)
  let closestSize = presetSizes[0]
  
  for (const size of presetSizes) {
    if (Math.abs(size - numParams) < Math.abs(closestSize - numParams)) {
      closestSize = size
    }
  }

  const baseArchitecture = MODEL_ARCHITECTURE_PRESETS[closestSize]
  
  // If the model size is significantly different from preset, interpolate
  if (Math.abs(numParams - closestSize) > closestSize * 0.3) {
    const interpolated = interpolateArchitecture(numParams, presetSizes)
    return {
      ...interpolated,
      name: `custom-${numParams}b`,
      isInterpolated: true,
      closestPreset: baseArchitecture.name
    }
  }

  return {
    ...baseArchitecture,
    isInterpolated: false
  }
}

/**
 * Interpolate architecture parameters for sizes not in presets
 * @param {number} targetParams - Target parameter count in billions
 * @param {number[]} presetSizes - Available preset sizes
 * @returns {object} Interpolated architecture
 */
function interpolateArchitecture(targetParams, presetSizes) {
  // Find the two closest presets for interpolation
  let lowerSize = presetSizes[0]
  let upperSize = presetSizes[presetSizes.length - 1]
  
  for (let i = 0; i < presetSizes.length - 1; i++) {
    if (presetSizes[i] <= targetParams && presetSizes[i + 1] >= targetParams) {
      lowerSize = presetSizes[i]
      upperSize = presetSizes[i + 1]
      break
    }
  }
  
  const lowerArch = MODEL_ARCHITECTURE_PRESETS[lowerSize]
  const upperArch = MODEL_ARCHITECTURE_PRESETS[upperSize]
  
  // Linear interpolation factor
  const factor = (targetParams - lowerSize) / (upperSize - lowerSize)
  
  return {
    layers: Math.round(lowerArch.layers + (upperArch.layers - lowerArch.layers) * factor),
    hiddenSize: Math.round(lowerArch.hiddenSize + (upperArch.hiddenSize - lowerArch.hiddenSize) * factor),
    numHeads: Math.round(lowerArch.numHeads + (upperArch.numHeads - lowerArch.numHeads) * factor),
    vocabSize: Math.round(lowerArch.vocabSize + (upperArch.vocabSize - lowerArch.vocabSize) * factor),
    intermediateSize: Math.round(lowerArch.intermediateSize + (upperArch.intermediateSize - lowerArch.intermediateSize) * factor),
    architecture: lowerArch.architecture,
  }
}

/**
 * Get architecture recommendations based on model parameters
 * @param {number} numParams - Number of parameters in billions
 * @returns {object} Architecture recommendations and alternatives
 */
export function getArchitectureRecommendations(numParams) {
  const estimated = estimateModelArchitecture(numParams)
  const presetSizes = Object.keys(MODEL_ARCHITECTURE_PRESETS).map(Number)
  
  // Find similar sized models
  const similarModels = presetSizes
    .filter(size => Math.abs(size - numParams) <= numParams * 0.5)
    .map(size => ({
      size,
      ...MODEL_ARCHITECTURE_PRESETS[size],
      similarity: 1 - Math.abs(size - numParams) / numParams
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)

  return {
    estimated,
    similarModels,
    recommendations: {
      optimal: estimated,
      alternatives: similarModels.slice(1),
      considerations: getArchitectureConsiderations(numParams, estimated)
    }
  }
}

/**
 * Get architecture-specific considerations and recommendations
 * @param {number} numParams - Number of parameters
 * @param {object} architecture - Architecture configuration
 * @returns {string[]} List of considerations
 */
function getArchitectureConsiderations(numParams, architecture) {
  const considerations = []

  if (numParams < 1) {
    considerations.push('Small model: Good for testing and development, limited capability')
  } else if (numParams < 7) {
    considerations.push('Medium model: Good balance of performance and resource usage')
  } else if (numParams < 30) {
    considerations.push('Large model: High capability, requires significant resources')
  } else {
    considerations.push('Very large model: Cutting-edge capability, requires substantial infrastructure')
  }

  // Architecture-specific recommendations
  if (architecture.hiddenSize >= 8192) {
    considerations.push('Large hidden size: Consider tensor parallelism for memory distribution')
  }
  
  if (architecture.layers >= 80) {
    considerations.push('Deep model: May benefit from pipeline parallelism')
  }
  
  if (architecture.numHeads >= 64) {
    considerations.push('Many attention heads: Excellent for complex reasoning tasks')
  }

  return considerations
}

// ================================
// MEMORY USAGE CALCULATIONS
// ================================

/**
 * Calculate total vLLM memory usage with detailed breakdown
 * @param {object} config - Configuration object
 * @param {number} config.modelSizeGB - Model size in GB (weights only)
 * @param {number} config.numParams - Number of parameters in billions
 * @param {string} config.modelPrecision - Model precision ('fp16', 'fp32', etc.)
 * @param {string} config.kvCachePrecision - KV cache precision
 * @param {number} config.batchSize - Number of concurrent sequences
 * @param {number} config.maxSeqLen - Maximum sequence length
 * @param {number} config.seqLen - Current sequence length for activations
 * @param {object} config.architecture - Model architecture (optional, will be estimated if not provided)
 * @returns {object} Detailed memory breakdown
 */
export function calculateVLLMMemoryUsage(config) {
  const {
    modelSizeGB,
    numParams,
    modelPrecision = 'fp16',
    kvCachePrecision = 'fp16',
    batchSize = 1,
    maxSeqLen = 2048,
    seqLen = 512,
    architecture
  } = config

  // Validate inputs
  if (!modelSizeGB && !numParams) {
    throw new Error('Either modelSizeGB or numParams must be provided')
  }
  
  if (batchSize <= 0 || maxSeqLen <= 0 || seqLen <= 0) {
    throw new Error('Batch size and sequence lengths must be positive')
  }

  // Get or estimate architecture
  let finalArchitecture = architecture
  if (!finalArchitecture && numParams) {
    finalArchitecture = estimateModelArchitecture(numParams)
  } else if (!finalArchitecture) {
    // Estimate from model size (rough approximation)
    const estimatedParams = modelSizeGB / 2 // Rough estimate: 2GB per billion parameters for fp16
    finalArchitecture = estimateModelArchitecture(estimatedParams)
  }

  // Calculate model weights memory
  let weightsMemoryGB = modelSizeGB
  if (!weightsMemoryGB && numParams) {
    const weightsInfo = calculateModelWeightsMemory(numParams, modelPrecision)
    weightsMemoryGB = weightsInfo.totalMemory
  }

  // Calculate KV cache memory
  const kvCacheMemoryGB = calculateKVCacheMemory(
    batchSize,
    maxSeqLen,
    finalArchitecture.layers,
    finalArchitecture.hiddenSize,
    finalArchitecture.numHeads,
    kvCachePrecision
  )

  // Calculate activation memory (for current sequence length)
  const activationMemoryGB = calculateActivationMemory(
    batchSize,
    seqLen,
    finalArchitecture.hiddenSize,
    finalArchitecture.layers
  )

  // System overhead (approximate)
  const systemOverheadGB = (weightsMemoryGB + kvCacheMemoryGB + activationMemoryGB) * 0.1

  // Total memory
  const totalMemoryGB = weightsMemoryGB + kvCacheMemoryGB + activationMemoryGB + systemOverheadGB

  return {
    totalMemoryGB: Math.round(totalMemoryGB * 100) / 100,
    breakdown: {
      modelWeights: Math.round(weightsMemoryGB * 100) / 100,
      kvCache: Math.round(kvCacheMemoryGB * 100) / 100,
      activations: Math.round(activationMemoryGB * 100) / 100,
      systemOverhead: Math.round(systemOverheadGB * 100) / 100
    },
    configuration: {
      architecture: finalArchitecture,
      batchSize,
      maxSeqLen,
      seqLen,
      modelPrecision,
      kvCachePrecision
    },
    memoryEfficiency: {
      kvCachePercentage: Math.round((kvCacheMemoryGB / totalMemoryGB) * 100),
      activationPercentage: Math.round((activationMemoryGB / totalMemoryGB) * 100),
      weightsPercentage: Math.round((weightsMemoryGB / totalMemoryGB) * 100),
      overheadPercentage: Math.round((systemOverheadGB / totalMemoryGB) * 100)
    },
    scalingEstimates: {
      perSequence: Math.round(kvCacheMemoryGB / batchSize * 100) / 100,
      per1kTokens: Math.round((kvCacheMemoryGB / maxSeqLen * 1000) * 100) / 100
    }
  }
}

/**
 * Compare memory usage across different model architectures
 * @param {object[]} configs - Array of configuration objects
 * @returns {object} Comparison results
 */
export function compareArchitectureMemoryUsage(configs) {
  const results = configs.map((config, index) => ({
    id: index,
    config,
    memory: calculateVLLMMemoryUsage(config)
  }))

  // Find the most efficient configuration
  const mostEfficient = results.reduce((best, current) => 
    current.memory.totalMemoryGB < best.memory.totalMemoryGB ? current : best
  )

  return {
    results,
    comparison: {
      mostEfficient: mostEfficient.id,
      memoryRange: {
        min: Math.min(...results.map(r => r.memory.totalMemoryGB)),
        max: Math.max(...results.map(r => r.memory.totalMemoryGB))
      },
      recommendations: generateArchitectureRecommendations(results)
    }
  }
}

/**
 * Generate recommendations based on architecture comparison
 * @param {object[]} results - Architecture comparison results
 * @returns {string[]} List of recommendations
 */
function generateArchitectureRecommendations(results) {
  const recommendations = []
  
  // Memory efficiency analysis
  const memoryUsages = results.map(r => r.memory.totalMemoryGB)
  const avgMemory = memoryUsages.reduce((a, b) => a + b) / memoryUsages.length
  
  results.forEach((result, index) => {
    if (result.memory.totalMemoryGB < avgMemory * 0.8) {
      recommendations.push(`Configuration ${index}: Memory efficient (${result.memory.totalMemoryGB}GB)`)
    } else if (result.memory.totalMemoryGB > avgMemory * 1.2) {
      recommendations.push(`Configuration ${index}: High memory usage (${result.memory.totalMemoryGB}GB) - consider optimization`)
    }
  })

  return recommendations
}

// ================================
// ARCHITECTURE VALIDATION
// ================================

/**
 * Validate model architecture parameters
 * @param {object} architecture - Architecture configuration
 * @returns {object} Validation result
 */
export function validateArchitecture(architecture) {
  const errors = []
  const warnings = []

  if (!architecture.layers || architecture.layers < 1) {
    errors.push('Number of layers must be at least 1')
  } else if (architecture.layers > 200) {
    warnings.push('Very deep model (>200 layers) may have training/inference challenges')
  }

  if (!architecture.hiddenSize || architecture.hiddenSize < 64) {
    errors.push('Hidden size must be at least 64')
  } else if (architecture.hiddenSize % 64 !== 0) {
    warnings.push('Hidden size should be divisible by 64 for optimal performance')
  }

  if (!architecture.numHeads || architecture.numHeads < 1) {
    errors.push('Number of attention heads must be at least 1')
  } else if (architecture.hiddenSize % architecture.numHeads !== 0) {
    errors.push('Hidden size must be divisible by number of attention heads')
  }

  // Check for reasonable ratios
  const headSize = architecture.hiddenSize / architecture.numHeads
  if (headSize < 32) {
    warnings.push('Very small attention head size may reduce model quality')
  } else if (headSize > 256) {
    warnings.push('Very large attention head size may be inefficient')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations: errors.length === 0 ? generateValidationRecommendations(architecture) : []
  }
}

/**
 * Generate recommendations for valid architectures
 * @param {object} architecture - Architecture configuration
 * @returns {string[]} Recommendations
 */
function generateValidationRecommendations(architecture) {
  const recommendations = []
  
  const headSize = architecture.hiddenSize / architecture.numHeads
  
  if (headSize === 64) {
    recommendations.push('Standard head size (64) - good balance of quality and efficiency')
  }
  
  if (architecture.hiddenSize >= 4096) {
    recommendations.push('Large model - consider tensor parallelism for multi-GPU deployment')
  }
  
  if (architecture.layers >= 32) {
    recommendations.push('Deep model - ensure adequate memory for layer-wise operations')
  }

  return recommendations
}

/**
 * Calculate model parameters breakdown by component
 * @param {object} architecture - Model architecture object
 * @returns {object} Parameter breakdown by component
 */
export function calculateModelParameters(architecture) {
  const { layers, hiddenSize, numHeads, vocabSize, intermediateSize } = architecture
  
  // Calculate parameters for each component
  const embedding = vocabSize * hiddenSize
  const attention = layers * (hiddenSize * hiddenSize * 4) // Q, K, V, output projections
  const mlp = layers * (hiddenSize * intermediateSize * 2 + intermediateSize + hiddenSize) // up, down projections + biases
  const layernorm = layers * hiddenSize * 2 // layer norm parameters
  const lmHead = hiddenSize * vocabSize // final language modeling head
  
  const total = embedding + attention + mlp + layernorm + lmHead
  
  return {
    total,
    embedding,
    attention,
    mlp,
    layernorm,
    lmHead,
    breakdown: {
      embeddingPercent: Math.round((embedding / total) * 100),
      attentionPercent: Math.round((attention / total) * 100),
      mlpPercent: Math.round((mlp / total) * 100),
      layernormPercent: Math.round((layernorm / total) * 100),
      lmHeadPercent: Math.round((lmHead / total) * 100),
    }
  }
}

/**
 * Estimate layer-wise memory usage
 * @param {object} architecture - Model architecture object
 * @param {number} batchSize - Batch size
 * @param {number} sequenceLength - Sequence length (optional, default 1024)
 * @param {boolean} training - Training mode (optional, default false)
 * @returns {object} Layer-wise memory breakdown
 */
export function estimateLayerWiseMemory(architecture, batchSize, sequenceLength = 1024, training = false) {
  const { layers, hiddenSize, numHeads, intermediateSize } = architecture
  
  // Calculate memory per layer
  const activationMemoryPerLayer = batchSize * sequenceLength * hiddenSize * 2 / (1024 ** 3) // fp16
  const attentionMemoryPerLayer = batchSize * sequenceLength * sequenceLength * numHeads * 2 / (1024 ** 3) // attention weights
  const mlpMemoryPerLayer = batchSize * sequenceLength * intermediateSize * 2 / (1024 ** 3) // MLP activations
  
  const totalPerLayer = activationMemoryPerLayer + attentionMemoryPerLayer + mlpMemoryPerLayer
  const totalMemory = totalPerLayer * layers
  
  // Training requires gradient memory (roughly 2x)
  const finalMemory = training ? totalMemory * 2 : totalMemory
  
  return {
    totalMemoryGB: finalMemory,
    perLayerGB: totalPerLayer,
    layers,
    breakdown: {
      activationMemoryGB: activationMemoryPerLayer * layers,
      attentionMemoryGB: attentionMemoryPerLayer * layers,
      mlpMemoryGB: mlpMemoryPerLayer * layers,
    },
    config: {
      batchSize,
      sequenceLength,
      training,
    }
  }
}

/**
 * Get model family specifications
 * @param {string} family - Model family ('llama', 'gpt', 'mistral', etc.)
 * @returns {object} Family-specific specifications and scaling factors
 */
export function getModelFamilySpecs(family) {
  const familySpecs = {
    llama: {
      defaultVocabSize: 32000,
      attentionType: 'grouped_query',
      layerScaling: 1.0,
      memoryEfficiency: 0.85,
      description: 'Llama family models (efficient attention)'
    },
    gpt: {
      defaultVocabSize: 50257,
      attentionType: 'standard',
      layerScaling: 1.1,
      memoryEfficiency: 0.80,
      description: 'GPT family models (standard attention)'
    },
    mistral: {
      defaultVocabSize: 32000,
      attentionType: 'sliding_window',
      layerScaling: 0.95,
      memoryEfficiency: 0.88,
      description: 'Mistral family models (sliding window attention)'
    },
    default: {
      defaultVocabSize: 32000,
      attentionType: 'standard',
      layerScaling: 1.0,
      memoryEfficiency: 0.80,
      description: 'Generic transformer model'
    }
  }
  
  return familySpecs[family] || familySpecs.default
}

/**
 * Supported architectures constant
 */
export const SUPPORTED_ARCHITECTURES = ['llama', 'gpt', 'mistral', 'gemma', 'qwen', 'phi']
