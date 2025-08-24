/**
 * vLLM Memory Calculation Engine
 * 
 * This module implements accurate memory calculations for vLLM based on:
 * - Model weights memory
 * - KV cache memory 
 * - Activation memory
 * - System overhead
 * - Quantization effects
 * 
 * References:
 * - vLLM documentation: https://docs.vllm.ai/en/latest/
 * - Memory optimization paper: https://arxiv.org/abs/2309.06180
 */

/**
 * Quantization formats supported by vLLM and their characteristics
 */
const QUANTIZATION_FORMATS = {
  // Standard precision formats
  fp32: {
    bitsPerParam: 32,
    bytesPerParam: 4,
    memoryEfficiency: 1.0,
    qualityLoss: 0.0,
    description: 'Full precision floating point',
  },
  fp16: {
    bitsPerParam: 16,
    bytesPerParam: 2,
    memoryEfficiency: 0.5,
    qualityLoss: 0.01,
    description: 'Half precision floating point',
  },
  bf16: {
    bitsPerParam: 16,
    bytesPerParam: 2,
    memoryEfficiency: 0.5,
    qualityLoss: 0.005,
    description: 'Brain floating point 16',
  },
  
  // Integer quantization
  int8: {
    bitsPerParam: 8,
    bytesPerParam: 1,
    memoryEfficiency: 0.25,
    qualityLoss: 0.02,
    description: 'Dynamic 8-bit integer quantization',
  },
  int4: {
    bitsPerParam: 4,
    bytesPerParam: 0.5,
    memoryEfficiency: 0.125,
    qualityLoss: 0.05,
    description: 'Static 4-bit integer quantization',
  },
  
  // Advanced quantization schemes
  awq: {
    bitsPerParam: 4,
    bytesPerParam: 0.5,
    memoryEfficiency: 0.125,
    qualityLoss: 0.03,
    description: 'Activation-aware Weight Quantization (4-bit)',
    overhead: 0.02, // Small overhead for activation statistics
  },
  gptq: {
    bitsPerParam: 4,
    bytesPerParam: 0.5,
    memoryEfficiency: 0.125,
    qualityLoss: 0.04,
    description: 'GPTQ post-training quantization (4-bit)',
    overhead: 0.01, // Minimal overhead
  },
  ggml: {
    bitsPerParam: 4,
    bytesPerParam: 0.5,
    memoryEfficiency: 0.125,
    qualityLoss: 0.06,
    description: 'GGML quantization format',
    overhead: 0.015,
  },
  
  // Mixed precision formats
  'awq-gemm': {
    bitsPerParam: 4,
    bytesPerParam: 0.5,
    memoryEfficiency: 0.125,
    qualityLoss: 0.025,
    description: 'AWQ with optimized GEMM kernels',
    overhead: 0.03,
  },
  'gptq-exllama': {
    bitsPerParam: 4,
    bytesPerParam: 0.5,
    memoryEfficiency: 0.125,
    qualityLoss: 0.035,
    description: 'GPTQ with ExLlama acceleration',
    overhead: 0.025,
  },
}

/**
 * Calculate quantization factor for a given format
 * @param {string} format - Quantization format (e.g., 'fp16', 'awq', 'gptq')
 * @param {object} options - Additional options
 * @param {boolean} options.includeOverhead - Whether to include format-specific overhead
 * @returns {object} Quantization information including memory factor and quality impact
 */
export function calculateQuantizationFactor(format, options = {}) {
  const { includeOverhead = true } = options
  
  const quantInfo = QUANTIZATION_FORMATS[format.toLowerCase()]
  if (!quantInfo) {
    throw new Error(`Unsupported quantization format: ${format}`)
  }
  
  let memoryFactor = quantInfo.memoryEfficiency
  
  // Add overhead if applicable and requested
  if (includeOverhead && quantInfo.overhead) {
    memoryFactor += quantInfo.overhead
  }
  
  return {
    format: format.toLowerCase(),
    bitsPerParam: quantInfo.bitsPerParam,
    bytesPerParam: quantInfo.bytesPerParam,
    memoryFactor: Math.round(memoryFactor * 1000) / 1000, // Round to 3 decimal places
    qualityLoss: quantInfo.qualityLoss,
    description: quantInfo.description,
    overhead: quantInfo.overhead || 0,
  }
}

/**
 * Get all supported quantization formats
 * @returns {Array} Array of supported format names
 */
