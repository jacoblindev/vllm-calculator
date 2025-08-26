/**
 * KV Cache Memory Calculation Module
 * 
 * This module provides functions for calculating Key-Value cache memory usage
 * in transformer models, specifically optimized for vLLM.
 * 
 * The KV cache stores the key and value tensors for each attention head
 * across all layers, which is essential for efficient autoregressive generation.
 */

import { Validators } from '../validation.js'

/**
 * Supported precision formats for KV cache
 */
const KV_PRECISION_FORMATS = {
  fp32: { bytes: 4, description: '32-bit floating point' },
  fp16: { bytes: 2, description: '16-bit floating point (recommended)' },
  bf16: { bytes: 2, description: 'Brain Float 16' },
  int8: { bytes: 1, description: '8-bit integer (experimental)' },
}

/**
 * Calculate KV cache memory usage for vLLM
 * @param {number} batchSize - Number of concurrent sequences
 * @param {number} maxSeqLen - Maximum sequence length
 * @param {number} numLayers - Number of transformer layers
 * @param {number} hiddenSize - Hidden dimension size
 * @param {number} numHeads - Number of attention heads
 * @param {string} kvPrecision - KV cache precision ('fp16', 'fp32', 'int8')
 * @returns {number} KV cache memory in GB
 */
export function calculateKVCacheMemory(
  batchSize,
  maxSeqLen,
  numLayers,
  hiddenSize,
  numHeads,
  kvPrecision = 'fp16'
) {
  // Validate inputs
  Validators.positiveNumber(batchSize, 'batchSize')
  Validators.positiveNumber(maxSeqLen, 'maxSeqLen')
  Validators.positiveNumber(numLayers, 'numLayers')
  Validators.positiveNumber(hiddenSize, 'hiddenSize')
  Validators.positiveNumber(numHeads, 'numHeads')
  Validators.string(kvPrecision, 'kvPrecision')

  const precisionInfo = KV_PRECISION_FORMATS[kvPrecision]
  if (!precisionInfo) {
    throw new Error(`Unsupported KV precision: ${kvPrecision}. Supported formats: ${Object.keys(KV_PRECISION_FORMATS).join(', ')}`)
  }

  // KV cache formula: 2 (K and V) × batch_size × seq_len × num_layers × hidden_size × bytes_per_element
  const kvCacheBytes = 2 * batchSize * maxSeqLen * numLayers * hiddenSize * precisionInfo.bytes
  
  // Convert bytes to GB
  return kvCacheBytes / (1024 ** 3)
}

/**
 * Calculate KV cache memory with detailed breakdown
 * @param {object} config - Configuration object
 * @param {number} config.batchSize - Number of concurrent sequences
 * @param {number} config.maxSeqLen - Maximum sequence length
 * @param {number} config.numLayers - Number of transformer layers
 * @param {number} config.hiddenSize - Hidden dimension size
 * @param {number} config.numHeads - Number of attention heads
 * @param {string} config.kvPrecision - KV cache precision
 * @returns {object} Detailed KV cache memory breakdown
 */
export function calculateKVCacheBreakdown(config) {
  Validators.object(config, ['batchSize', 'maxSeqLen', 'numLayers', 'hiddenSize', 'numHeads'], 'config')
  
  const {
    batchSize,
    maxSeqLen,
    numLayers,
    hiddenSize,
    numHeads,
    kvPrecision = 'fp16'
  } = config

  const totalMemoryGB = calculateKVCacheMemory(batchSize, maxSeqLen, numLayers, hiddenSize, numHeads, kvPrecision)
  const precisionInfo = KV_PRECISION_FORMATS[kvPrecision]
  
  // Calculate per-component breakdown
  const perLayerGB = totalMemoryGB / numLayers
  const perSequenceGB = totalMemoryGB / batchSize
  const perTokenGB = totalMemoryGB / (batchSize * maxSeqLen)
  
  return {
    totalMemoryGB: Math.round(totalMemoryGB * 1000) / 1000,
    breakdown: {
      batchSize,
      maxSeqLen,
      numLayers,
      hiddenSize,
      numHeads,
      kvPrecision,
      precisionBytes: precisionInfo.bytes,
    },
    perComponent: {
      perLayerGB: Math.round(perLayerGB * 1000) / 1000,
      perSequenceGB: Math.round(perSequenceGB * 1000) / 1000,
      perTokenGB: Math.round(perTokenGB * 1000000) / 1000000, // More precision for small values
    },
    memoryCalculation: {
      formula: '2 × batchSize × maxSeqLen × numLayers × hiddenSize × bytesPerElement',
      totalElements: 2 * batchSize * maxSeqLen * numLayers * hiddenSize,
      totalBytes: 2 * batchSize * maxSeqLen * numLayers * hiddenSize * precisionInfo.bytes,
    }
  }
}

