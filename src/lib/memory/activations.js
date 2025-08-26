/**
 * Activation Memory Calculation Module
 * 
 * This module provides functions for calculating activation memory usage
 * in transformer models during forward and backward passes.
 * 
 * Activations include intermediate computations like attention weights,
 * MLP activations, and other temporary tensors needed during inference.
 */

import { Validators } from '../validation.js'

/**
 * Supported precision formats for activations
 */
const ACTIVATION_PRECISION_FORMATS = {
  fp32: { bytes: 4, description: '32-bit floating point' },
  fp16: { bytes: 2, description: '16-bit floating point (recommended)' },
  bf16: { bytes: 2, description: 'Brain Float 16' },
}

/**
 * Memory multipliers for different activation components
 */
const ACTIVATION_MULTIPLIERS = {
  // For vLLM optimized inference (much lower than training)
  attention: 0.3,    // Attention weights and intermediate tensors
  mlp: 0.2,          // MLP activations
  layernorm: 0.05,   // Layer normalization
  residual: 0.1,     // Residual connections
  overhead: 0.15,    // Additional overhead for temporary computations
}

/**
 * Calculate activation memory for intermediate computations
 * @param {number} batchSize - Number of concurrent sequences
 * @param {number} seqLen - Sequence length being processed
 * @param {number} hiddenSize - Hidden dimension size
 * @param {number} numLayers - Number of transformer layers
 * @param {string} precision - Activation precision
 * @returns {number} Activation memory in GB
 */
export function calculateActivationMemory(
  batchSize,
  seqLen,
  hiddenSize,
  numLayers,
  precision = 'fp16'
) {
  // Validate inputs
  Validators.positiveNumber(batchSize, 'batchSize')
  Validators.positiveNumber(seqLen, 'seqLen')
  Validators.positiveNumber(hiddenSize, 'hiddenSize')
  Validators.positiveNumber(numLayers, 'numLayers')
  Validators.string(precision, 'precision')

  const precisionInfo = ACTIVATION_PRECISION_FORMATS[precision]
  if (!precisionInfo) {
    throw new Error(`Unsupported activation precision: ${precision}. Supported formats: ${Object.keys(ACTIVATION_PRECISION_FORMATS).join(', ')}`)
  }

  // Base activation memory calculation
  // This is much smaller for vLLM inference compared to training
  const baseActivationBytes = batchSize * seqLen * hiddenSize * numLayers * precisionInfo.bytes
  
  // Apply vLLM-specific efficiency multiplier (activations are much smaller in inference)
  const vllmEfficiencyMultiplier = 0.5
  const activationBytes = baseActivationBytes * vllmEfficiencyMultiplier
  
  return activationBytes / (1024 ** 3)
}

/**
 * Calculate detailed activation memory breakdown
 * @param {object} config - Configuration object
 * @param {number} config.batchSize - Number of concurrent sequences
 * @param {number} config.seqLen - Sequence length being processed
 * @param {number} config.hiddenSize - Hidden dimension size
 * @param {number} config.numLayers - Number of transformer layers
 * @param {number} config.numHeads - Number of attention heads
 * @param {string} config.precision - Activation precision
 * @param {boolean} config.includeBackward - Whether to include backward pass memory (training)
 * @returns {object} Detailed activation memory breakdown
 */
