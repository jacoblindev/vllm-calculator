/**
 * Throughput Optimization Module
 * Handles all throughput-focused optimization strategies for vLLM
 */

import { 
  calculateKVCacheMemory, 
  calculateActivationMemory, 
  calculateModelWeightsMemory 
} from '../memory/index.js'
import { calculateQuantizationFactor } from '../quantization.js'

// ===============================
// THROUGHPUT OPTIMIZATION CONFIGS
// ===============================

export const THROUGHPUT_OPTIMIZATION_CONFIGS = {
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

// ===============================
// CORE THROUGHPUT OPTIMIZATION FUNCTIONS
// ===============================

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

// ===============================
// WORKLOAD OPTIMIZATION FUNCTIONS
// ===============================

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

// ===============================
// UTILITY FUNCTIONS
// ===============================

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

/**
 * Generate vLLM command string from configuration arguments
 * @param {object} args - vLLM arguments object
 * @returns {string} Complete vLLM command
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
