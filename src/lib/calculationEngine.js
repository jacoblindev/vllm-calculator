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

// ================================
// THROUGHPUT OPTIMIZATION FUNCTIONS
// ================================

/**
 * Optimal batch size configuration for throughput
 * Based on vLLM documentation for max_num_seqs and max_num_batched_tokens
 */
const THROUGHPUT_OPTIMIZATION_CONFIGS = {
  // Default values for different scenarios
  cpu: {
    maxNumSeqsOffline: 256, // Default for offline inference
    maxNumSeqsOnline: 128, // Default for online serving
    maxNumBatchedTokensOffline: 4096, // Default for offline inference
    maxNumBatchedTokensOnline: 2048, // Default for online serving
  },
  gpu: {
    // For optimal throughput, especially with smaller models on large GPUs
    maxNumBatchedTokensOptimal: 8192, // Recommended for throughput
    maxNumSeqsOptimal: 256, // Higher seq count for better batching
  },
  
  // Memory utilization for throughput (higher than default)
  gpuMemoryUtilization: {
    conservative: 0.85,
    balanced: 0.90,
    aggressive: 0.95,
  },
  
  // Block sizes for KV cache
  blockSizes: [16, 32], // Typical values
  
  // Chunked prefill thresholds
  chunkedPrefillThreshold: 8192, // Enable for sequences longer than this
}

/**
 * Calculate optimal batch size for maximum throughput
 * @param {object} config - Configuration parameters
 * @param {number} config.availableMemoryGB - Available GPU memory in GB
 * @param {number} config.modelMemoryGB - Model memory usage in GB
 * @param {number} config.maxSequenceLength - Maximum sequence length
 * @param {number} config.averageSequenceLength - Average expected sequence length
 * @param {object} config.architecture - Model architecture info
 * @returns {object} Optimal batch configuration
 */
export function calculateOptimalBatchSize(config) {
  const {
    availableMemoryGB,
    modelMemoryGB,
    maxSequenceLength = 2048,
    averageSequenceLength = 512,
    architecture,
  } = config

  if (availableMemoryGB <= modelMemoryGB) {
    throw new Error('Available memory must be greater than model memory')
  }

  const remainingMemoryGB = availableMemoryGB - modelMemoryGB
  
  // Calculate KV cache memory per sequence
  const kvCachePerSeqGB = calculateKVCacheMemory(
    1, // single sequence
    maxSequenceLength,
    architecture.layers,
    architecture.hiddenSize,
    architecture.numHeads,
    'fp16' // Assume FP16 for throughput optimization
  )
  
  // Calculate activation memory per token (approximate)
  const activationPerTokenGB = calculateActivationMemory(1, 1, architecture.hiddenSize, architecture.layers)
  
  // Estimate maximum number of sequences that can fit
  const maxNumSeqs = Math.floor(remainingMemoryGB / (kvCachePerSeqGB + activationPerTokenGB * averageSequenceLength))
  
  // Calculate optimal max_num_batched_tokens
  // For throughput, we want to process as many tokens as possible in parallel
  const optimalBatchedTokens = Math.min(
    maxNumSeqs * averageSequenceLength,
    THROUGHPUT_OPTIMIZATION_CONFIGS.gpu.maxNumBatchedTokensOptimal,
    remainingMemoryGB * 1024 * 1024 * 1024 / (4 * architecture.hiddenSize) // Rough estimation based on computation
  )
  
  return {
    maxNumSeqs: Math.min(maxNumSeqs, THROUGHPUT_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsOptimal),
    maxNumBatchedTokens: Math.floor(optimalBatchedTokens),
    kvCacheMemoryGB: kvCachePerSeqGB * maxNumSeqs,
    activationMemoryGB: activationPerTokenGB * optimalBatchedTokens,
    memoryUtilization: ((modelMemoryGB + kvCachePerSeqGB * maxNumSeqs) / availableMemoryGB),
    reasoning: {
      availableForBatching: remainingMemoryGB,
      kvCachePerSeq: kvCachePerSeqGB,
      maxSequencesEstimate: maxNumSeqs,
      targetBatchedTokens: optimalBatchedTokens,
    }
  }
}

/**
 * Calculate optimal memory allocation strategy for throughput
 * @param {object} config - Configuration parameters
 * @param {number} config.totalVRAMGB - Total GPU VRAM
 * @param {number} config.modelSizeGB - Model size
 * @param {number} config.targetBatchSize - Desired batch size
 * @param {string} config.workloadType - 'serving' | 'batch' | 'mixed'
 * @returns {object} Memory allocation strategy
 */
export function calculateMemoryAllocationStrategy(config) {
  const {
    totalVRAMGB,
    modelSizeGB,
    workloadType = 'serving'
  } = config

  if (totalVRAMGB <= modelSizeGB) {
    throw new Error('Total VRAM must be greater than model size')
  }

  // Choose GPU memory utilization based on workload
  let gpuMemoryUtilization
  let swapSpaceGB
  
  switch (workloadType) {
    case 'batch':
      // Batch processing can use more aggressive memory settings
      gpuMemoryUtilization = THROUGHPUT_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.aggressive
      swapSpaceGB = Math.min(16, totalVRAMGB * 0.5) // Up to 16GB or 50% of VRAM
      break
    case 'serving':
      // Serving needs some headroom for request spikes
      gpuMemoryUtilization = THROUGHPUT_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.balanced
      swapSpaceGB = Math.min(8, totalVRAMGB * 0.25) // Up to 8GB or 25% of VRAM
      break
    default: // mixed
      gpuMemoryUtilization = THROUGHPUT_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.conservative
      swapSpaceGB = Math.min(4, totalVRAMGB * 0.15) // Up to 4GB or 15% of VRAM
  }

  const allocatedVRAMGB = totalVRAMGB * gpuMemoryUtilization
  const kvCacheAllocationGB = allocatedVRAMGB - modelSizeGB
  const reservedMemoryGB = totalVRAMGB - allocatedVRAMGB

  return {
    gpuMemoryUtilization,
    swapSpaceGB,
    allocatedVRAMGB,
    kvCacheAllocationGB,
    reservedMemoryGB,
    recommendedBlockSize: kvCacheAllocationGB > 8 ? 32 : 16, // Larger blocks for more memory
    enableChunkedPrefill: kvCacheAllocationGB > 4, // Enable if we have enough memory
    workloadOptimization: workloadType,
    memoryBreakdown: {
      model: modelSizeGB,
      kvCache: kvCacheAllocationGB,
      reserved: reservedMemoryGB,
      swap: swapSpaceGB,
    }
  }
}

/**
 * Estimate throughput metrics for a given configuration
 * @param {object} config - vLLM configuration
 * @param {object} hardwareSpecs - GPU specifications
 * @returns {object} Estimated performance metrics
 */
export function estimateThroughputMetrics(config, hardwareSpecs) {
  const {
    maxNumSeqs,
    maxNumBatchedTokens,
    modelSizeGB,
    quantization = 'fp16',
    maxSequenceLength = 2048,
  } = config

  const {
    gpuMemoryBandwidthGBps = 900, // Default for A100
    tensorCores = true,
  } = hardwareSpecs

  // Estimate tokens per second based on memory bandwidth and model size
  // This is a simplified model - real performance depends on many factors
  
  // Memory bandwidth utilization factor
  const quantizationInfo = calculateQuantizationFactor(quantization)
  const memoryBandwidthUtilization = 0.7 // Typical 70% utilization
  
  // Effective memory bandwidth for model weights
  const effectiveMemoryBandwidth = gpuMemoryBandwidthGBps * memoryBandwidthUtilization
  
  // Estimate decode tokens per second (memory-bound for large models)
  const decodeTokensPerSec = (effectiveMemoryBandwidth / modelSizeGB) * maxNumSeqs
  
  // Estimate prefill performance (compute-bound)
  // Simplified calculation based on model size and sequence length
  const prefillTokensPerSec = tensorCores ? 
    Math.min(maxNumBatchedTokens * 100, effectiveMemoryBandwidth * 50) : // With tensor cores
    Math.min(maxNumBatchedTokens * 50, effectiveMemoryBandwidth * 25)   // Without tensor cores
  
  // Request throughput depends on sequence length distribution
  const avgOutputLength = 100 // Assume average 100 output tokens
  const requestsPerSec = decodeTokensPerSec / avgOutputLength
  
  return {
    tokensPerSecond: Math.floor(decodeTokensPerSec),
    requestsPerSecond: Math.floor(requestsPerSec),
    latencyEstimate: {
      timeToFirstToken: Math.ceil(1000 / prefillTokensPerSec * maxSequenceLength),
      interTokenLatency: Math.ceil(1000 / decodeTokensPerSec),
      p50: Math.ceil(1000 / decodeTokensPerSec * 50), // 50th percentile latency
      p95: Math.ceil(1000 / decodeTokensPerSec * 95), // 95th percentile latency
    },
    utilizationEfficiency: memoryBandwidthUtilization,
    bottlenecks: [
      ...(effectiveMemoryBandwidth / gpuMemoryBandwidthGBps < 0.8 ? ['memory_bandwidth'] : []),
      ...(!tensorCores || maxNumBatchedTokens > 8192 ? ['compute_capacity'] : []),
      ...(maxNumSeqs < 64 ? ['batch_size'] : []),
    ],
    estimatedDecodeTokensPerSec: Math.floor(decodeTokensPerSec),
    estimatedPrefillTokensPerSec: Math.floor(prefillTokensPerSec),
    estimatedRequestsPerSec: Math.floor(requestsPerSec),
    estimatedLatencyMs: {
      timeToFirstToken: Math.ceil(1000 / prefillTokensPerSec * maxSequenceLength),
      interTokenLatency: Math.ceil(1000 / decodeTokensPerSec),
    },
    memoryBandwidthUtilization: memoryBandwidthUtilization,
    quantizationImpact: {
      format: quantization,
      speedupFactor: quantizationInfo.format === 'fp16' ? 1.0 : 
                    quantizationInfo.format === 'int8' ? 1.2 :
                    quantizationInfo.format === 'int4' ? 1.5 : 1.0,
      qualityTradeoff: quantizationInfo.qualityLoss,
    }
  }
}

