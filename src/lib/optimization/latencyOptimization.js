/**
 * Latency Optimization Module
 * Handles all latency-focused optimization strategies for vLLM
 */

import { 
  calculateKVCacheMemory, 
  calculateActivationMemory, 
  calculateModelWeightsMemory 
} from '../memory/index.js'
import { calculateQuantizationFactor } from '../quantization.js'

// ===============================
// LATENCY OPTIMIZATION CONFIGS
// ===============================

export const LATENCY_OPTIMIZATION_CONFIGS = {
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

// ===============================
// CORE LATENCY OPTIMIZATION FUNCTIONS
// ===============================

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
      // Estimate from parameters - use the function from throughput module
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

// ===============================
// WORKLOAD OPTIMIZATION FUNCTIONS
// ===============================

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

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Estimate model architecture parameters from parameter count
 * @param {number} numParams - Number of parameters in billions
 * @returns {object} Estimated architecture parameters
 */
function estimateModelArchitecture(numParams) {
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
 * Generate vLLM command string from configuration arguments
 * @param {object} args - vLLM arguments object
 * @returns {string} Complete vLLM command
 */
function generateVLLMCommand(args) {
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

// ===============================
// LEGACY FUNCTIONS
// ===============================

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