export function getSupportedQuantizationFormats() {
  return Object.keys(QUANTIZATION_FORMATS)
}

/**
 * Compare quantization formats
 * @param {Array<string>} formats - Array of format names to compare
 * @returns {Array} Array of quantization info objects sorted by memory efficiency
 */
export function compareQuantizationFormats(formats) {
  const comparisons = formats.map(format => calculateQuantizationFactor(format))
  
  // Sort by memory efficiency (lower memory usage first)
  return comparisons.sort((a, b) => a.memoryFactor - b.memoryFactor)
}

/**
 * Estimate quality degradation for quantization
 * @param {string} format - Quantization format
 * @param {number} modelSize - Model size in billions of parameters
 * @returns {object} Quality impact estimation
 */
export function estimateQuantizationQualityImpact(format, modelSize) {
  const quantInfo = calculateQuantizationFactor(format)
  
  // Larger models generally handle quantization better
  const sizeAdjustment = Math.max(0.5, Math.min(1.0, modelSize / 7)) // Normalize around 7B
  const adjustedQualityLoss = quantInfo.qualityLoss * (2 - sizeAdjustment)
  
  let impactLevel = 'minimal'
  if (adjustedQualityLoss > 0.05) impactLevel = 'high'
  else if (adjustedQualityLoss > 0.02) impactLevel = 'moderate'
  else if (adjustedQualityLoss > 0.01) impactLevel = 'low'
  
  return {
    format: quantInfo.format,
    qualityLoss: Math.round(adjustedQualityLoss * 1000) / 1000,
    impactLevel,
    memorySavings: Math.round((1 - quantInfo.memoryFactor) * 100),
    recommendation: generateQuantizationRecommendationText(quantInfo, modelSize),
  }
}

/**
 * Generate quantization recommendation text based on format and model size
 * @param {object} quantInfo - Quantization information
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
 * Generate quantization recommendation based on available VRAM and model size
 * @param {number} vramGB - Available VRAM in GB
 * @param {number} modelParams - Model size in billions of parameters
 * @param {object} options - Additional options
 * @returns {object} Recommendation including format, feasibility, and reasoning
 */