/**
 * Main function to calculate throughput-optimized vLLM configuration
 * @param {object} params - Parameters object containing gpuSpecs, modelSpecs, and workloadSpecs OR a flat config object
 * @returns {object} Optimized vLLM configuration for throughput
 */
export function calculateThroughputOptimizedConfig(params) {
  // Handle both destructured and flat parameter styles
  let gpuSpecs, modelSpecs, workloadSpecs
  
  if (params.gpuSpecs && params.modelSpecs) {
    // Structured style: prefer the structured specs if provided
    gpuSpecs = {
      // Merge any flat properties with structured specs, preferring structured
      totalVRAMGB: params.gpuSpecs.totalVRAMGB || params.gpu?.memory || params.totalVRAMGB || 80,
      memoryBandwidthGBps: params.gpuSpecs.memoryBandwidthGBps || params.memoryBandwidthGBps || 900,
      computeCapability: params.gpuSpecs.computeCapability || params.computeCapability || 8.0,
      tensorCores: params.gpuSpecs.tensorCores !== undefined ? params.gpuSpecs.tensorCores : (params.tensorCores !== false),
      multiGPU: params.gpuSpecs.multiGPU || params.multiGPU || false,
      gpuCount: params.gpuSpecs.gpuCount || params.gpu?.count || params.gpuCount || 1,
    }
    modelSpecs = params.modelSpecs
    workloadSpecs = params.workloadSpecs || {}
  } else {
    // Flat style: extract from mixed object
    gpuSpecs = params.gpuSpecs || {
      totalVRAMGB: params.gpu?.memory || params.totalVRAMGB || 80,
      memoryBandwidthGBps: params.memoryBandwidthGBps || 900,
      computeCapability: params.computeCapability || 8.0,
      tensorCores: params.tensorCores !== false,
      multiGPU: params.multiGPU || false,
      gpuCount: params.gpu?.count || params.gpuCount || 1,
    }
    
    modelSpecs = params.modelSpecs || {
      modelSizeGB: params.modelSizeGB || 13.5, // Default for 7B model
      numParams: params.numParams || 7,
      quantization: params.quantization || 'fp16',
      architecture: params.architecture,
      modelPath: params.model,
    }
    
    workloadSpecs = params.workloadSpecs || {
      expectedConcurrentUsers: params.workload?.concurrentRequests || params.expectedConcurrentUsers || 100,
      averageSequenceLength: params.workload?.averageTokensPerRequest || params.averageSequenceLength || 512,
      maxSequenceLength: params.workload?.maxSeqLen || params.maxSequenceLength || 2048,
      workloadType: params.workloadType || 'serving',
    }
  }

  const {
    totalVRAMGB,
    memoryBandwidthGBps = 900,
    computeCapability = 8.0,
    tensorCores = true,
    multiGPU = false,
    gpuCount = 1,
  } = gpuSpecs

  const {
    modelSizeGB,
    numParams,
    quantization = 'fp16',
    architecture,
  } = modelSpecs

  const {
    expectedConcurrentUsers = 100,
    averageSequenceLength = 512,
    maxSequenceLength = 2048,
    workloadType = 'serving', // 'serving' | 'batch' | 'mixed'
  } = workloadSpecs

  // Calculate model memory if not provided
  let finalModelSizeGB = modelSizeGB
  if (!finalModelSizeGB && numParams) {
    const modelMemoryInfo = calculateModelWeightsMemory(numParams, quantization)
    finalModelSizeGB = modelMemoryInfo.totalMemory
  }

  if (!finalModelSizeGB) {
    throw new Error('Either modelSizeGB or numParams must be provided')
  }

  // Get model architecture if not provided
  let finalArchitecture = architecture
  if (!finalArchitecture) {
    // Check if modelSpecs has architecture properties directly
    if (modelSpecs.layers && modelSpecs.hiddenSize && modelSpecs.numHeads) {
      finalArchitecture = {
        layers: modelSpecs.layers,
        hiddenSize: modelSpecs.hiddenSize,
        numHeads: modelSpecs.numHeads,
      }
    } else {
      // Estimate from parameters
      finalArchitecture = estimateModelArchitecture(numParams || finalModelSizeGB / 2)
    }
  }

  // Calculate memory allocation strategy
  const memoryStrategy = calculateMemoryAllocationStrategy({
    totalVRAMGB,
    modelSizeGB: finalModelSizeGB,
    targetBatchSize: expectedConcurrentUsers,
    workloadType,
  })

  // Calculate optimal batch sizes
  const batchConfig = calculateOptimalBatchSize({
    availableMemoryGB: memoryStrategy.allocatedVRAMGB,
    modelMemoryGB: finalModelSizeGB,
    maxSequenceLength,
    averageSequenceLength,
    architecture: finalArchitecture,
  })

  // Estimate performance
  const performanceEstimates = estimateThroughputMetrics(
    {
      maxNumSeqs: batchConfig.maxNumSeqs,
      maxNumBatchedTokens: batchConfig.maxNumBatchedTokens,
      modelSizeGB: finalModelSizeGB,
      quantization,
      maxSequenceLength,
    },
    { memoryBandwidthGBps, computeCapability, tensorCores }
  )

  // Generate vLLM command line arguments
  const vllmArgs = {
    // Core model and serving
    model: modelSpecs.modelPath || 'MODEL_PATH',
    host: '0.0.0.0',
    port: 8000,
    
    // Memory and batch optimization
    'gpu-memory-utilization': memoryStrategy.gpuMemoryUtilization,
    'max-num-seqs': batchConfig.maxNumSeqs,
    'max-num-batched-tokens': batchConfig.maxNumBatchedTokens,
    'max-model-len': maxSequenceLength,
    'block-size': memoryStrategy.recommendedBlockSize,
    
    // Swap and offloading
    ...(memoryStrategy.swapSpaceGB > 0 && { 'swap-space': `${memoryStrategy.swapSpaceGB}GB` }),
    
    // Chunked prefill for long sequences
    ...(memoryStrategy.enableChunkedPrefill && maxSequenceLength > THROUGHPUT_OPTIMIZATION_CONFIGS.chunkedPrefillThreshold && {
      'enable-chunked-prefill': true
    }),
    
    // Quantization
    ...(quantization !== 'fp16' && { quantization }),
    
    // Multi-GPU setup
    ...(multiGPU && gpuCount > 1 && { 'tensor-parallel-size': gpuCount }),
    
    // Performance optimizations
    'disable-log-stats': workloadType === 'batch', // Reduce logging overhead for batch processing
  }

  return {
    // Expected top-level properties for tests
    batchConfiguration: batchConfig,
    memoryConfiguration: memoryStrategy,
    performanceEstimate: performanceEstimates,
    vllmParameters: vllmArgs,
    vllmCommand: generateVLLMCommand(vllmArgs),
    
    // Optimization summary with expected properties
    optimizationSummary: {
      primaryOptimizations: [
        `Batch size optimized to ${batchConfig.maxNumSeqs} concurrent sequences`,
        `Memory utilization set to ${Math.round(memoryStrategy.gpuMemoryUtilization * 100)}%`,
        `Quantization: ${quantization}`,
        workloadType === 'batch' ? 'Optimized for high-throughput batch processing' :
        workloadType === 'serving' ? 'Balanced optimization for serving workload' :
        'Mixed workload optimization'
      ],
      tradeoffs: [
        'Higher batch sizes increase throughput but may increase latency',
        quantization !== 'fp16' ? 'Quantization improves speed but may reduce quality' : 'Using fp16 for best quality',
        `Memory utilization at ${Math.round(memoryStrategy.gpuMemoryUtilization * 100)}% reduces OOM risk but may limit peak performance`
      ],
      expectedImprovements: {
        throughputIncrease: `${Math.round((batchConfig.maxNumSeqs / 32) * 100)}%`,
        memoryEfficiency: `${Math.round(memoryStrategy.gpuMemoryUtilization * 100)}%`,
        concurrentRequests: batchConfig.maxNumSeqs
      }
    },
    
    // Configuration parameters
    configuration: vllmArgs,
    
    // Memory allocation details
    memoryAllocation: memoryStrategy,
    
    // Batch size optimization
    batchOptimization: batchConfig,
    
    // Performance estimates
    performanceEstimates,
    
    // Command generation
    command: generateVLLMCommand(vllmArgs),
  }
}

/**
 * Generate vLLM command string from configuration arguments
 * @param {object} args - vLLM arguments object
 * @returns {string} Complete vLLM command
 */
/**
 * Generate vLLM command string from configuration parameters
 * @param {object} args - vLLM arguments
 * @returns {string} Command string
 */
export function generateVLLMCommand(args) {
  let command = 'python -m vllm.entrypoints.openai.api_server'
  
  for (const [key, value] of Object.entries(args)) {
    // Convert camelCase to kebab-case
    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    
    if (value === true) {
      command += ` --${kebabKey}`
    } else if (value !== false && value !== undefined) {
      command += ` --${kebabKey} ${value}`
    }
  }
  
  return command
}

/**
 * Optimize configuration for specific workload patterns
 * @param {object} workloadProfile - Workload characteristics
 * @returns {object} Workload-specific optimizations
 */