export function calculateActivationBreakdown(config) {
  Validators.object(config, ['batchSize', 'seqLen', 'hiddenSize', 'numLayers'], 'config')
  
  const {
    batchSize,
    seqLen,
    hiddenSize,
    numLayers,
    numHeads = hiddenSize / 64, // Default assumption
    precision = 'fp16',
    includeBackward = false // For inference, this is false
  } = config

  const precisionInfo = ACTIVATION_PRECISION_FORMATS[precision]
  if (!precisionInfo) {
    throw new Error(`Unsupported activation precision: ${precision}`)
  }

  const bytesPerElement = precisionInfo.bytes
  const baseElements = batchSize * seqLen * hiddenSize

  // Calculate different activation components
  const attentionMemory = baseElements * numLayers * ACTIVATION_MULTIPLIERS.attention * bytesPerElement
  const mlpMemory = baseElements * numLayers * ACTIVATION_MULTIPLIERS.mlp * bytesPerElement
  const layernormMemory = baseElements * numLayers * ACTIVATION_MULTIPLIERS.layernorm * bytesPerElement
  const residualMemory = baseElements * numLayers * ACTIVATION_MULTIPLIERS.residual * bytesPerElement
  const overheadMemory = baseElements * numLayers * ACTIVATION_MULTIPLIERS.overhead * bytesPerElement

  // Forward pass memory
  const forwardMemoryBytes = attentionMemory + mlpMemory + layernormMemory + residualMemory + overheadMemory
  
  // Backward pass memory (only for training)
  const backwardMemoryBytes = includeBackward ? forwardMemoryBytes * 2 : 0
  
  const totalMemoryBytes = forwardMemoryBytes + backwardMemoryBytes
  const totalMemoryGB = totalMemoryBytes / (1024 ** 3)

  return {
    totalMemoryGB: Math.round(totalMemoryGB * 1000) / 1000,
    breakdown: {
      forward: {
        attentionGB: Math.round((attentionMemory / (1024 ** 3)) * 1000) / 1000,
        mlpGB: Math.round((mlpMemory / (1024 ** 3)) * 1000) / 1000,
        layernormGB: Math.round((layernormMemory / (1024 ** 3)) * 1000) / 1000,
        residualGB: Math.round((residualMemory / (1024 ** 3)) * 1000) / 1000,
        overheadGB: Math.round((overheadMemory / (1024 ** 3)) * 1000) / 1000,
        totalForwardGB: Math.round((forwardMemoryBytes / (1024 ** 3)) * 1000) / 1000,
      },
      backward: includeBackward ? {
        totalBackwardGB: Math.round((backwardMemoryBytes / (1024 ** 3)) * 1000) / 1000,
      } : null,
    },
    config: {
      batchSize,
      seqLen,
      hiddenSize,
      numLayers,
      numHeads,
      precision,
      bytesPerElement,
      includeBackward,
    },
    perComponent: {
      perLayerGB: Math.round((totalMemoryGB / numLayers) * 1000) / 1000,
      perSequenceGB: Math.round((totalMemoryGB / batchSize) * 1000) / 1000,
      perTokenGB: Math.round((totalMemoryGB / (batchSize * seqLen)) * 1000000) / 1000000,
    }
  }
}

/**
 * Estimate activation memory scaling with batch size
 * @param {object} baseConfig - Base configuration
 * @param {number[]} batchSizes - Array of batch sizes to test
 * @returns {object[]} Array of activation memory calculations for different batch sizes
 */
export function calculateActivationScaling(baseConfig, batchSizes) {
  Validators.object(baseConfig, ['seqLen', 'hiddenSize', 'numLayers'], 'baseConfig')
  Validators.array(batchSizes, 'batchSizes')

  const { seqLen, hiddenSize, numLayers, precision = 'fp16' } = baseConfig

  return batchSizes.map(batchSize => {
    const memoryGB = calculateActivationMemory(batchSize, seqLen, hiddenSize, numLayers, precision)
    
    return {
      batchSize,
      activationMemoryGB: Math.round(memoryGB * 1000) / 1000,
      memoryPerSequence: Math.round((memoryGB / batchSize) * 1000) / 1000,
      memoryPerToken: Math.round((memoryGB / (batchSize * seqLen)) * 1000000) / 1000000,
    }
  })
}

/**
 * Calculate peak activation memory during different phases
 * @param {object} config - Configuration object
 * @returns {object} Peak memory usage during different phases
 */
export function calculatePeakActivationMemory(config) {
  const {
    batchSize,
    seqLen,
    hiddenSize,
    numLayers,
    precision = 'fp16',
    phase = 'inference' // 'inference' | 'training'
  } = config

  const baseMemory = calculateActivationMemory(batchSize, seqLen, hiddenSize, numLayers, precision)
  
  // Different phases have different memory patterns
  const phaseMultipliers = {
    inference: {
      prefill: 1.5,      // Higher memory during prefill
      decode: 0.3,       // Much lower during decode
      average: 1.0,      // Average across phases
    },
    training: {
      forward: 1.0,      // Forward pass
      backward: 2.5,     // Backward pass (higher)
      optimizer: 1.2,    // Optimizer step
      average: 1.6,      // Average across training
    }
  }

  const multipliers = phaseMultipliers[phase] || phaseMultipliers.inference

  return {
    phase,
    baseMemoryGB: Math.round(baseMemory * 1000) / 1000,
    peakMemory: {
      prefillGB: phase === 'inference' ? Math.round(baseMemory * multipliers.prefill * 1000) / 1000 : null,
      decodeGB: phase === 'inference' ? Math.round(baseMemory * multipliers.decode * 1000) / 1000 : null,
      forwardGB: phase === 'training' ? Math.round(baseMemory * multipliers.forward * 1000) / 1000 : null,
      backwardGB: phase === 'training' ? Math.round(baseMemory * multipliers.backward * 1000) / 1000 : null,
      optimizerGB: phase === 'training' ? Math.round(baseMemory * multipliers.optimizer * 1000) / 1000 : null,
      averageGB: Math.round(baseMemory * multipliers.average * 1000) / 1000,
    },
    recommendations: generateActivationMemoryRecommendations(baseMemory, config)
  }
}