/**
 * Estimate optimal KV cache block size for vLLM
 * @param {number} totalKVCacheGB - Total KV cache memory in GB
 * @param {string} optimizationTarget - 'latency' | 'throughput' | 'balanced'
 * @returns {number} Recommended block size
 */
export function estimateOptimalKVCacheBlockSize(totalKVCacheGB, optimizationTarget = 'balanced') {
  Validators.positiveNumber(totalKVCacheGB, 'totalKVCacheGB')
  Validators.string(optimizationTarget, 'optimizationTarget')

  // Block size recommendations based on memory size and optimization target
  const blockSizeRecommendations = {
    latency: {
      small: 8,    // < 4GB KV cache
      medium: 16,  // 4-16GB KV cache
      large: 16,   // > 16GB KV cache
    },
    throughput: {
      small: 16,   // < 4GB KV cache
      medium: 24,  // 4-16GB KV cache
      large: 32,   // > 16GB KV cache
    },
    balanced: {
      small: 16,   // < 4GB KV cache
      medium: 16,  // 4-16GB KV cache
      large: 24,   // > 16GB KV cache
    }
  }

  const recommendations = blockSizeRecommendations[optimizationTarget] || blockSizeRecommendations.balanced
  
  if (totalKVCacheGB < 4) {
    return recommendations.small
  } else if (totalKVCacheGB < 16) {
    return recommendations.medium
  } else {
    return recommendations.large
  }
}

/**
 * Calculate KV cache scaling with different batch sizes
 * @param {object} baseConfig - Base configuration
 * @param {number[]} batchSizes - Array of batch sizes to test
 * @returns {object[]} Array of KV cache calculations for different batch sizes
 */
export function calculateKVCacheScaling(baseConfig, batchSizes) {
  Validators.object(baseConfig, ['maxSeqLen', 'numLayers', 'hiddenSize', 'numHeads'], 'baseConfig')
  Validators.array(batchSizes, 'batchSizes')

  const { maxSeqLen, numLayers, hiddenSize, numHeads, kvPrecision = 'fp16' } = baseConfig

  return batchSizes.map(batchSize => {
    const memoryGB = calculateKVCacheMemory(batchSize, maxSeqLen, numLayers, hiddenSize, numHeads, kvPrecision)
    const recommendedBlockSize = estimateOptimalKVCacheBlockSize(memoryGB)
    
    return {
      batchSize,
      kvCacheMemoryGB: Math.round(memoryGB * 1000) / 1000,
      recommendedBlockSize,
      memoryPerSequence: Math.round((memoryGB / batchSize) * 1000) / 1000,
    }
  })
}

/**
 * Get supported KV cache precision formats
 * @returns {object} Object containing supported formats and their details
 */
export function getSupportedKVCachePrecisions() {
  return { ...KV_PRECISION_FORMATS }
}

/**
 * Validate KV cache configuration
 * @param {object} config - KV cache configuration to validate
 * @returns {object} Validation result with warnings and recommendations
 */
export function validateKVCacheConfig(config) {
  const warnings = []
  const recommendations = []
  
  const {
    batchSize,
    maxSeqLen,
    numLayers,
    hiddenSize,
    numHeads,
    kvPrecision = 'fp16',
    totalVRAMGB
  } = config

  // Check for very large configurations
  const totalMemoryGB = calculateKVCacheMemory(batchSize, maxSeqLen, numLayers, hiddenSize, numHeads, kvPrecision)
  
  if (totalMemoryGB > 50) {
    warnings.push(`Very large KV cache (${totalMemoryGB.toFixed(1)}GB). Consider reducing batch size or sequence length.`)
  }
  
  if (totalVRAMGB && totalMemoryGB > totalVRAMGB * 0.7) {
    warnings.push(`KV cache uses ${Math.round((totalMemoryGB / totalVRAMGB) * 100)}% of VRAM. This may not leave enough memory for model weights.`)
  }
  
  // Check for suboptimal precision
  if (kvPrecision === 'fp32') {
    recommendations.push('Consider using fp16 instead of fp32 for KV cache to save memory with minimal quality impact.')
  }
  
  // Check for very small batch sizes
  if (batchSize < 4) {
    recommendations.push('Very small batch size may underutilize GPU. Consider increasing if memory allows.')
  }
  
  // Check for very long sequences
  if (maxSeqLen > 8192) {
    recommendations.push('Very long sequences increase memory usage significantly. Consider enabling chunked prefill.')
  }

  return {
    isValid: warnings.length === 0,
    totalKVCacheMemoryGB: Math.round(totalMemoryGB * 1000) / 1000,
    warnings,
    recommendations,
    config: {
      batchSize,
      maxSeqLen,
      kvPrecision,
      recommendedBlockSize: estimateOptimalKVCacheBlockSize(totalMemoryGB),
    }
  }
}

export { KV_PRECISION_FORMATS }