export function optimizeForWorkload(workloadProfile) {
  const {
    workloadType = 'serving', // 'chat', 'completion', 'batch', 'code-generation'
    averageInputLength = 512,
    averageOutputLength = 100,
    peakConcurrency = 100,
    latencyRequirement = 'balanced', // 'low' | 'balanced' | 'high'
    throughputPriority = 'high', // 'low' | 'medium' | 'high'
  } = workloadProfile

  const optimizations = {
    recommendedQuantization: 'fp16',
    memoryStrategy: 'balanced',
    batchingStrategy: {},
    specialSettings: {},
  }

  // Calculate sequence lengths based on input/output
  const totalSeqLen = averageInputLength + averageOutputLength
  const maxSeqLen = Math.min(totalSeqLen * 2, 8192) // Allow for 2x variance

  // Calculate batch size based on concurrency
  const baseBatchSize = Math.min(peakConcurrency, 256)

  // Workload-specific optimizations
  switch (workloadType) {
    case 'chat':
      optimizations.recommendedQuantization = 'fp16' // Quality important for chat
      optimizations.batchingStrategy = {
        maxSeqLen: Math.max(maxSeqLen, 4096), // Longer contexts for chat
        maxNumSeqs: Math.min(baseBatchSize, 128),
        enableChunkedPrefill: true,
        prioritizeBatching: true,
      }
      optimizations.specialSettings = {
        'enable-prefix-caching': true, // Good for repetitive chat patterns
      }
      break

    case 'completion':
      optimizations.recommendedQuantization = throughputPriority === 'high' ? 'awq' : 'fp16'
      optimizations.batchingStrategy = {
        maxSeqLen: maxSeqLen,
        maxNumSeqs: baseBatchSize,
        maxBatchedTokens: baseBatchSize * totalSeqLen, // Higher for completion tasks
      }
      break

    case 'code-generation':
      optimizations.recommendedQuantization = 'fp16' // Precision important for code
      optimizations.batchingStrategy = {
        maxSeqLen: Math.max(maxSeqLen, 8192), // Code can be long
        maxNumSeqs: Math.min(baseBatchSize, 64), // Lower concurrency for quality
        enableChunkedPrefill: true,
      }
      optimizations.specialSettings = {
        'enable-prefix-caching': true, // Code often has common prefixes
      }
      break

    case 'batch':
      optimizations.recommendedQuantization = 'awq' // Memory efficiency for batch
      optimizations.memoryStrategy = 'aggressive'
      optimizations.batchingStrategy = {
        maxSeqLen: maxSeqLen,
        maxNumSeqs: Math.max(baseBatchSize, 512), // Higher batch sizes
        maxBatchedTokens: 16384,
      }
      optimizations.specialSettings = {
        'disable-log-stats': true, // Reduce overhead
      }
      break

    default: // serving
      optimizations.recommendedQuantization = 'fp16'
      optimizations.memoryStrategy = 'balanced'
      optimizations.batchingStrategy = {
        maxSeqLen: maxSeqLen,
        maxNumSeqs: baseBatchSize,
      }
  }

  // Latency adjustments
  if (latencyRequirement === 'low') {
    optimizations.batchingStrategy.maxNumSeqs = Math.min(
      optimizations.batchingStrategy.maxNumSeqs || 128, 
      64 // Lower batch for lower latency
    )
    optimizations.specialSettings['enforce-eager'] = false // Keep CUDA graphs
  }

  // Throughput adjustments
  if (throughputPriority === 'high') {
    optimizations.batchingStrategy.maxNumSeqs = Math.max(
      optimizations.batchingStrategy.maxNumSeqs || 128,
      256 // Higher batch for throughput
    )
    optimizations.memoryStrategy = 'aggressive'
  }

  return {
    workloadType,
    inputProfile: {
      averageInputLength,
      averageOutputLength,
      peakConcurrency,
      totalSequenceLength: totalSeqLen,
    },
    optimizations,
    recommendations: {
      quantization: optimizations.recommendedQuantization,
      memoryUtilization: optimizations.memoryStrategy === 'aggressive' ? 0.95 :
                        optimizations.memoryStrategy === 'conservative' ? 0.85 : 0.90,
      batchConfiguration: optimizations.batchingStrategy,
      specialFeatures: optimizations.specialSettings,
    },
    reasoning: {
      workloadConsiderations: getWorkloadConsiderations(workloadType),
      latencyImpact: latencyRequirement,
      throughputPriority,
    }
  }
}

/**
 * Get workload-specific considerations
 * @param {string} workloadType - Type of workload
 * @returns {string[]} List of considerations
 */
