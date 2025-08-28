/**
 * Quantization Module
 * 
 * This module provides comprehensive quantization support for vLLM models,
 * including format definitions, memory calculations, quality analysis,
 * and recommendations.
 * 
 * Key Features:
 * - Support for all major quantization formats (FP16, AWQ, GPTQ, etc.)
 * - Memory efficiency calculations
 * - Quality impact analysis
 * - Quantization recommendations based on VRAM constraints
 */

// Import validation utilities from main module
// Import validation utilities
import { Validators, VLLMValidators, ValidationError } from './validation.js'

/**
 * Quantization formats supported by vLLM and their characteristics
 */
const QUANTIZATION_FORMATS = {
  // Full precision
  fp32: {
    bitsPerParam: 32,
    bytesPerParam: 4.0,
    memoryEfficiency: 1.0,
    qualityLoss: 0.0,
    description: 'Full 32-bit floating point precision',
    overhead: 0.0
  },
  
  // Half precision  
  fp16: {
    bitsPerParam: 16,
    bytesPerParam: 2.0,
    memoryEfficiency: 0.5,
    qualityLoss: 0.02,
    description: '16-bit floating point (recommended default)',
    overhead: 0.0
  },
  
  bf16: {
    bitsPerParam: 16,
    bytesPerParam: 2.0,
    memoryEfficiency: 0.5,
    qualityLoss: 0.01,
    description: 'Brain Float 16 (better numerical stability than fp16)',
    overhead: 0.0
  },
  
  // Integer quantization
  int8: {
    bitsPerParam: 8,
    bytesPerParam: 1.0,
    memoryEfficiency: 0.25,
    qualityLoss: 0.05,
    description: 'Dynamic 8-bit integer quantization',
    overhead: 0.02
  },
  
  int4: {
    bitsPerParam: 4,
    bytesPerParam: 0.5,
    memoryEfficiency: 0.125,
    qualityLoss: 0.15,
    description: 'Static 4-bit integer quantization',
    overhead: 0.03
  },
  
  // Advanced quantization schemes
  awq: {
    bitsPerParam: 4,
    bytesPerParam: 0.5,
    memoryEfficiency: 0.125,
    qualityLoss: 0.03,
    description: 'Activation-aware Weight Quantization (4-bit)',
    overhead: 0.01,
    groupSize: 128,
    recommendedForSize: '7B+'
  },
  
  gptq: {
    bitsPerParam: 4,
    bytesPerParam: 0.5,
    memoryEfficiency: 0.125,
    qualityLoss: 0.05,
    description: 'GPTQ post-training quantization (4-bit)',
    overhead: 0.02,
    groupSize: 32,
    recommendedForSize: '3B+'
  },
  
  ggml: {
    bitsPerParam: 4,
    bytesPerParam: 0.5,
    memoryEfficiency: 0.125,
    qualityLoss: 0.08,
    description: 'GGML quantization format',
    overhead: 0.02
  }
}

/**
 * Calculate quantization factor and efficiency metrics
 * @param {string} format - Quantization format (e.g., 'fp16', 'awq', 'gptq')
 * @param {object} options - Additional options
 * @param {boolean} options.includeOverhead - Whether to include format-specific overhead
 * @returns {object} Quantization information including memory factor and quality impact
 */
export function calculateQuantizationFactor(format, options = {}) {
  // Validate inputs
  const normalizedFormat = VLLMValidators.quantizationFormat(format)
  Validators.object(options, [], 'options')
  
  const { includeOverhead = true } = options
  
  const quantInfo = QUANTIZATION_FORMATS[normalizedFormat]
  
  let memoryFactor = quantInfo.memoryEfficiency
  
  // Add overhead if applicable and requested
  if (includeOverhead && quantInfo.overhead) {
    memoryFactor += quantInfo.overhead
  }
  
  return {
    format: normalizedFormat,
    bitsPerParam: quantInfo.bitsPerParam,
    bytesPerParam: quantInfo.bytesPerParam,
    memoryFactor: Math.round(memoryFactor * 1000) / 1000, // Round to 3 decimal places
    qualityLoss: quantInfo.qualityLoss,
    description: quantInfo.description,
    overhead: quantInfo.overhead || 0,
  }
}