export function generateQuantizationRecommendation(vramGB, modelParams, options = {}) {
  const { batchSize = 1, maxSeqLen = 2048, includeKVCache = true } = options
  
  // Try different quantization formats in order of preference
  const formatPriority = ['fp16', 'awq', 'gptq', 'int8', 'int4']
  
  for (const format of formatPriority) {
    try {
      // Calculate total memory usage with this quantization
      const modelWeights = calculateModelWeightsMemory(modelParams, format)
      let totalMemory = modelWeights.totalMemory
      
      if (includeKVCache) {
        // Add estimated KV cache and activations
        const estimatedArch = estimateModelArchitecture(modelParams)
        const kvCache = calculateKVCacheMemory(batchSize, maxSeqLen, estimatedArch.layers, estimatedArch.hiddenSize, estimatedArch.numHeads, format)
        const activations = calculateActivationMemory(batchSize, maxSeqLen, estimatedArch.hiddenSize, estimatedArch.layers)
        const systemOverhead = calculateSystemOverhead(modelWeights.totalMemory, batchSize)
        
        totalMemory += kvCache + activations + systemOverhead
      }
      
      if (totalMemory <= vramGB * 0.9) { // 90% utilization max
        const memoryUtilization = Math.round((totalMemory / vramGB) * 100)
        
        let reason = ''
        if (format === 'fp16') {
          reason = `Sufficient VRAM available (${memoryUtilization}% utilization). Recommended for best quality.`
        } else {
          reason = `Limited VRAM requires quantization (${memoryUtilization}% utilization). ${format.toUpperCase()} provides good balance.`
        }
        
        return {
          recommendedFormat: format,
          canFit: true,
          memoryUsageGB: Math.round(totalMemory * 1000) / 1000,
          memoryUtilizationPercent: memoryUtilization,
          reason: reason,
          qualityImpact: QUANTIZATION_FORMATS[format]?.qualityLoss || 0,
        }
      }
    } catch {
      // Skip this format if calculation fails
      continue
    }
  }
  
  // If no format fits, return recommendation with lowest memory usage
  const minFormat = formatPriority[formatPriority.length - 1]
  const modelWeights = calculateModelWeightsMemory(modelParams, minFormat)
  
  return {
    recommendedFormat: minFormat,
    canFit: false,
    memoryUsageGB: Math.round(modelWeights.totalMemory * 1000) / 1000,
    memoryUtilizationPercent: Math.round((modelWeights.totalMemory / vramGB) * 100),
    reason: `Model too large for available VRAM even with maximum quantization. Consider model parallelism or larger GPU.`,
    qualityImpact: QUANTIZATION_FORMATS[minFormat]?.qualityLoss || 0,
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
  if (numParams <= 0) {
    throw new Error('Number of parameters must be positive')
  }

  const quantInfo = calculateQuantizationFactor(quantization, options)
  
  // Base memory for weights
  const baseMemoryGB = numParams * quantInfo.bytesPerParam
  
  // Additional overhead for quantization metadata (scales, zeros, etc.)
  const overheadGB = quantInfo.overhead ? numParams * quantInfo.overhead : 0
  
  const totalMemoryGB = baseMemoryGB + overheadGB

  return {
    baseMemory: Math.round(baseMemoryGB * 1000) / 1000,
    overhead: Math.round(overheadGB * 1000) / 1000,
    totalMemory: Math.round(totalMemoryGB * 1000) / 1000,
    quantization: quantInfo,
    memorySavingsPercent: Math.round((1 - quantInfo.memoryFactor) * 100),
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use calculateModelWeightsMemory with quantization parameter instead
 */
export function calculateModelWeightsMemoryLegacy(numParams, precision = 'fp16') {
  if (numParams <= 0) {
    throw new Error('Number of parameters must be positive')
  }

  const bytesPerParam = {
    fp32: 4,
    fp16: 2,
    bf16: 2,
    int8: 1,
    int4: 0.5,
    int3: 0.375,
    int2: 0.25,
  }

  const bytes = bytesPerParam[precision]
  if (!bytes) {
    throw new Error(`Unsupported precision: ${precision}`)
  }

  // Convert from billions of parameters to GB
  return numParams * bytes
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
  if (batchSize <= 0 || maxSeqLen <= 0 || numLayers <= 0 || hiddenSize <= 0 || numHeads <= 0) {
    throw new Error('All parameters must be positive')
  }

  const bytesPerElement = {
    fp32: 4,
    fp16: 2,
    bf16: 2,
    int8: 1,
  }

  const bytes = bytesPerElement[kvPrecision]
  if (!bytes) {
    throw new Error(`Unsupported KV precision: ${kvPrecision}`)
  }

  // KV cache: 2 (K and V) × batch_size × seq_len × num_layers × hidden_size × bytes_per_element
  const kvCacheBytes = 2 * batchSize * maxSeqLen * numLayers * hiddenSize * bytes
  
  // Convert bytes to GB
  return kvCacheBytes / (1024 ** 3)
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
  if (batchSize <= 0 || seqLen <= 0 || hiddenSize <= 0 || numLayers <= 0) {
    throw new Error('All parameters must be positive')
  }

  const bytesPerElement = {
    fp32: 4,
    fp16: 2,
    bf16: 2,
  }

  const bytes = bytesPerElement[precision] || 2

  // Approximate activation memory for forward pass
  // This includes attention weights, MLP activations, etc.
  const activationBytes = batchSize * seqLen * hiddenSize * numLayers * bytes * 12 // Multiplier for various activations
  
  return activationBytes / (1024 ** 3)
}

/**
 * Calculate system overhead for vLLM runtime
 * @param {number} modelMemoryGB - Model memory usage in GB
 * @param {number} batchSize - Batch size
 * @returns {number} System overhead in GB
 */
export function calculateSystemOverhead(modelMemoryGB, batchSize = 1) {
  // Base system overhead for vLLM runtime
  const baseOverheadGB = 0.5
  
  // Additional overhead scales with model size and batch size
  const modelOverhead = modelMemoryGB * 0.05 // 5% of model size
  const batchOverhead = (batchSize - 1) * 0.1 // Additional overhead per batch item
  
  return baseOverheadGB + modelOverhead + batchOverhead
}

/**
 * Estimate model architecture parameters from parameter count
 * @param {number} numParams - Number of parameters in billions
 * @returns {object} Estimated architecture parameters
 */
export function estimateModelArchitecture(numParams) {
  // Common transformer architectures - these are approximations
  const architectures = {
    0.5: { layers: 12, hiddenSize: 768, numHeads: 12 },    // Small model
    1: { layers: 16, hiddenSize: 1024, numHeads: 16 },     // 1B model
    3: { layers: 24, hiddenSize: 1536, numHeads: 24 },     // 3B model  
    7: { layers: 32, hiddenSize: 4096, numHeads: 32 },     // 7B model (Llama-2 7B)
    13: { layers: 40, hiddenSize: 5120, numHeads: 40 },    // 13B model (Llama-2 13B)
    30: { layers: 60, hiddenSize: 6656, numHeads: 52 },    // 30B model
    65: { layers: 80, hiddenSize: 8192, numHeads: 64 },    // 65B model (Llama-2 70B)
    175: { layers: 96, hiddenSize: 12288, numHeads: 96 },  // 175B model (GPT-3)
  }

  // Find closest architecture
  const sizes = Object.keys(architectures).map(Number).sort((a, b) => a - b)
  let closestSize = sizes[0]
  
  for (const size of sizes) {
    if (Math.abs(size - numParams) < Math.abs(closestSize - numParams)) {
      closestSize = size
    }
  }

  return architectures[closestSize]
}

/**
 * Calculate total vLLM memory usage
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

  if (!modelSizeGB && !numParams) {
    throw new Error('Either modelSizeGB or numParams must be provided')
  }

  // Use provided architecture or estimate from parameters
  const arch = architecture || estimateModelArchitecture(numParams || (modelSizeGB / 2)) // Rough estimate: 2GB per billion params for fp16

  // Calculate individual components
  const modelWeightsResult = modelSizeGB 
    ? { totalMemory: modelSizeGB, baseMemory: modelSizeGB, overhead: 0 }
    : calculateModelWeightsMemory(numParams, modelPrecision)
  
  const modelWeights = modelWeightsResult.totalMemory || modelWeightsResult
  
  const kvCache = calculateKVCacheMemory(
    batchSize,
    maxSeqLen,
    arch.layers,
    arch.hiddenSize,
    arch.numHeads,
    kvCachePrecision
  )
  const activations = calculateActivationMemory(
    batchSize,
    seqLen,
    arch.hiddenSize,
    arch.layers,
    modelPrecision
  )

  // System overhead (includes fragmentation, cuda context, etc.)
  const systemOverhead = Math.max(1.0, (modelWeights + kvCache + activations) * 0.1)

  // Total memory
  const totalMemory = modelWeights + kvCache + activations + systemOverhead

  return {
    modelWeights: Math.round(modelWeights * 1000) / 1000,
    kvCache: Math.round(kvCache * 1000) / 1000,
    activations: Math.round(activations * 1000) / 1000,
    systemOverhead: Math.round(systemOverhead * 1000) / 1000,
    totalMemory: Math.round(totalMemory * 1000) / 1000,
    quantization: modelWeightsResult.quantization || null,
    breakdown: {
      modelWeightsPercent: Math.round((modelWeights / totalMemory) * 100),
      kvCachePercent: Math.round((kvCache / totalMemory) * 100),
      activationsPercent: Math.round((activations / totalMemory) * 100),
      systemOverheadPercent: Math.round((systemOverhead / totalMemory) * 100),
    }
  }
}

// Legacy functions for backward compatibility
/**
 * Calculate VRAM usage for a model with given parameters (legacy)
 * @deprecated Use calculateVLLMMemoryUsage instead
 */
export function calculateVRAMUsage(
  modelSizeGB,
  quantizationFactor = 1,
  batchSize = 1,
  sequenceLength = 2048,
  overheadFactor = 1.2
) {
  if (modelSizeGB <= 0) {
    throw new Error('Model size must be positive')
  }

  const baseMemory = modelSizeGB * quantizationFactor
  const activationMemory = batchSize * sequenceLength * 0.001 // Simplified calculation
  const totalMemory = (baseMemory + activationMemory) * overheadFactor

  return Math.round(totalMemory * 100) / 100 // Round to 2 decimal places
}

/**
 * Check if a GPU has enough VRAM for a given configuration
 * @param {number} gpuVRAM - GPU VRAM in GB
 * @param {number} requiredVRAM - Required VRAM in GB
 * @returns {boolean} Whether GPU has enough VRAM
 */
export function canRunOnGPU(gpuVRAM, requiredVRAM) {
  return gpuVRAM >= requiredVRAM
}
