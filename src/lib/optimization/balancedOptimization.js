/**
 * Balanced Optimization Module for vLLM
 * 
 * This module provides balanced optimization strategies that aim to find the optimal
 * trade-off between throughput and latency for general-purpose production workloads.
 * 
 * Key features:
 * - Moderate batch sizes for stable performance
 * - Conservative memory utilization for reliability
 * - Workload-specific optimization targets
 * - Balance between cost efficiency and performance
 * 
 * References:
 * - vLLM optimization best practices
 * - Production deployment patterns
 */

// Import required calculation functions
import { calculateKVCacheMemory } from '../memory/kvCache.js'
import { calculateActivationMemory } from '../memory/activations.js'
import { calculateQuantizationFactor, calculateModelWeightsMemory } from '../quantization.js'
import { Validators, VLLMValidators, ValidationError } from '../validation.js'
import { estimateModelArchitecture } from './throughputOptimization.js'
import { generateVLLMCommand } from './throughputOptimization.js'

// ================================
// BALANCED OPTIMIZATION CONFIGURATIONS
// ================================

/**
 * Configuration constants for balanced optimization strategies
 */
export const BALANCED_OPTIMIZATION_CONFIGS = {
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

// ================================
// BALANCED OPTIMIZATION FUNCTIONS
// ================================

/**
 * Calculate optimal batch size for balanced performance
 * @param {object} config - Configuration parameters
 * @param {number} config.availableMemoryGB - Available GPU memory in GB
 * @param {number} config.modelMemoryGB - Model memory usage in GB
 * @param {number} config.maxSequenceLength - Maximum sequence length
 * @param {number} config.averageSequenceLength - Average expected sequence length
 * @param {object} config.architecture - Model architecture info
 * @param {string} config.balanceTarget - Target workload type for optimization
 * @returns {object} Optimized batch configuration for balanced performance
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
  // Validate input parameters
  Validators.object(params, [], 'params')
  
  // Handle both structured and flat parameter styles
  let gpuSpecs, modelSpecs, workloadSpecs
  
  if (params.gpuSpecs && params.modelSpecs) {
    // Structured style - validate sub-objects
    VLLMValidators.gpuSpecs(params.gpuSpecs)
    VLLMValidators.modelSpecs(params.modelSpecs)
    
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
    // Validate required fields are present
    if (!params.modelSizeGB && !params.numParams) {
      throw new ValidationError('Either modelSizeGB or numParams must be provided', 'params', params)
    }
    
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

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Get balance-specific considerations for different workload types
 * @param {string} workloadType - Type of workload
 * @returns {string[]} List of balanced considerations
 */
export function getBalancedConsiderations(workloadType) {
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