/**
 * Generate recommendations for activation memory optimization
 * @param {number} baseMemoryGB - Base activation memory in GB
 * @param {object} config - Configuration object
 * @returns {string[]} Array of optimization recommendations
 */
function generateActivationMemoryRecommendations(baseMemoryGB, config) {
  const recommendations = []
  const { batchSize, seqLen, precision } = config

  if (baseMemoryGB > 10) {
    recommendations.push('High activation memory detected. Consider reducing batch size or sequence length.')
  }

  if (precision === 'fp32') {
    recommendations.push('Consider using fp16 or bf16 instead of fp32 to reduce activation memory by 50%.')
  }

  if (batchSize > 64) {
    recommendations.push('Large batch size increases activation memory. Consider gradient accumulation instead.')
  }

  if (seqLen > 4096) {
    recommendations.push('Long sequences require significant activation memory. Consider chunked processing.')
  }

  if (baseMemoryGB < 0.5) {
    recommendations.push('Low activation memory suggests efficient configuration for inference.')
  }

  return recommendations
}

/**
 * Optimize activation memory for specific use cases
 * @param {object} config - Current configuration
 * @param {string} optimizationTarget - 'memory' | 'speed' | 'balanced'
 * @returns {object} Optimized configuration and expected memory savings
 */
export function optimizeActivationMemory(config, optimizationTarget = 'balanced') {
  Validators.object(config, ['batchSize', 'seqLen', 'hiddenSize', 'numLayers'], 'config')
  Validators.string(optimizationTarget, 'optimizationTarget')

  const currentMemory = calculateActivationMemory(
    config.batchSize, 
    config.seqLen, 
    config.hiddenSize, 
    config.numLayers, 
    config.precision
  )

  const optimizations = {
    memory: {
      precision: 'fp16',
      batchSizeMultiplier: 0.7,
      description: 'Minimize memory usage'
    },
    speed: {
      precision: config.precision || 'fp16',
      batchSizeMultiplier: 1.0,
      description: 'Maintain speed, moderate memory usage'
    },
    balanced: {
      precision: 'fp16',
      batchSizeMultiplier: 0.85,
      description: 'Balance between memory and performance'
    }
  }

  const optimization = optimizations[optimizationTarget] || optimizations.balanced
  
  const optimizedConfig = {
    ...config,
    precision: optimization.precision,
    batchSize: Math.max(1, Math.floor(config.batchSize * optimization.batchSizeMultiplier))
  }

  const optimizedMemory = calculateActivationMemory(
    optimizedConfig.batchSize,
    optimizedConfig.seqLen,
    optimizedConfig.hiddenSize,
    optimizedConfig.numLayers,
    optimizedConfig.precision
  )

  const memorySavings = currentMemory - optimizedMemory
  const savingsPercent = (memorySavings / currentMemory) * 100

  return {
    original: {
      config,
      memoryGB: Math.round(currentMemory * 1000) / 1000
    },
    optimized: {
      config: optimizedConfig,
      memoryGB: Math.round(optimizedMemory * 1000) / 1000
    },
    savings: {
      memoryGB: Math.round(memorySavings * 1000) / 1000,
      percentage: Math.round(savingsPercent * 10) / 10
    },
    optimizationTarget,
    description: optimization.description
  }
}

/**
 * Get supported activation precision formats
 * @returns {object} Object containing supported formats and their details
 */
export function getSupportedActivationPrecisions() {
  return { ...ACTIVATION_PRECISION_FORMATS }
}

export { ACTIVATION_PRECISION_FORMATS, ACTIVATION_MULTIPLIERS }