function getWorkloadConsiderations(workloadType) {
  const considerations = {
    chat: [
      'Long conversation contexts require larger max_model_len',
      'Prefix caching beneficial for conversation continuity',
      'Quality important - avoid aggressive quantization',
    ],
    completion: [
      'Batch processing can be optimized for higher throughput',
      'Variable output lengths - adjust batching accordingly',
      'Memory efficiency important for cost effectiveness',
    ],
    'code-generation': [
      'Long sequences common - enable chunked prefill',
      'Precision critical for code correctness',
      'Common code patterns benefit from prefix caching',
    ],
    batch: [
      'Maximize GPU utilization with large batches',
      'Latency less critical than throughput',
      'Memory efficiency enables larger batch sizes',
    ],
    serving: [
      'Balance between latency and throughput',
      'Handle variable request patterns',
      'Reserve memory for request spikes',
    ]
  }
  
  return considerations[workloadType] || considerations.serving
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

// ===============================
// LATENCY OPTIMIZATION FUNCTIONS  
// ===============================

/**
 * Optimal configuration values for latency optimization
 * Based on vLLM best practices for minimizing response time
 */
const LATENCY_OPTIMIZATION_CONFIGS = {
  // Batch sizes for low latency (smaller batches)
  gpu: {
    maxNumSeqsOptimal: 32, // Lower concurrent sequences for faster processing
    maxNumBatchedTokensOptimal: 2048, // Smaller batched tokens to reduce prefill time
    maxNumSeqsMinimal: 8, // For ultra-low latency scenarios
    maxNumBatchedTokensMinimal: 512, // Minimal batching for lowest latency
  },
  
  // Memory utilization for latency (more conservative to avoid swapping)
  gpuMemoryUtilization: {
    conservative: 0.75, // Lower to avoid memory pressure
    balanced: 0.80,
    aggressive: 0.85, // Still conservative compared to throughput
  },
  
  // Chunked prefill settings for latency
  chunkedPrefillSize: 512, // Smaller chunks for lower TTFT
  disableChunkedPrefillThreshold: 4096, // Disable for shorter sequences
  
  // KV cache block sizes (smaller for better memory locality)
  kvCacheBlockSizes: [8, 16], // Smaller blocks for better cache efficiency
  
  // Speculation settings for latency
  speculation: {
    enableSpeculativeDecoding: true,
    speculationLength: 4, // Conservative speculation length
    draftModelRatio: 0.25, // Ratio of draft model size to main model
  },
}

/**
 * Calculate optimal batch size for minimum latency
 * @param {object} config - Configuration parameters
 * @param {number} config.availableMemoryGB - Available GPU memory in GB
 * @param {number} config.modelMemoryGB - Model memory usage in GB
 * @param {number} config.maxSequenceLength - Maximum sequence length
 * @param {number} config.averageSequenceLength - Average expected sequence length
 * @param {object} config.architecture - Model architecture info
 * @param {string} config.latencyTarget - 'ultra-low' | 'low' | 'balanced'
 * @returns {object} Optimal batch configuration for latency
 */
export function calculateLatencyOptimalBatchSize(config) {
  const {
    availableMemoryGB,
    modelMemoryGB,
    maxSequenceLength = 2048,
    averageSequenceLength = 512,
    architecture,
    latencyTarget = 'low', // 'ultra-low' | 'low' | 'balanced'
  } = config

  if (availableMemoryGB <= modelMemoryGB) {
    throw new Error('Available memory must be greater than model memory')
  }

  const remainingMemoryGB = availableMemoryGB - modelMemoryGB
  
  // Calculate KV cache memory per sequence (using smaller precision for latency)
  const kvCachePerSeqGB = calculateKVCacheMemory(
    1, // single sequence
    maxSequenceLength,
    architecture.layers,
    architecture.hiddenSize,
    architecture.numHeads,
    'fp16' // Keep FP16 for balance of speed and quality
  )
  
  // Calculate activation memory per token
  const activationPerTokenGB = calculateActivationMemory(1, 1, architecture.hiddenSize, architecture.layers)
  
  // For latency optimization, prioritize smaller batches
  let maxNumSeqs, maxNumBatchedTokens
  
  switch (latencyTarget) {
    case 'ultra-low':
      // Minimal batching for absolute lowest latency
      maxNumSeqs = Math.min(
        LATENCY_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsMinimal,
        Math.floor(remainingMemoryGB / (kvCachePerSeqGB + activationPerTokenGB * averageSequenceLength))
      )
      maxNumBatchedTokens = LATENCY_OPTIMIZATION_CONFIGS.gpu.maxNumBatchedTokensMinimal
      break
      
    case 'balanced':
      // Balance between latency and some throughput
      maxNumSeqs = Math.min(
        64, // Moderate batch size
        Math.floor(remainingMemoryGB / (kvCachePerSeqGB + activationPerTokenGB * averageSequenceLength))
      )
      maxNumBatchedTokens = 4096
      break
      
    default: // 'low'
      // Low latency with reasonable throughput
      maxNumSeqs = Math.min(
        LATENCY_OPTIMIZATION_CONFIGS.gpu.maxNumSeqsOptimal,
        Math.floor(remainingMemoryGB / (kvCachePerSeqGB + activationPerTokenGB * averageSequenceLength))
      )
      maxNumBatchedTokens = LATENCY_OPTIMIZATION_CONFIGS.gpu.maxNumBatchedTokensOptimal
  }
  
  // Ensure minimum viable values
  maxNumSeqs = Math.max(1, maxNumSeqs)
  maxNumBatchedTokens = Math.max(256, maxNumBatchedTokens)
  
  // Calculate memory usage breakdown
  const kvCacheMemoryGB = maxNumSeqs * kvCachePerSeqGB
  const activationMemoryGB = maxNumSeqs * activationPerTokenGB * averageSequenceLength
  const totalUsedMemoryGB = modelMemoryGB + kvCacheMemoryGB + activationMemoryGB
  const memoryUtilization = totalUsedMemoryGB / availableMemoryGB
  
  return {
    maxNumSeqs,
    maxNumBatchedTokens,
    kvCacheMemoryGB,
    activationMemoryGB,
    memoryUtilization,
    latencyTarget,
    reasoning: {
      availableForBatching: remainingMemoryGB,
      kvCachePerSeq: kvCachePerSeqGB,
      maxSequencesEstimate: Math.floor(remainingMemoryGB / kvCachePerSeqGB),
      targetBatchedTokens: maxNumBatchedTokens,
      optimizationFocus: 'minimize_latency',
    }
  }
}

/**
 * Calculate memory allocation strategy optimized for latency
 * @param {object} config - Configuration object
 * @param {number} config.totalVRAMGB - Total VRAM available
 * @param {number} config.modelSizeGB - Model size in GB
 * @param {number} config.targetBatchSize - Expected concurrent requests
 * @param {string} config.workloadType - Type of workload
 * @param {string} config.latencyPriority - 'ultra-high' | 'high' | 'medium'
 * @returns {object} Memory allocation strategy for latency
 */
export function calculateLatencyMemoryStrategy(config) {
  const {
    totalVRAMGB,
    modelSizeGB,
    workloadType = 'serving',
    latencyPriority = 'high',
  } = config

  if (totalVRAMGB <= modelSizeGB) {
    throw new Error('Total VRAM must be greater than model size')
  }

  // Use more conservative memory utilization for latency
  let gpuMemoryUtilization
  switch (latencyPriority) {
    case 'ultra-high':
      gpuMemoryUtilization = LATENCY_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.conservative
      break
    case 'medium':
      gpuMemoryUtilization = LATENCY_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.aggressive
      break
    default: // 'high'
      gpuMemoryUtilization = LATENCY_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.balanced
  }

  const allocatedVRAMGB = totalVRAMGB * gpuMemoryUtilization
  const availableForKVCacheGB = allocatedVRAMGB - modelSizeGB
  
  // Reserve more memory for system overhead to avoid memory pressure
  const systemReservedGB = totalVRAMGB * (1 - gpuMemoryUtilization)
  
  // Calculate KV cache allocation (more conservative)
  const kvCacheAllocationGB = availableForKVCacheGB * 0.7 // Reserve 30% for activations
  
  // Minimal swap space for latency workloads
  const swapSpaceGB = Math.min(2, totalVRAMGB * 0.05) // 5% or 2GB max
  
  // Smaller block sizes for better cache locality
  const recommendedBlockSize = latencyPriority === 'ultra-high' ? 8 : 16
  
  // Disable chunked prefill for shorter sequences to reduce TTFT
  const enableChunkedPrefill = false // Disable for latency optimization
  
  return {
    gpuMemoryUtilization,
    swapSpaceGB,
    allocatedVRAMGB,
    kvCacheAllocationGB,
    reservedMemoryGB: systemReservedGB,
    recommendedBlockSize,
    enableChunkedPrefill,
    workloadOptimization: workloadType,
    latencyOptimizations: {
      aggressiveCaching: latencyPriority === 'ultra-high',
      preemptiveEviction: false, // Avoid eviction overhead
      prioritizeFirstToken: true,
    },
    memoryBreakdown: {
      model: modelSizeGB,
      kvCache: kvCacheAllocationGB,
      reserved: systemReservedGB,
      swap: swapSpaceGB,
    }
  }
}

/**
 * Estimate latency metrics for a given configuration
 * @param {object} config - vLLM configuration
 * @param {object} hardwareSpecs - GPU specifications
 * @param {string} optimizationLevel - 'ultra-low' | 'low' | 'balanced'
 * @returns {object} Estimated latency metrics
 */
export function estimateLatencyMetrics(config, hardwareSpecs, optimizationLevel = 'low') {
  const {
    maxNumSeqs,
    modelSizeGB,
    quantization = 'fp16',
    maxSequenceLength = 2048,
  } = config

  const {
    gpuMemoryBandwidthGBps = 900, // Default for A100
    tensorCores = true,
  } = hardwareSpecs

  // Memory bandwidth utilization (lower for latency to avoid contention)
  const memoryBandwidthUtilization = optimizationLevel === 'ultra-low' ? 0.5 : 0.6
  const effectiveMemoryBandwidth = gpuMemoryBandwidthGBps * memoryBandwidthUtilization
  
  // Calculate Time to First Token (TTFT) - critical for latency
  // Prefill is compute-bound, depends on sequence length and model size
  const prefillComputeIntensity = tensorCores ? 1.5 : 1.0 // Tensor cores help with prefill
  const timeToFirstTokenMs = Math.max(
    50, // Minimum realistic TTFT
    (maxSequenceLength * modelSizeGB) / (effectiveMemoryBandwidth * prefillComputeIntensity * 100)
  )
  
  // Calculate Inter-Token Latency (ITL) - memory-bound for decode
  const quantizationInfo = calculateQuantizationFactor(quantization)
  const memoryEfficiency = quantizationInfo.memoryEfficiency || 0.5
  const baseInterTokenLatency = (modelSizeGB * memoryEfficiency) / effectiveMemoryBandwidth
  
  // Batch size penalty for latency (more sequences = higher latency)
  const batchLatencyPenalty = 1 + (maxNumSeqs - 1) * 0.1 // 10% penalty per additional sequence
  const interTokenLatencyMs = baseInterTokenLatency * batchLatencyPenalty
  
  // Calculate end-to-end latency estimates
  const avgOutputLength = 100 // Assume 100 output tokens
  const totalLatencyMs = timeToFirstTokenMs + (interTokenLatencyMs * avgOutputLength)
  
  // Latency percentiles (account for variance)
  const latencyVariance = optimizationLevel === 'ultra-low' ? 1.2 : 1.5
  
  return {
    timeToFirstToken: Math.ceil(timeToFirstTokenMs),
    interTokenLatency: Math.ceil(interTokenLatencyMs),
    totalLatency: Math.ceil(totalLatencyMs),
    latencyPercentiles: {
      p50: Math.ceil(totalLatencyMs),
      p95: Math.ceil(totalLatencyMs * latencyVariance),
      p99: Math.ceil(totalLatencyMs * latencyVariance * 1.3),
    },
    throughputTradeoff: {
      estimatedRequestsPerSec: Math.floor(1000 / totalLatencyMs * maxNumSeqs),
      concurrentCapacity: maxNumSeqs,
      utilizationEfficiency: memoryBandwidthUtilization,
    },
    optimizationLevel,
    bottlenecks: [
      ...(timeToFirstTokenMs > 200 ? ['prefill_compute'] : []),
      ...(interTokenLatencyMs > 50 ? ['memory_bandwidth'] : []),
      ...(maxNumSeqs > 32 ? ['batch_size'] : []),
    ],
    recommendations: {
      reduceSequenceLength: timeToFirstTokenMs > 500,
      enableSpeculation: interTokenLatencyMs > 100,
      reduceBatchSize: maxNumSeqs > 16 && optimizationLevel === 'ultra-low',
    }
  }
}

/**
 * Main function to calculate latency-optimized vLLM configuration
 * @param {object} params - Parameters object containing gpuSpecs, modelSpecs, and workloadSpecs
 * @returns {object} Optimized vLLM configuration for latency
 */
export function calculateLatencyOptimizedConfig(params) {
  // Handle both destructured and flat parameter styles
  let gpuSpecs, modelSpecs, workloadSpecs
  
  if (params.gpuSpecs && params.modelSpecs) {
    // Structured style: prefer the structured specs if provided
    gpuSpecs = {
      totalVRAMGB: params.gpuSpecs.totalVRAMGB || params.gpu?.memory || params.totalVRAMGB || 80,
      memoryBandwidthGBps: params.gpuSpecs.memoryBandwidthGBps || params.memoryBandwidthGBps || 900,
      computeCapability: params.gpuSpecs.computeCapability || params.computeCapability || 8.0,
      tensorCores: params.gpuSpecs.tensorCores !== undefined ? params.gpuSpecs.tensorCores : (params.tensorCores !== false),
      multiGPU: params.gpuSpecs.multiGPU || params.multiGPU || false,
      gpuCount: params.gpuSpecs.gpuCount || params.gpu?.count || params.gpuCount || 1,
    }
    modelSpecs = params.modelSpecs
    workloadSpecs = params.workloadSpecs || {}
  } else {
    // Flat style: extract from mixed object
    gpuSpecs = {
      totalVRAMGB: params.gpu?.memory || params.totalVRAMGB || 80,
      memoryBandwidthGBps: params.memoryBandwidthGBps || 900,
      computeCapability: params.computeCapability || 8.0,
      tensorCores: params.tensorCores !== false,
      multiGPU: params.multiGPU || false,
      gpuCount: params.gpu?.count || params.gpuCount || 1,
    }
    
    modelSpecs = params.modelSpecs || {
      modelSizeGB: params.modelSizeGB || (params.modelSpecs && params.modelSpecs.modelSizeGB) || 13.5,
      numParams: params.numParams || (params.modelSpecs && params.modelSpecs.numParams) || 7,
      quantization: params.quantization || 'fp16',
      architecture: params.architecture,
      modelPath: params.model,
    }
    
    workloadSpecs = params.workloadSpecs || {
      expectedConcurrentUsers: params.workload?.concurrentRequests || params.expectedConcurrentUsers || 16, // Lower for latency
      averageSequenceLength: params.workload?.averageTokensPerRequest || params.averageSequenceLength || 512,
      maxSequenceLength: params.workload?.maxSeqLen || params.maxSequenceLength || 2048,
      workloadType: params.workloadType || 'serving',
      latencyTarget: params.latencyTarget || 'low',
    }
  }

  const {
    totalVRAMGB,
    memoryBandwidthGBps = 900,
    computeCapability = 8.0,
    tensorCores = true,
    multiGPU = false,
    gpuCount = 1,
  } = gpuSpecs

  const {
    modelSizeGB,
    numParams,
    quantization = 'fp16',
    architecture,
  } = modelSpecs

  const {
    expectedConcurrentUsers = 16, // Lower default for latency
    averageSequenceLength = 512,
    maxSequenceLength = 2048,
    workloadType = 'serving',
    latencyTarget = 'low',
  } = workloadSpecs

  // Calculate model memory if not provided
  let finalModelSizeGB = modelSizeGB
  if (!finalModelSizeGB && numParams) {
    const modelMemoryInfo = calculateModelWeightsMemory(numParams, quantization)
    finalModelSizeGB = modelMemoryInfo.totalMemory
  }

  if (!finalModelSizeGB) {
    throw new Error('Either modelSizeGB or numParams must be provided')
  }

  // Get model architecture if not provided
  let finalArchitecture = architecture
  if (!finalArchitecture) {
    // Check if modelSpecs has architecture properties directly
    if (modelSpecs.layers && modelSpecs.hiddenSize && modelSpecs.numHeads) {
      finalArchitecture = {
        layers: modelSpecs.layers,
        hiddenSize: modelSpecs.hiddenSize,
        numHeads: modelSpecs.numHeads,
      }
    } else {
      // Estimate from parameters
      finalArchitecture = estimateModelArchitecture(numParams || finalModelSizeGB / 2)
    }
  }

  // Calculate memory allocation strategy for latency
  const memoryStrategy = calculateLatencyMemoryStrategy({
    totalVRAMGB,
    modelSizeGB: finalModelSizeGB,
    targetBatchSize: expectedConcurrentUsers,
    workloadType,
    latencyPriority: latencyTarget === 'ultra-low' ? 'ultra-high' : 'high',
  })

  // Calculate optimal batch sizes for latency
  const batchConfig = calculateLatencyOptimalBatchSize({
    availableMemoryGB: memoryStrategy.allocatedVRAMGB,
    modelMemoryGB: finalModelSizeGB,
    maxSequenceLength,
    averageSequenceLength,
    architecture: finalArchitecture,
    latencyTarget,
  })

  // Estimate latency performance
  const latencyEstimates = estimateLatencyMetrics(
    {
      maxNumSeqs: batchConfig.maxNumSeqs,
      maxNumBatchedTokens: batchConfig.maxNumBatchedTokens,
      modelSizeGB: finalModelSizeGB,
      quantization,
      maxSequenceLength,
    },
    { memoryBandwidthGBps, computeCapability, tensorCores },
    latencyTarget
  )

  // Generate vLLM command line arguments optimized for latency
  const vllmArgs = {
    // Core model and serving
    model: modelSpecs.modelPath || 'MODEL_PATH',
    host: '0.0.0.0',
    port: 8000,
    
    // Memory and batch optimization for latency
    'gpu-memory-utilization': memoryStrategy.gpuMemoryUtilization,
    'max-num-seqs': batchConfig.maxNumSeqs,
    'max-num-batched-tokens': batchConfig.maxNumBatchedTokens,
    'max-model-len': maxSequenceLength,
    'block-size': memoryStrategy.recommendedBlockSize,
    
    // Latency-specific optimizations
    'disable-log-stats': true, // Reduce logging overhead
    'enforce-eager': false, // Keep CUDA graphs for performance
    
    // Swap space (minimal for latency)
    ...(memoryStrategy.swapSpaceGB > 0 && { 'swap-space': `${memoryStrategy.swapSpaceGB}GB` }),
    
    // Quantization
    ...(quantization !== 'fp16' && { quantization }),
    
    // Multi-GPU setup
    ...(multiGPU && gpuCount > 1 && { 'tensor-parallel-size': gpuCount }),
    
    // Disable chunked prefill for shorter sequences (reduces TTFT)
    ...(maxSequenceLength <= LATENCY_OPTIMIZATION_CONFIGS.disableChunkedPrefillThreshold && {
      'disable-chunked-prefill': true
    }),
  }

  return {
    // Expected top-level properties
    batchConfiguration: batchConfig,
    memoryConfiguration: memoryStrategy,
    latencyEstimate: latencyEstimates,
    vllmParameters: vllmArgs,
    vllmCommand: generateVLLMCommand(vllmArgs),
    
    // Optimization summary with latency focus
    optimizationSummary: {
      primaryOptimizations: [
        `Batch size reduced to ${batchConfig.maxNumSeqs} for lower latency`,
        `Memory utilization set to ${Math.round(memoryStrategy.gpuMemoryUtilization * 100)}% to avoid pressure`,
        `Block size optimized to ${memoryStrategy.recommendedBlockSize} for cache locality`,
        `Quantization: ${quantization} for speed-quality balance`,
        latencyTarget === 'ultra-low' ? 'Ultra-low latency configuration' :
        latencyTarget === 'balanced' ? 'Balanced latency-throughput configuration' :
        'Low latency optimized configuration'
      ],
      tradeoffs: [
        'Lower batch sizes reduce throughput but minimize latency',
        'Conservative memory usage prevents swapping but may underutilize GPU',
        'Smaller block sizes improve cache locality but may reduce memory efficiency',
        `Estimated TTFT: ${latencyEstimates.timeToFirstToken}ms, ITL: ${latencyEstimates.interTokenLatency}ms`
      ],
      expectedImprovements: {
        latencyReduction: `${Math.round((1 - batchConfig.maxNumSeqs / 128) * 100)}%`,
        timeToFirstToken: `${latencyEstimates.timeToFirstToken}ms`,
        interTokenLatency: `${latencyEstimates.interTokenLatency}ms`,
        concurrentCapacity: batchConfig.maxNumSeqs
      }
    },
    
    // Additional latency-specific metrics
    latencyMetrics: latencyEstimates,
    
    // Configuration parameters
    configuration: vllmArgs,
    
    // Memory allocation details
    memoryAllocation: memoryStrategy,
    
    // Batch size optimization
    batchOptimization: batchConfig,
    
    // Command generation
    command: generateVLLMCommand(vllmArgs),
  }
}

/**
 * Optimize configuration specifically for low-latency workload patterns
 * @param {object} workloadProfile - Workload characteristics with latency focus
 * @returns {object} Latency-specific optimizations
 */
export function optimizeForLatency(workloadProfile) {
  const {
    workloadType = 'serving', // 'interactive', 'realtime', 'streaming', 'api'
    averageInputLength = 256, // Shorter inputs typical for latency-sensitive workloads
    averageOutputLength = 50, // Shorter outputs for faster responses
    peakConcurrency = 16, // Lower concurrency for latency
    latencyRequirement = 'low', // 'ultra-low' | 'low' | 'balanced'
    responseTimeTarget = 200, // Target response time in ms
  } = workloadProfile

  const optimizations = {
    recommendedQuantization: 'fp16', // Balance of speed and quality
    memoryStrategy: 'conservative',
    batchingStrategy: {},
    latencySettings: {},
    specialSettings: {},
  }

  // Calculate sequence lengths
  const totalSeqLen = averageInputLength + averageOutputLength
  const maxSeqLen = Math.min(totalSeqLen * 1.5, 2048) // Less variance for latency workloads
  
  // Determine batch size based on latency requirements
  let maxBatchSize
  switch (latencyRequirement) {
    case 'ultra-low':
      maxBatchSize = Math.min(8, peakConcurrency)
      optimizations.memoryStrategy = 'ultra-conservative'
      optimizations.recommendedQuantization = 'fp16' // Avoid quantization overhead
      break
    case 'balanced':
      maxBatchSize = Math.min(32, peakConcurrency)
      optimizations.memoryStrategy = 'balanced'
      break
    default: // 'low'
      maxBatchSize = Math.min(16, peakConcurrency)
      optimizations.memoryStrategy = 'conservative'
  }

  // Latency-specific batching strategy
  optimizations.batchingStrategy = {
    maxSeqLen: maxSeqLen,
    maxNumSeqs: maxBatchSize,
    maxNumBatchedTokens: Math.min(maxBatchSize * totalSeqLen, 2048),
    enableChunkedPrefill: maxSeqLen > 1024, // Only for longer sequences
    prioritizeLatency: true,
  }

  // Latency-specific settings
  optimizations.latencySettings = {
    blockSize: latencyRequirement === 'ultra-low' ? 8 : 16,
    gpuMemoryUtilization: latencyRequirement === 'ultra-low' ? 0.75 : 0.80,
    disableLogStats: true,
    enforceEager: false, // Keep CUDA graphs
    preemptiveScheduling: latencyRequirement === 'ultra-low',
  }

  // Workload-specific optimizations
  switch (workloadType) {
    case 'interactive':
      optimizations.specialSettings = {
        'disable-log-stats': true,
        'enforce-eager': false,
        'enable-prefix-caching': false, // Disable to reduce complexity
      }
      optimizations.latencySettings.prioritizeFirstToken = true
      break

    case 'realtime':
      optimizations.specialSettings = {
        'disable-log-stats': true,
        'disable-chunked-prefill': true, // Disable for minimal TTFT
        'enforce-eager': false,
      }
      optimizations.recommendedQuantization = 'fp16' // Avoid quant overhead
      break

    case 'streaming':
      optimizations.specialSettings = {
        'disable-log-stats': true,
        'stream-interval': 1, // Stream tokens immediately
      }
      optimizations.latencySettings.streamOptimized = true
      break

    case 'api':
      optimizations.specialSettings = {
        'disable-log-stats': true,
        'response-role': 'assistant',
      }
      optimizations.latencySettings.apiOptimized = true
      break

    default: // serving
      optimizations.specialSettings = {
        'disable-log-stats': true,
      }
  }

  return {
    workloadType,
    latencyTarget: latencyRequirement,
    inputProfile: {
      averageInputLength,
      averageOutputLength,
      peakConcurrency,
      totalSequenceLength: totalSeqLen,
      responseTimeTarget,
    },
    optimizations,
    recommendations: {
      quantization: optimizations.recommendedQuantization,
      memoryUtilization: optimizations.latencySettings.gpuMemoryUtilization,
      batchConfiguration: optimizations.batchingStrategy,
      latencyFeatures: optimizations.latencySettings,
      specialFeatures: optimizations.specialSettings,
    },
    reasoning: {
      latencyConsiderations: getLatencyConsiderations(workloadType),
      latencyRequirement,
      expectedLatencyImprovement: `${Math.round((128 - maxBatchSize) / 128 * 100)}%`,
    }
  }
}

/**
 * Get latency-specific considerations for different workload types
 * @param {string} workloadType - Type of workload
 * @returns {string[]} List of latency considerations
 */
function getLatencyConsiderations(workloadType) {
  const considerations = {
    interactive: [
      'Minimize Time to First Token (TTFT) for responsive interactions',
      'Small batch sizes to reduce queuing delays',
      'Conservative memory usage to avoid GC pauses',
    ],
    realtime: [
      'Ultra-low latency required for real-time applications',
      'Disable complex optimizations that add latency variance',
      'Predictable response times more important than peak throughput',
    ],
    streaming: [
      'Optimize for smooth token streaming',
      'Minimize inter-token latency for fluid output',
      'Stream tokens immediately as they are generated',
    ],
    api: [
      'Balance latency with reasonable throughput for API endpoints',
      'Consistent response times for better user experience',
      'Efficient resource utilization for cost effectiveness',
    ],
    serving: [
      'General low-latency serving optimization',
      'Balance between response time and concurrent capacity',
      'Avoid memory pressure that could cause latency spikes',
    ]
  }
  
  return considerations[workloadType] || considerations.serving
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

// ===============================
// BALANCED OPTIMIZATION FUNCTIONS  
// ===============================

/**
 * Balanced configuration values that provide compromise between throughput and latency
 * Based on vLLM best practices for general-purpose serving
 */
const BALANCED_OPTIMIZATION_CONFIGS = {
  // Moderate batch sizes for balanced performance
  gpu: {
    maxNumSeqsOptimal: 128, // Between throughput (256) and latency (32)
    maxNumBatchedTokensOptimal: 4096, // Between throughput (8192) and latency (2048)
    maxNumSeqsMinimal: 32, // For cost-optimized scenarios
    maxNumSeqsMaximal: 192, // For performance-focused balanced configs
  },
  
  // Balanced memory utilization
  gpuMemoryUtilization: {
    conservative: 0.80, // Between latency (75%) and throughput (85%)
    balanced: 0.85, // Sweet spot for most workloads
    performance: 0.90, // Higher utilization when performance is prioritized
  },
  
  // Chunked prefill settings for balance
  chunkedPrefillThreshold: 2048, // Enable for sequences longer than this
  chunkedPrefillSize: 1024, // Moderate chunk size
  
  // KV cache block sizes (balanced for efficiency and locality)
  kvCacheBlockSizes: [16, 24], // Between latency (8-16) and throughput (16-32)
  
  // Balanced optimization targets
  targets: {
    'general': { priority: 'balanced', memoryUtil: 0.85, maxSeqs: 128 },
    'web-api': { priority: 'latency-focused', memoryUtil: 0.80, maxSeqs: 96 },
    'multi-user': { priority: 'throughput-focused', memoryUtil: 0.90, maxSeqs: 160 },
    'cost-optimized': { priority: 'efficiency', memoryUtil: 0.85, maxSeqs: 64 },
    'production': { priority: 'reliability', memoryUtil: 0.80, maxSeqs: 96 },
  },
}

/**
 * Calculate optimal batch size for balanced performance
 * @param {object} config - Configuration parameters
 * @param {number} config.availableMemoryGB - Available GPU memory in GB
 * @param {number} config.modelMemoryGB - Model memory usage in GB
 * @param {number} config.maxSequenceLength - Maximum sequence length
 * @param {number} config.averageSequenceLength - Average expected sequence length
 * @param {object} config.architecture - Model architecture info
 * @param {string} config.balanceTarget - 'general' | 'web-api' | 'multi-user' | 'cost-optimized' | 'production'
 * @returns {object} Optimal batch configuration for balanced performance
 */
export function calculateBalancedBatchSize(config) {
  const {
    availableMemoryGB,
    modelMemoryGB,
    maxSequenceLength = 2048,
    averageSequenceLength = 512,
    architecture,
    balanceTarget = 'general',
  } = config

  if (availableMemoryGB <= modelMemoryGB) {
    throw new Error('Available memory must be greater than model memory')
  }

  const remainingMemoryGB = availableMemoryGB - modelMemoryGB
  
  // Get target configuration based on balance target
  const targetConfig = BALANCED_OPTIMIZATION_CONFIGS.targets[balanceTarget] || 
                      BALANCED_OPTIMIZATION_CONFIGS.targets.general
  
  // Calculate KV cache memory per sequence
  const kvCachePerSeqGB = calculateKVCacheMemory(
    1, // single sequence
    maxSequenceLength,
    architecture.layers,
    architecture.hiddenSize,
    architecture.numHeads,
    'fp16' // Use FP16 for balanced approach
  )
  
  // Calculate activation memory per token (more efficient estimation for balanced)
  const activationPerTokenGB = calculateActivationMemory(1, 1, architecture.hiddenSize, architecture.layers) * 0.5 // Reduce activation overhead
  
  // Calculate optimal batch size based on target (with safety margin)
  const safeMemoryGB = remainingMemoryGB * 0.8 // Use 80% of remaining memory for safety
  const memoryBasedMaxSeqs = Math.floor(safeMemoryGB / (kvCachePerSeqGB + activationPerTokenGB * averageSequenceLength))
  const targetMaxSeqs = targetConfig.maxSeqs
  
  // Use a balanced approach: prefer target but respect memory limits
  const maxNumSeqs = Math.min(Math.max(memoryBasedMaxSeqs, 32), targetMaxSeqs) // Ensure at least 32
  
  // Calculate batched tokens based on target priority
  let maxNumBatchedTokens
  switch (targetConfig.priority) {
    case 'throughput-focused':
      maxNumBatchedTokens = Math.min(6144, maxNumSeqs * averageSequenceLength)
      break
    case 'latency-focused':
      maxNumBatchedTokens = Math.min(3072, maxNumSeqs * averageSequenceLength)
      break
    default: // balanced, efficiency, reliability
      maxNumBatchedTokens = BALANCED_OPTIMIZATION_CONFIGS.gpu.maxNumBatchedTokensOptimal
  }
  
  // Ensure minimum viable values
  const finalMaxNumSeqs = Math.max(8, maxNumSeqs)
  const finalMaxNumBatchedTokens = Math.max(1024, maxNumBatchedTokens)
  
  // Calculate memory usage breakdown
  const kvCacheMemoryGB = finalMaxNumSeqs * kvCachePerSeqGB
  const activationMemoryGB = finalMaxNumSeqs * activationPerTokenGB * averageSequenceLength
  const totalUsedMemoryGB = modelMemoryGB + kvCacheMemoryGB + activationMemoryGB
  const memoryUtilization = totalUsedMemoryGB / availableMemoryGB
  
  return {
    maxNumSeqs: finalMaxNumSeqs,
    maxNumBatchedTokens: finalMaxNumBatchedTokens,
    kvCacheMemoryGB,
    activationMemoryGB,
    memoryUtilization,
    balanceTarget,
    reasoning: {
      availableForBatching: remainingMemoryGB,
      kvCachePerSeq: kvCachePerSeqGB,
      memoryBasedLimit: memoryBasedMaxSeqs,
      targetBasedLimit: targetMaxSeqs,
      selectedTarget: targetConfig,
      optimizationFocus: 'balanced_performance',
    }
  }
}

/**
 * Calculate balanced memory allocation strategy
 * @param {object} config - Configuration object
 * @param {number} config.totalVRAMGB - Total VRAM available
 * @param {number} config.modelSizeGB - Model size in GB
 * @param {number} config.targetBatchSize - Expected concurrent requests
 * @param {string} config.workloadType - Type of workload
 * @param {string} config.balancePriority - 'performance' | 'balanced' | 'conservative'
 * @returns {object} Balanced memory allocation strategy
 */
export function calculateBalancedMemoryStrategy(config) {
  const {
    totalVRAMGB,
    modelSizeGB,
    targetBatchSize = 96, // Moderate default for balanced approach
    workloadType = 'serving',
    balancePriority = 'balanced',
  } = config

  if (totalVRAMGB <= modelSizeGB) {
    throw new Error('Total VRAM must be greater than model size')
  }

  // Use balanced memory utilization
  let gpuMemoryUtilization
  switch (balancePriority) {
    case 'performance':
      gpuMemoryUtilization = BALANCED_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.performance
      break
    case 'conservative':
      gpuMemoryUtilization = BALANCED_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.conservative
      break
    default: // 'balanced'
      gpuMemoryUtilization = BALANCED_OPTIMIZATION_CONFIGS.gpuMemoryUtilization.balanced
  }

  const allocatedVRAMGB = totalVRAMGB * gpuMemoryUtilization
  const availableForKVCacheGB = allocatedVRAMGB - modelSizeGB
  
  // Reserve balanced amount for system overhead
  const systemReservedGB = totalVRAMGB * (1 - gpuMemoryUtilization)
  
  // Calculate KV cache allocation (balanced approach)
  const kvCacheAllocationGB = availableForKVCacheGB * 0.75 // Reserve 25% for activations and overhead
  
  // Moderate swap space for balanced workloads
  const swapSpaceGB = Math.min(4, totalVRAMGB * 0.1) // 10% or 4GB max
  
  // Balanced block sizes for good cache efficiency and memory utilization
  const recommendedBlockSize = balancePriority === 'performance' ? 24 : 16
  
  // Enable chunked prefill for longer sequences
  const enableChunkedPrefill = targetBatchSize > 32 // Enable when we have reasonable batch size
  
  return {
    gpuMemoryUtilization,
    swapSpaceGB,
    allocatedVRAMGB,
    kvCacheAllocationGB,
    reservedMemoryGB: systemReservedGB,
    recommendedBlockSize,
    enableChunkedPrefill,
    workloadOptimization: workloadType,
    balanceOptimizations: {
      moderatePreemption: true, // Allow some preemption for efficiency
      adaptiveBatching: balancePriority === 'performance',
      stableAllocation: balancePriority === 'conservative',
    },
    memoryBreakdown: {
      model: modelSizeGB,
      kvCache: kvCacheAllocationGB,
      reserved: systemReservedGB,
      swap: swapSpaceGB,
    }
  }
}

/**
 * Estimate balanced performance metrics (both throughput and latency)
 * @param {object} config - vLLM configuration
 * @param {object} hardwareSpecs - GPU specifications
 * @param {string} optimizationLevel - 'performance' | 'balanced' | 'conservative'
 * @returns {object} Estimated balanced performance metrics
 */
export function estimateBalancedMetrics(config, hardwareSpecs, optimizationLevel = 'balanced') {
  const {
    maxNumSeqs,
    modelSizeGB,
    quantization = 'fp16',
    maxSequenceLength = 2048,
  } = config

  const {
    gpuMemoryBandwidthGBps = 900, // Default for A100
    tensorCores = true,
  } = hardwareSpecs

  // Balanced memory bandwidth utilization (between throughput and latency)
  const memoryBandwidthUtilization = optimizationLevel === 'performance' ? 0.75 : 
                                    optimizationLevel === 'conservative' ? 0.55 : 0.65
  const effectiveMemoryBandwidth = gpuMemoryBandwidthGBps * memoryBandwidthUtilization
  
  // Calculate throughput metrics (similar to throughput optimization but more conservative)
  const quantizationInfo = calculateQuantizationFactor(quantization)
  const decodeTokensPerSec = (effectiveMemoryBandwidth / modelSizeGB) * maxNumSeqs * 0.8 // 80% efficiency
  
  // Calculate latency metrics (similar to latency optimization but less aggressive)
  const prefillComputeIntensity = tensorCores ? 1.3 : 1.0 // Moderate tensor core utilization
  const timeToFirstTokenMs = Math.max(
    75, // Reasonable minimum TTFT
    (maxSequenceLength * modelSizeGB) / (effectiveMemoryBandwidth * prefillComputeIntensity * 80)
  )
  
  // Inter-token latency with batch penalty
  const batchLatencyPenalty = 1 + (maxNumSeqs - 32) * 0.05 // 5% penalty per sequence above 32
  const baseInterTokenLatency = (modelSizeGB * (quantizationInfo.memoryFactor || 0.5)) / effectiveMemoryBandwidth
  const interTokenLatencyMs = Math.max(10, baseInterTokenLatency * batchLatencyPenalty * 1000) // Ensure minimum and convert to ms
  
  // Calculate balanced performance scores
  const avgOutputLength = 100
  const totalLatencyMs = timeToFirstTokenMs + (interTokenLatencyMs * avgOutputLength)
  const requestsPerSecond = Math.min(decodeTokensPerSec / avgOutputLength, 1000 / totalLatencyMs * maxNumSeqs)
  
  // Performance balance score (0-1, higher is better balanced) - with safe guards against NaN
  const throughputScore = Math.min(1, Math.max(0, decodeTokensPerSec / (modelSizeGB * 1000))) // Normalize by model size
  const latencyScore = Math.min(1, Math.max(0, 1 - (totalLatencyMs / 5000))) // Normalize to 5 second max
  const balanceScore = (throughputScore + latencyScore) / 2
  
  return {
    // Throughput metrics
    tokensPerSecond: Math.floor(decodeTokensPerSec),
    requestsPerSecond: Math.floor(requestsPerSecond),
    
    // Latency metrics
    timeToFirstToken: Math.ceil(timeToFirstTokenMs),
    interTokenLatency: Math.ceil(interTokenLatencyMs),
    totalLatency: Math.ceil(totalLatencyMs),
    
    // Balanced performance analysis
    balanceMetrics: {
      throughputScore: Math.round(throughputScore * 100) / 100,
      latencyScore: Math.round(latencyScore * 100) / 100,
      overallBalanceScore: Math.round(balanceScore * 100) / 100,
      performanceClass: balanceScore > 0.8 ? 'excellent' : 
                       balanceScore > 0.6 ? 'good' : 
                       balanceScore > 0.4 ? 'fair' : 'poor'
    },
    
    // Performance percentiles (balanced between best and worst case)
    latencyPercentiles: {
      p50: Math.ceil(totalLatencyMs),
      p90: Math.ceil(totalLatencyMs * 1.3), // Less variance than pure latency optimization
      p99: Math.ceil(totalLatencyMs * 1.6),
    },
    
    // Utilization efficiency
    utilizationEfficiency: memoryBandwidthUtilization,
    concurrentCapacity: maxNumSeqs,
    
    optimizationLevel,
    
    // Bottleneck analysis
    bottlenecks: [
      ...(timeToFirstTokenMs > 300 ? ['prefill_latency'] : []),
      ...(interTokenLatencyMs > 75 ? ['decode_latency'] : []),
      ...(requestsPerSecond < maxNumSeqs * 2 ? ['memory_bandwidth'] : []),
      ...(balanceScore < 0.5 ? ['configuration_balance'] : []),
    ],
    
    // Recommendations for improvement
    recommendations: {
      increaseMemoryUtil: gpuMemoryBandwidthGBps > 1500 && memoryBandwidthUtilization < 0.7,
      reduceBatchSize: maxNumSeqs > 128 && latencyScore < 0.6,
      enableOptimizations: throughputScore < 0.5 && optimizationLevel === 'conservative',
      adjustBalanceTarget: balanceScore < 0.6,
    }
  }
}

/**
 * Main function to calculate balanced vLLM configuration
 * @param {object} params - Parameters object containing gpuSpecs, modelSpecs, and workloadSpecs
 * @returns {object} Optimized vLLM configuration for balanced performance
 */
export function calculateBalancedOptimizedConfig(params) {
  // Handle both structured and flat parameter styles
  let gpuSpecs, modelSpecs, workloadSpecs
  
  if (params.gpuSpecs && params.modelSpecs) {
    // Structured style
    gpuSpecs = {
      totalVRAMGB: params.gpuSpecs.totalVRAMGB || params.gpu?.memory || params.totalVRAMGB || 80,
      memoryBandwidthGBps: params.gpuSpecs.memoryBandwidthGBps || params.memoryBandwidthGBps || 900,
      computeCapability: params.gpuSpecs.computeCapability || params.computeCapability || 8.0,
      tensorCores: params.gpuSpecs.tensorCores !== undefined ? params.gpuSpecs.tensorCores : (params.tensorCores !== false),
      multiGPU: params.gpuSpecs.multiGPU || params.multiGPU || false,
      gpuCount: params.gpuSpecs.gpuCount || params.gpu?.count || params.gpuCount || 1,
    }
    modelSpecs = params.modelSpecs
    workloadSpecs = params.workloadSpecs || {}
  } else {
    // Flat style: extract from mixed object
    gpuSpecs = {
      totalVRAMGB: params.gpu?.memory || params.totalVRAMGB || 80,
      memoryBandwidthGBps: params.memoryBandwidthGBps || 900,
      computeCapability: params.computeCapability || 8.0,
      tensorCores: params.tensorCores !== false,
      multiGPU: params.multiGPU || false,
      gpuCount: params.gpu?.count || params.gpuCount || 1,
    }
    
    modelSpecs = params.modelSpecs || {
      modelSizeGB: params.modelSizeGB || (params.modelSpecs && params.modelSpecs.modelSizeGB) || 13.5,
      numParams: params.numParams || (params.modelSpecs && params.modelSpecs.numParams) || 7,
      quantization: params.quantization || 'fp16',
      architecture: params.architecture,
      modelPath: params.model,
    }
    
    workloadSpecs = params.workloadSpecs || {
      expectedConcurrentUsers: params.workload?.concurrentRequests || params.expectedConcurrentUsers || 96, // Balanced default
      averageSequenceLength: params.workload?.averageTokensPerRequest || params.averageSequenceLength || 512,
      maxSequenceLength: params.workload?.maxSeqLen || params.maxSequenceLength || 2048,
      workloadType: params.workloadType || 'serving',
      balanceTarget: params.workloadSpecs?.balanceTarget || params.balanceTarget || 'general',
    }
  }

  const {
    totalVRAMGB,
    memoryBandwidthGBps = 900,
    computeCapability = 8.0,
    tensorCores = true,
    multiGPU = false,
    gpuCount = 1,
  } = gpuSpecs

  const {
    modelSizeGB,
    numParams,
    quantization = 'fp16',
    architecture,
  } = modelSpecs

  const {
    expectedConcurrentUsers = 96,
    averageSequenceLength = 512,
    maxSequenceLength = 2048,
    workloadType = 'serving',
    balanceTarget = 'general',
  } = workloadSpecs

  // Calculate model memory if not provided
  let finalModelSizeGB = modelSizeGB
  if (!finalModelSizeGB && numParams) {
    const modelMemoryInfo = calculateModelWeightsMemory(numParams, quantization)
    finalModelSizeGB = modelMemoryInfo.totalMemory
  }

  if (!finalModelSizeGB) {
    throw new Error('Either modelSizeGB or numParams must be provided')
  }

  // Get model architecture if not provided
  let finalArchitecture = architecture
  if (!finalArchitecture) {
    // Check if modelSpecs has architecture properties directly
    if (modelSpecs.layers && modelSpecs.hiddenSize && modelSpecs.numHeads) {
      finalArchitecture = {
        layers: modelSpecs.layers,
        hiddenSize: modelSpecs.hiddenSize,
        numHeads: modelSpecs.numHeads,
      }
    } else {
      // Estimate architecture from model size
      finalArchitecture = estimateModelArchitecture(numParams || (finalModelSizeGB / 2))
    }
  }

  // Determine balance priority based on target
  const balancePriority = balanceTarget === 'multi-user' ? 'performance' :
                         balanceTarget === 'web-api' || balanceTarget === 'production' ? 'conservative' :
                         'balanced'

  // Calculate balanced memory allocation strategy
  const memoryStrategy = calculateBalancedMemoryStrategy({
    totalVRAMGB,
    modelSizeGB: finalModelSizeGB,
    targetBatchSize: expectedConcurrentUsers,
    workloadType,
    balancePriority,
  })

  // Calculate balanced batch sizes
  const batchConfig = calculateBalancedBatchSize({
    availableMemoryGB: memoryStrategy.allocatedVRAMGB,
    modelMemoryGB: finalModelSizeGB,
    maxSequenceLength,
    averageSequenceLength,
    architecture: finalArchitecture,
    balanceTarget,
  })

  // Estimate balanced performance
  const balancedEstimates = estimateBalancedMetrics(
    {
      maxNumSeqs: batchConfig.maxNumSeqs,
      maxNumBatchedTokens: batchConfig.maxNumBatchedTokens,
      modelSizeGB: finalModelSizeGB,
      quantization,
      maxSequenceLength,
    },
    { memoryBandwidthGBps, computeCapability, tensorCores },
    balancePriority
  )

  // Generate vLLM command line arguments optimized for balance
  const vllmArgs = {
    model: modelSpecs.modelPath || 'MODEL_PATH',
    host: '0.0.0.0',
    port: 8000,
    'gpu-memory-utilization': memoryStrategy.gpuMemoryUtilization,
    'max-num-seqs': batchConfig.maxNumSeqs,
    'max-num-batched-tokens': batchConfig.maxNumBatchedTokens,
    'max-model-len': maxSequenceLength,
    'block-size': memoryStrategy.recommendedBlockSize,
    
    // Balanced optimizations
    ...(memoryStrategy.swapSpaceGB > 0 && { 'swap-space': `${memoryStrategy.swapSpaceGB}GB` }),
    ...(memoryStrategy.enableChunkedPrefill && maxSequenceLength > BALANCED_OPTIMIZATION_CONFIGS.chunkedPrefillThreshold && {
      'enable-chunked-prefill': true,
      'max-chunked-prefill-tokens': BALANCED_OPTIMIZATION_CONFIGS.chunkedPrefillSize
    }),
    ...(quantization !== 'fp16' && { quantization }),
    ...(multiGPU && gpuCount > 1 && { 'tensor-parallel-size': gpuCount }),
    
    // Balanced performance settings
    'disable-log-stats': workloadType === 'batch', // Only for batch workloads
    ...(balancePriority === 'performance' && { 'enforce-eager': false }), // Enable CUDA graphs for performance
  }

  return {
    batchConfiguration: batchConfig,
    memoryConfiguration: memoryStrategy,
    balancedEstimate: balancedEstimates,
    vllmParameters: vllmArgs,
    vllmCommand: generateVLLMCommand(vllmArgs),
    
    optimizationSummary: {
      primaryOptimizations: [
        `Balanced batch size of ${batchConfig.maxNumSeqs} concurrent sequences`,
        `Memory utilization set to ${Math.round(memoryStrategy.gpuMemoryUtilization * 100)}% for stability`,
        `Block size optimized to ${memoryStrategy.recommendedBlockSize} for balanced performance`,
        `Target: ${balanceTarget} with ${balancePriority} priority`,
        `Balance score: ${balancedEstimates.balanceMetrics.overallBalanceScore} (${balancedEstimates.balanceMetrics.performanceClass})`
      ],
      tradeoffs: [
        'Balanced approach sacrifices peak throughput for consistent latency',
        'Conservative memory usage prevents OOM but may limit maximum performance',
        `Moderate batching provides ${balancedEstimates.requestsPerSecond} req/s with ${balancedEstimates.timeToFirstToken}ms TTFT`,
        'Good general-purpose configuration for most production workloads'
      ],
      expectedImprovements: {
        balanceScore: `${Math.round(balancedEstimates.balanceMetrics.overallBalanceScore * 100)}%`,
        throughputPerformance: `${balancedEstimates.tokensPerSecond} tokens/sec`,
        latencyPerformance: `${balancedEstimates.timeToFirstToken}ms TTFT, ${balancedEstimates.interTokenLatency}ms ITL`,
        concurrentCapacity: batchConfig.maxNumSeqs,
        reliabilityClass: balancedEstimates.balanceMetrics.performanceClass
      }
    },
    
    // Balance-specific metrics
    balanceMetrics: balancedEstimates,
    configuration: vllmArgs,
    memoryAllocation: memoryStrategy,
    batchOptimization: batchConfig,
    command: generateVLLMCommand(vllmArgs),
  }
}

/**
 * Optimize configuration for balanced workload patterns
 * @param {object} workloadProfile - Workload characteristics for balanced optimization
 * @returns {object} Balance-specific optimizations
 */
export function optimizeForBalance(workloadProfile) {
  const {
    workloadType = 'serving', // 'general' | 'web-api' | 'multi-user' | 'cost-optimized' | 'production'
    averageInputLength = 256,
    averageOutputLength = 100,
    peakConcurrency = 96,
    performancePriority = 'balanced', // 'throughput' | 'balanced' | 'latency'
    costSensitivity = 'medium', // 'low' | 'medium' | 'high'
    reliabilityRequirement = 'standard', // 'basic' | 'standard' | 'high'
  } = workloadProfile

  const optimizations = {
    recommendedQuantization: 'fp16', // Balanced default
    memoryStrategy: 'balanced',
    batchingStrategy: {},
    balanceSettings: {},
    specialSettings: {},
  }

  // Calculate sequence parameters
  const totalSeqLen = averageInputLength + averageOutputLength
  const maxSeqLen = Math.min(totalSeqLen * 2, 4096) // Allow for 2x variance, cap at 4K
  
  // Determine batch size based on workload type and concurrency
  let targetBatchSize, memoryUtilization, balanceTarget
  
  switch (workloadType) {
    case 'web-api':
      targetBatchSize = Math.min(peakConcurrency, 96) // Conservative for web APIs
      memoryUtilization = 0.80
      balanceTarget = 'web-api'
      break
      
    case 'multi-user':
      targetBatchSize = Math.min(peakConcurrency, 160) // Higher for multi-user systems
      memoryUtilization = 0.90
      balanceTarget = 'multi-user'
      break
      
    case 'cost-optimized':
      targetBatchSize = Math.min(peakConcurrency, 64) // Lower for cost optimization
      memoryUtilization = 0.85
      balanceTarget = 'cost-optimized'
      break
      
    case 'production':
      targetBatchSize = Math.min(peakConcurrency, 96) // Conservative for production
      memoryUtilization = 0.80
      balanceTarget = 'production'
      break
      
    default: // 'general'
      targetBatchSize = Math.min(peakConcurrency, 128)
      memoryUtilization = 0.85
      balanceTarget = 'general'
  }
  
  // Adjust based on performance priority
  if (performancePriority === 'throughput') {
    targetBatchSize = Math.min(targetBatchSize * 1.5, 192)
    memoryUtilization = Math.min(memoryUtilization + 0.05, 0.95)
  } else if (performancePriority === 'latency') {
    targetBatchSize = Math.max(targetBatchSize * 0.7, 32)
    memoryUtilization = Math.max(memoryUtilization - 0.05, 0.75)
  }
  
  // Balanced batching strategy
  optimizations.batchingStrategy = {
    maxSeqLen: maxSeqLen,
    maxNumSeqs: Math.floor(targetBatchSize),
    maxNumBatchedTokens: Math.min(targetBatchSize * (totalSeqLen * 0.8), 6144),
    enableChunkedPrefill: maxSeqLen > 2048,
    adaptiveBatching: performancePriority !== 'latency',
  }

  // Balance-specific settings
  optimizations.balanceSettings = {
    blockSize: performancePriority === 'throughput' ? 24 : 16,
    gpuMemoryUtilization: memoryUtilization,
    swapSpace: costSensitivity === 'high' ? 2 : 4, // GB
    preemptiveScheduling: reliabilityRequirement !== 'high',
    moderateLogging: workloadType === 'production',
  }

  // Cost and reliability adjustments
  if (costSensitivity === 'high') {
    optimizations.recommendedQuantization = 'awq' // Better cost efficiency
    optimizations.balanceSettings.gpuMemoryUtilization = Math.min(memoryUtilization + 0.05, 0.90)
  }
  
  if (reliabilityRequirement === 'high') {
    optimizations.balanceSettings.gpuMemoryUtilization = Math.max(memoryUtilization - 0.05, 0.75)
    optimizations.specialSettings['enforce-eager'] = false // Enable CUDA graphs for stability
  }

  // Special settings based on workload
  switch (workloadType) {
    case 'web-api':
      optimizations.specialSettings['api-key'] = 'PLACEHOLDER'
      optimizations.specialSettings['disable-log-requests'] = false
      break
    case 'multi-user':
      optimizations.specialSettings['enable-prefix-caching'] = true
      break
    case 'cost-optimized':
      optimizations.specialSettings['disable-log-stats'] = true
      break
    case 'production':
      optimizations.specialSettings['disable-log-requests'] = true
      optimizations.specialSettings['max-log-len'] = 100
      break
  }

  return {
    workloadType,
    balanceTarget,
    inputProfile: {
      averageInputLength,
      averageOutputLength,
      peakConcurrency,
      totalSequenceLength: totalSeqLen,
      performancePriority,
      costSensitivity,
      reliabilityRequirement,
    },
    optimizations,
    recommendations: {
      quantization: optimizations.recommendedQuantization,
      memoryUtilization: optimizations.balanceSettings.gpuMemoryUtilization,
      batchConfiguration: optimizations.batchingStrategy,
      balanceFeatures: optimizations.balanceSettings,
      specialFeatures: optimizations.specialSettings,
    },
    reasoning: {
      balanceConsiderations: getBalancedConsiderations(workloadType),
      performancePriority,
      costImpact: costSensitivity,
      reliabilityLevel: reliabilityRequirement,
      expectedBalance: `Targets ${Math.round(targetBatchSize)} concurrent users with balanced ${performancePriority} focus`,
    }
  }
}

/**
 * Get balance-specific considerations for different workload types
 * @param {string} workloadType - Type of workload
 * @returns {string[]} List of balanced considerations
 */
function getBalancedConsiderations(workloadType) {
  const considerations = {
    general: [
      'Balanced configuration suitable for most production workloads',
      'Moderate batch sizes provide good throughput without sacrificing latency',
      'Conservative memory usage ensures stability under varying loads',
    ],
    'web-api': [
      'API-optimized settings for consistent response times',
      'Lower batch sizes prioritize individual request latency',
      'Balanced memory allocation handles variable API traffic',
    ],
    'multi-user': [
      'Higher concurrency support for multiple simultaneous users',
      'Prefix caching beneficial for similar user queries',
      'Performance-focused balance for user experience',
    ],
    'cost-optimized': [
      'Resource-efficient settings to minimize operational costs',
      'Quantization and memory optimization for cost reduction',
      'Balanced performance per dollar spent',
    ],
    'production': [
      'Reliability-focused configuration for production stability',
      'Conservative settings to prevent resource exhaustion',
      'Monitoring and logging optimized for production use',
    ],
    serving: [
      'General serving optimization balancing all factors',
      'Adaptable to various request patterns and loads',
      'Good starting point for most vLLM deployments',
    ]
  }
  
  return considerations[workloadType] || considerations.serving
}
