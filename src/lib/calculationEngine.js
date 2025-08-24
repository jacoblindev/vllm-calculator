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
 * Calculate model weights memory usage
 * @param {number} numParams - Number of parameters in billions (e.g., 7 for 7B)
 * @param {string} precision - Model precision ('fp16', 'fp32', 'int8', 'int4')
 * @returns {number} Model weights memory in GB
 */
export function calculateModelWeightsMemory(numParams, precision = 'fp16') {
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
  const modelWeights = modelSizeGB || calculateModelWeightsMemory(numParams, modelPrecision)
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