/**
 * Get list of all supported quantization formats
 * @returns {Array<string>} Array of supported format names
 */
export function getSupportedQuantizationFormats() {
  return Object.keys(QUANTIZATION_FORMATS)
}

/**
 * Compare memory efficiency of different quantization formats
 * @param {Array<string>} formats - Array of quantization formats to compare
 * @returns {Array<object>} Sorted array of formats by memory efficiency (best first)
 */
export function compareQuantizationFormats(formats) {
  Validators.array(formats, 'formats')
  
  const comparisons = formats.map(format => calculateQuantizationFactor(format))
  
  // Sort by memory efficiency (lower is better = more memory savings)
  return comparisons.sort((a, b) => a.memoryFactor - b.memoryFactor)
}

/**
 * Estimate quality impact for a given quantization format and model size
 * @param {string} format - Quantization format
 * @param {number} modelSize - Model size in billions of parameters
 * @returns {object} Quality impact analysis
 */
export function estimateQuantizationQualityImpact(format, modelSize) {
  Validators.positiveNumber(modelSize, 'modelSize')
  const quantInfo = calculateQuantizationFactor(format)
  
  // Larger models generally handle quantization better
  const sizeMultiplier = modelSize >= 7 ? 0.8 : 1.2
  const adjustedQualityLoss = quantInfo.qualityLoss * sizeMultiplier
  
  let severity = 'low'
  if (adjustedQualityLoss > 0.1) severity = 'high'
  else if (adjustedQualityLoss > 0.05) severity = 'medium'
  
  return {
    format: quantInfo.format,
    qualityLoss: Math.round(adjustedQualityLoss * 100) / 100,
    severity,
    description: quantInfo.description,
    recommendation: generateQuantizationRecommendationText(quantInfo, modelSize)
  }
}

/**
 * Generate quantization recommendation text based on format and model
 * @param {object} quantInfo - Quantization information object
 * @param {number} modelSize - Model size in billions of parameters
 * @returns {string} Recommendation text
 */
function generateQuantizationRecommendationText(quantInfo, modelSize) {
  const memorySavings = (1 - quantInfo.memoryFactor) * 100
  
  if (quantInfo.format === 'fp32') {
    return 'Use only for research or when maximum precision is required'
  }
  
  if (quantInfo.format === 'fp16' || quantInfo.format === 'bf16') {
    return 'Recommended for most production deployments with good balance of speed and quality'
  }
  
  if (quantInfo.format.includes('awq')) {
    return `Excellent for ${modelSize >= 7 ? 'large' : 'smaller'} models, ~${memorySavings.toFixed(0)}% memory savings with minimal quality loss`
  }
  
  if (quantInfo.format.includes('gptq')) {
    return `Good for memory-constrained environments, ${memorySavings.toFixed(0)}% memory reduction`
  }
  
  if (quantInfo.format === 'int8') {
    return 'Use when memory is very limited, may impact quality on smaller models'
  }
  
  if (quantInfo.format === 'int4') {
    return 'Extreme memory savings but significant quality trade-offs for most models'
  }
  
  return `${memorySavings.toFixed(0)}% memory savings - evaluate quality trade-offs for your use case`
}

/**
 * Generate quantization recommendation based on available VRAM and model requirements
 * @param {number} vramGB - Available VRAM in GB
 * @param {number} modelParams - Model size in billions of parameters
 * @param {object} options - Additional options
 * @param {number} options.batchSize - Target batch size (default: 1)
 * @param {number} options.maxSeqLen - Maximum sequence length (default: 2048)
 * @param {string} options.priority - 'quality' | 'memory' | 'balanced' (default: 'balanced')
 * @returns {object} Quantization recommendation with format and rationale
 */
export function generateQuantizationRecommendation(vramGB, modelParams, options = {}) {
  Validators.positiveNumber(vramGB, 'vramGB')
  Validators.positiveNumber(modelParams, 'modelParams')
  Validators.object(options, [], 'options')
  
  const { batchSize = 1, maxSeqLen = 2048, priority = 'balanced' } = options
  
  // Test quantization formats in order of preference
  const formatOrder = priority === 'quality' 
    ? ['fp16', 'bf16', 'awq', 'gptq', 'int8', 'int4']
    : priority === 'memory'
    ? ['int4', 'awq', 'gptq', 'int8', 'fp16', 'bf16']
    : ['fp16', 'awq', 'bf16', 'gptq', 'int8', 'int4'] // balanced
  
  for (const format of formatOrder) {
    const quantInfo = calculateQuantizationFactor(format)
    const modelWeights = calculateModelWeightsMemory(modelParams, format)
    
    // Estimate total memory usage (rough approximation)
    const kvCacheMemory = (batchSize * maxSeqLen * modelParams * 2 * 2) / (1024 * 1024 * 1024) // Rough KV cache
    const activationMemory = batchSize * 0.5 // Rough activation memory
    const totalMemory = modelWeights.totalMemory + kvCacheMemory + activationMemory
    
    if (totalMemory <= vramGB * 0.9) { // Leave 10% headroom
      return {
        recommendedFormat: format,
        canFit: true,
        memoryUsageGB: Math.round(totalMemory * 100) / 100,
        memoryUtilizationPercent: Math.round((totalMemory / vramGB) * 100),
        reason: generateQuantizationRecommendationText(quantInfo, modelParams),
        qualityImpact: estimateQuantizationQualityImpact(format, modelParams),
        breakdown: {
          modelWeights: modelWeights.totalMemory,
          kvCache: Math.round(kvCacheMemory * 100) / 100,
          activations: activationMemory
        }
      }
    }
  }
  
  // If no format fits, recommend the most aggressive quantization
  const minFormat = 'int4'
  const quantInfo = calculateQuantizationFactor(minFormat)
  const modelWeights = calculateModelWeightsMemory(modelParams, minFormat)
  
  return {
    recommendedFormat: minFormat,
    canFit: false,
    memoryUsageGB: Math.round(modelWeights.totalMemory * 1000) / 1000,
    memoryUtilizationPercent: Math.round((modelWeights.totalMemory / vramGB) * 100),
    reason: `Model too large for available VRAM even with maximum quantization. Consider model parallelism or larger GPU.`,
    qualityImpact: estimateQuantizationQualityImpact(minFormat, modelParams),
  }
}

/**
 * Calculate model weights memory usage with quantization support
 * @param {number} numParams - Number of parameters in billions (e.g., 7 for 7B)
 * @param {string} quantization - Quantization format ('fp16', 'awq', 'gptq', etc.)
 * @param {object} options - Additional options
 * @param {boolean} options.includeOverhead - Include quantization overhead
 * @returns {object} Model weights memory info including total GB and breakdown
 */
export function calculateModelWeightsMemory(numParams, quantization = 'fp16', options = {}) {
  // Validate inputs
  Validators.positiveNumber(numParams, 'numParams')
  const normalizedQuantization = VLLMValidators.quantizationFormat(quantization)
  Validators.object(options, [], 'options')

  const quantInfo = calculateQuantizationFactor(normalizedQuantization, options)
  
  // Base memory calculation: 
  // If numParams <= 1000, assume it's in billions (e.g., 7 means 7B)
  // If numParams > 1000, assume it's raw parameter count (e.g., 7000000000)
  const actualParams = numParams <= 1000 ? numParams * 1e9 : numParams
  const baseMemoryBytes = actualParams * quantInfo.bytesPerParam
  const baseMemoryGB = baseMemoryBytes / 1e9  // Convert bytes to GB
  
  // Add overhead if applicable
  const overheadGB = options.includeOverhead !== false ? baseMemoryGB * quantInfo.overhead : 0
  
  const totalMemoryGB = baseMemoryGB + overheadGB
  
  return {
    numParams,
    quantization: normalizedQuantization,
    baseMemoryGB: Math.round(baseMemoryGB * 1000) / 1000,
    overheadGB: Math.round(overheadGB * 1000) / 1000,
    totalMemory: Math.round(totalMemoryGB * 1000) / 1000,
    memoryFactor: quantInfo.memoryFactor,
    bitsPerParam: quantInfo.bitsPerParam,
    description: quantInfo.description
  }
}

// Export quantization formats for use by other modules
export { QUANTIZATION_FORMATS }
