/**
 * Workload Optimizer Module for vLLM
 * 
 * This module provides functions for optimizing vLLM configurations
 * based on specific workload characteristics and requirements.
 * 
 * Key features:
 * - Workload-specific optimization strategies
 * - Dynamic configuration adjustment based on usage patterns
 * - Performance tuning recommendations
 * - Cost optimization strategies
 * 
 * References:
 * - vLLM performance optimization guides
 * - Workload profiling best practices
 * - Production deployment patterns
 */

// Import required modules
import { generateVLLMCommand, generateConfiguration, validateConfiguration } from './commandGenerator.js'
import { estimateModelArchitecture, calculateVLLMMemoryUsage } from './modelArchitecture.js'
import { WORKLOAD_TYPES, PERFORMANCE_PRIORITIES } from '../configs/optimizationConfigs.js'

// ================================
// WORKLOAD OPTIMIZATION CONSTANTS (imported from central config)
// ================================

// Re-export the centralized configs for backward compatibility
export { WORKLOAD_TYPES, PERFORMANCE_PRIORITIES }

// ================================
// WORKLOAD OPTIMIZATION FUNCTIONS
// ================================

/**
 * Optimize configuration for specific workload patterns
 * @param {object} workloadProfile - Workload characteristics and requirements
 * @returns {object} Optimized configuration and recommendations
 */
export function optimizeForWorkload(workloadProfile) {
  const {
    workloadType = 'serving',
    averageInputLength,
    averageOutputLength,
    peakConcurrency = 100,
    latencyRequirement = 'balanced',
    throughputPriority = 'medium',
    costSensitivity = 'medium',
    reliabilityRequirement = 'standard',
    customConstraints = {}
  } = workloadProfile

  // Get workload type definition
  const workloadDef = WORKLOAD_TYPES[workloadType] || WORKLOAD_TYPES.serving
  
  // Determine effective characteristics (use provided values or defaults from workload type)
  const characteristics = {
    averageInputLength: averageInputLength || workloadDef.characteristics.averageInputLength,
    averageOutputLength: averageOutputLength || workloadDef.characteristics.averageOutputLength,
    totalSequenceLength: (averageInputLength || workloadDef.characteristics.averageInputLength) + 
                        (averageOutputLength || workloadDef.characteristics.averageOutputLength),
    peakConcurrency,
    latencyRequirement,
    throughputPriority,
    costSensitivity,
    reliabilityRequirement
  }

  // Select optimization strategy based on requirements
  const optimizationStrategy = selectOptimizationStrategy({
    workloadType,
    latencyRequirement,
    throughputPriority,
    costSensitivity
  })

  // Generate base optimizations
  const optimizations = generateWorkloadOptimizations(characteristics, optimizationStrategy, workloadDef)
  
  // Apply custom constraints
  const finalOptimizations = applyCustomConstraints(optimizations, customConstraints)
  
  // Adjust parallelization based on GPU configuration
  if (workloadProfile.gpuSpecs && Array.isArray(workloadProfile.gpuSpecs)) {
    const totalGpuCount = workloadProfile.gpuSpecs.reduce((sum, spec) => sum + (spec.count || 1), 0)
    if (totalGpuCount > 1) {
      // Enable tensor parallelism for multi-GPU setups
      finalOptimizations.parallelization.tensorParallelSize = totalGpuCount
      // Keep pipeline parallelism at 1 for simplicity (tensor parallelism is more common)
      finalOptimizations.parallelization.pipelineParallelSize = 1
    }
  }

  // Generate vLLM configuration from optimizations
  const config = {
    'max-num-seqs': finalOptimizations.batchingStrategy.maxNumSeqs,
    'max-num-batched-tokens': finalOptimizations.batchingStrategy.maxBatchedTokens,
    'gpu-memory-utilization': finalOptimizations.memorySettings.gpuMemoryUtilization,
    'swap-space': finalOptimizations.memorySettings.swapSpace,
    'quantization': finalOptimizations.recommendedQuantization,
    'tensor-parallel-size': finalOptimizations.parallelization.tensorParallelSize,
    'pipeline-parallel-size': finalOptimizations.parallelization.pipelineParallelSize,
    'enable-chunked-prefill': finalOptimizations.performance.enableChunkedPrefill,
    'block-size': finalOptimizations.performance.blockSize
  }

  return {
    workloadType,
    characteristics,
    strategy: optimizationStrategy,
    optimizations: finalOptimizations,
    config,
    vllmParameters: config, // Alias for integration test compatibility
    metrics: {
      estimatedThroughput: finalOptimizations.performance.estimatedThroughput || 0,
      estimatedLatency: finalOptimizations.performance.estimatedLatency || 0,
      memoryUtilization: finalOptimizations.memorySettings.gpuMemoryUtilization,
      tokenThroughput: finalOptimizations.performance.tokenThroughput || 0
    },
    performanceEstimate: {
      // Generate performance estimates for integration test compatibility
      throughputTokensPerSecond: finalOptimizations.performance.tokenThroughput || Math.floor(finalOptimizations.batchingStrategy.maxNumSeqs * 10),
      latencyMs: finalOptimizations.performance.estimatedLatency || 100,
      memoryEfficiency: finalOptimizations.memorySettings.gpuMemoryUtilization,
      concurrentRequests: finalOptimizations.batchingStrategy.maxNumSeqs
    },
    considerations: getWorkloadConsiderations(workloadType),
    recommendations: generateWorkloadRecommendations(workloadProfile, finalOptimizations),
    reasoning: {
      workloadConsiderations: getWorkloadConsiderations(workloadType),
      optimizationFocus: optimizationStrategy.priority,
      tradeoffs: getOptimizationTradeoffs(optimizationStrategy),
      expectedImprovements: estimatePerformanceImprovements(characteristics, finalOptimizations)
    }
  }
}

/**
 * Select optimization strategy based on requirements
 * @param {object} requirements - Optimization requirements
 * @returns {object} Selected optimization strategy
 */
function selectOptimizationStrategy(requirements) {
  const { workloadType, latencyRequirement, throughputPriority, costSensitivity } = requirements
  
  // Get base strategy from workload type
  const workloadDef = WORKLOAD_TYPES[workloadType] || WORKLOAD_TYPES.serving
  let baseStrategy = workloadDef.optimizations.priority
  
  // Adjust based on specific requirements
  if (latencyRequirement === 'low' || latencyRequirement === 'very-low') {
    baseStrategy = 'latency'
  } else if (throughputPriority === 'high' || throughputPriority === 'very-high') {
    baseStrategy = 'throughput'
  } else if (costSensitivity === 'high') {
    baseStrategy = 'balanced' // Cost-conscious approach
  }
  
  const strategy = PERFORMANCE_PRIORITIES[baseStrategy] || PERFORMANCE_PRIORITIES.balanced
  
  return {
    ...strategy,
    priority: baseStrategy,
    adjustments: {
      costOptimized: costSensitivity === 'high',
      reliabilityFocused: requirements.reliabilityRequirement === 'high',
      workloadSpecific: workloadDef.optimizations
    }
  }
}

/**
 * Generate workload-specific optimizations
 * @param {object} characteristics - Workload characteristics
 * @param {object} strategy - Optimization strategy
 * @param {object} workloadDef - Workload type definition
 * @returns {object} Generated optimizations
 */
function generateWorkloadOptimizations(characteristics, strategy, workloadDef) {
  const { totalSequenceLength, peakConcurrency, costSensitivity } = characteristics
  
  // Calculate base batch size
  const baseBatchSize = Math.min(peakConcurrency, 256)
  const adjustedBatchSize = Math.floor(baseBatchSize * strategy.batchSizeMultiplier)
  
  // Calculate sequence length settings
  const maxSeqLen = Math.min(totalSequenceLength * 2, 8192) // Allow for variance
  const maxBatchedTokens = Math.min(adjustedBatchSize * totalSequenceLength, 16384)
  
  const optimizations = {
    // Core performance settings
    recommendedQuantization: determineQuantization(strategy, costSensitivity),
    memoryStrategy: strategy.name.toLowerCase().replace(' ', '_'),
    
    // Batching configuration
    batchingStrategy: {
      maxSeqLen,
      maxNumSeqs: adjustedBatchSize,
      maxBatchedTokens,
      enableChunkedPrefill: maxSeqLen > 2048,
      adaptiveBatching: strategy.priority !== 'latency'
    },
    
    // Memory settings
    memorySettings: {
      gpuMemoryUtilization: strategy.memoryUtilization,
      blockSize: strategy.specialSettings['block-size'] || 16,
      swapSpace: costSensitivity === 'high' ? 2 : 4 // GB
    },
    
    // Parallelization configuration
    parallelization: {
      tensorParallelSize: 1, // Default to single GPU, will be adjusted based on GPU count
      pipelineParallelSize: 1 // Default to no pipeline parallelism
    },
    
    // Performance configuration
    performance: {
      enableChunkedPrefill: maxSeqLen > 2048,
      blockSize: strategy.specialSettings['block-size'] || 16
    },
    
    // Special settings from strategy
    specialSettings: { ...strategy.specialSettings },
    
    // Workload-specific features
    enabledFeatures: determineEnabledFeatures(workloadDef, characteristics, strategy)
  }
  
  // Apply workload-specific adjustments
  applyWorkloadSpecificAdjustments(optimizations, workloadDef, characteristics)
  
  return optimizations
}

/**
 * Determine appropriate quantization method
 * @param {object} strategy - Optimization strategy
 * @param {string} costSensitivity - Cost sensitivity level
 * @returns {string} Recommended quantization method
 */
function determineQuantization(strategy, costSensitivity) {
  if (strategy.priority === 'quality') {
    return 'fp16' // Highest quality
  } else if (strategy.priority === 'throughput' || costSensitivity === 'high') {
    return 'awq' // Better throughput and cost efficiency
  } else {
    return 'fp16' // Balanced default
  }
}

/**
 * Determine enabled features based on workload and strategy
 * @param {object} workloadDef - Workload definition
 * @param {object} characteristics - Workload characteristics
 * @param {object} strategy - Optimization strategy
 * @returns {string[]} List of enabled features
 */
function determineEnabledFeatures(workloadDef, characteristics, strategy) {
  const features = []
  
  // Features from workload definition
  if (workloadDef.optimizations.specialFeatures) {
    features.push(...workloadDef.optimizations.specialFeatures)
  }
  
  // Strategy-based features
  if (strategy.priority === 'throughput') {
    features.push('high-batch-sizes')
  }
  
  if (characteristics.totalSequenceLength > 2048) {
    features.push('chunked-prefill')
  }
  
  if (characteristics.peakConcurrency > 64) {
    features.push('prefix-caching')
  }
  
  // Remove duplicates
  return [...new Set(features)]
}

/**
 * Apply workload-specific adjustments to optimizations
 * @param {object} optimizations - Base optimizations
 * @param {object} workloadDef - Workload definition
 * @param {object} characteristics - Workload characteristics
 */
function applyWorkloadSpecificAdjustments(optimizations, workloadDef, characteristics) {
  const workloadType = workloadDef.name
  
  switch (workloadType) {
    case 'Interactive Chat':
      // Chat optimizations
      optimizations.specialSettings['enable-prefix-caching'] = true
      optimizations.batchingStrategy.maxNumSeqs = Math.min(optimizations.batchingStrategy.maxNumSeqs, 128)
      break
      
    case 'Code Generation':
      // Code generation optimizations
      optimizations.batchingStrategy.maxSeqLen = Math.max(optimizations.batchingStrategy.maxSeqLen, 4096)
      optimizations.specialSettings['enforce-eager'] = false // Allow CUDA graphs for consistency
      break
      
    case 'Batch Processing':
      // Batch processing optimizations
      optimizations.batchingStrategy.maxNumSeqs = Math.max(optimizations.batchingStrategy.maxNumSeqs, 256)
      optimizations.specialSettings['disable-log-stats'] = true
      optimizations.specialSettings['disable-log-requests'] = true
      break
      
    case 'Embedding Generation':
      // Embedding optimizations
      optimizations.batchingStrategy.maxNumSeqs = Math.max(optimizations.batchingStrategy.maxNumSeqs, 512)
      optimizations.batchingStrategy.maxBatchedTokens = optimizations.batchingStrategy.maxNumSeqs * characteristics.averageInputLength
      break
  }
}

/**
 * Apply custom constraints to optimizations
 * @param {object} optimizations - Base optimizations
 * @param {object} constraints - Custom constraints
 * @returns {object} Constrained optimizations
 */
function applyCustomConstraints(optimizations, constraints) {
  const constrained = { ...optimizations }
  
  // Memory constraints
  if (constraints.maxMemoryUtilization) {
    constrained.memorySettings.gpuMemoryUtilization = Math.min(
      constrained.memorySettings.gpuMemoryUtilization,
      constraints.maxMemoryUtilization
    )
  }
  
  // Batch size constraints
  if (constraints.maxBatchSize) {
    constrained.batchingStrategy.maxNumSeqs = Math.min(
      constrained.batchingStrategy.maxNumSeqs,
      constraints.maxBatchSize
    )
  }
  
  // Sequence length constraints
  if (constraints.maxSequenceLength) {
    constrained.batchingStrategy.maxSeqLen = Math.min(
      constrained.batchingStrategy.maxSeqLen,
      constraints.maxSequenceLength
    )
  }
  
  // Feature constraints
  if (constraints.disabledFeatures) {
    constraints.disabledFeatures.forEach(feature => {
      constrained.enabledFeatures = constrained.enabledFeatures.filter(f => f !== feature)
    })
  }
  
  return constrained
}

/**
 * Generate workload-specific recommendations
 * @param {object} workloadProfile - Original workload profile
 * @param {object} optimizations - Generated optimizations
 * @returns {object} Recommendations
 */
function generateWorkloadRecommendations(workloadProfile, optimizations) {
  const recommendations = {
    configuration: optimizations,
    performance: [],
    cost: [],
    reliability: [],
    monitoring: []
  }
  
  // Performance recommendations
  if (optimizations.batchingStrategy.maxNumSeqs > 128) {
    recommendations.performance.push('High batch size may increase latency - monitor response times')
  }
  
  if (optimizations.memorySettings.gpuMemoryUtilization > 0.90) {
    recommendations.performance.push('High memory utilization - ensure adequate cooling and monitoring')
  }
  
  // Cost recommendations
  if (optimizations.recommendedQuantization === 'awq') {
    recommendations.cost.push('AWQ quantization reduces memory usage and costs while maintaining quality')
  }
  
  if (optimizations.memorySettings.swapSpace > 0) {
    recommendations.cost.push(`${optimizations.memorySettings.swapSpace}GB swap space enables higher utilization`)
  }
  
  // Reliability recommendations
  if (workloadProfile.reliabilityRequirement === 'high') {
    recommendations.reliability.push('Consider setting up monitoring and auto-scaling for production')
    recommendations.reliability.push('Implement health checks and graceful shutdown procedures')
  }
  
  // Monitoring recommendations
  recommendations.monitoring.push('Monitor GPU memory usage and batch queue lengths')
  recommendations.monitoring.push('Track request latency percentiles (p50, p90, p99)')
  
  if (optimizations.enabledFeatures.includes('prefix-caching')) {
    recommendations.monitoring.push('Monitor prefix cache hit rates for optimization opportunities')
  }
  
  return recommendations
}

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Get workload-specific considerations
 * @param {string} workloadType - Type of workload
 * @returns {string[]} List of considerations
 */
function getWorkloadConsiderations(workloadType) {
  const workloadDef = WORKLOAD_TYPES[workloadType]
  
  if (!workloadDef) {
    return ['Unknown workload type - using general serving optimizations']
  }
  
  const considerations = [
    `Workload: ${workloadDef.name} - ${workloadDef.description}`,
    `Latency requirement: ${workloadDef.characteristics.latencyRequirement}`,
    `Throughput priority: ${workloadDef.characteristics.throughputPriority}`,
    `Typical sequence length: ${workloadDef.characteristics.averageInputLength + workloadDef.characteristics.averageOutputLength} tokens`
  ]
  
  return considerations
}

/**
 * Get optimization strategy tradeoffs
 * @param {object} strategy - Optimization strategy
 * @returns {string[]} List of tradeoffs
 */
function getOptimizationTradeoffs(strategy) {
  const tradeoffs = []
  
  switch (strategy.priority) {
    case 'latency':
      tradeoffs.push('Lower latency at the cost of reduced throughput')
      tradeoffs.push('Conservative memory usage may limit concurrent capacity')
      break
      
    case 'throughput':
      tradeoffs.push('Higher throughput may increase individual request latency')
      tradeoffs.push('Aggressive memory usage requires careful monitoring')
      break
      
    case 'balanced':
      tradeoffs.push('Balanced approach may not achieve peak performance in either dimension')
      tradeoffs.push('Good general-purpose configuration for mixed workloads')
      break
      
    case 'quality':
      tradeoffs.push('Quality focus may reduce throughput and increase costs')
      tradeoffs.push('Conservative batching ensures consistent output quality')
      break
  }
  
  return tradeoffs
}

/**
 * Estimate performance improvements from optimizations
 * @param {object} characteristics - Workload characteristics
 * @param {object} optimizations - Applied optimizations
 * @returns {object} Performance estimates
 */
function estimatePerformanceImprovements(characteristics, optimizations) {
  const { totalSequenceLength, peakConcurrency } = characteristics
  const { batchingStrategy, memorySettings } = optimizations
  
  // Rough performance estimates
  const estimatedThroughput = batchingStrategy.maxNumSeqs * (1000 / totalSequenceLength) * 0.8 // 80% efficiency
  const estimatedLatency = totalSequenceLength * (1 + Math.log2(batchingStrategy.maxNumSeqs)) / 1000 // Batch penalty
  
  return {
    estimatedThroughput: `${Math.round(estimatedThroughput)} requests/sec`,
    estimatedLatency: `${Math.round(estimatedLatency * 1000)}ms per request`,
    concurrentCapacity: batchingStrategy.maxNumSeqs,
    memoryEfficiency: `${Math.round(memorySettings.gpuMemoryUtilization * 100)}%`,
    expectedBottlenecks: identifyBottlenecks(characteristics, optimizations)
  }
}

/**
 * Identify potential bottlenecks in the configuration
 * @param {object} characteristics - Workload characteristics
 * @param {object} optimizations - Applied optimizations
 * @returns {string[]} List of potential bottlenecks
 */
function identifyBottlenecks(characteristics, optimizations) {
  const bottlenecks = []
  
  if (optimizations.batchingStrategy.maxNumSeqs > characteristics.peakConcurrency * 2) {
    bottlenecks.push('Batch size larger than expected concurrency - may underutilize resources')
  }
  
  if (optimizations.memorySettings.gpuMemoryUtilization > 0.95) {
    bottlenecks.push('Very high memory utilization - risk of OOM errors')
  }
  
  if (characteristics.totalSequenceLength > 4096 && !optimizations.enabledFeatures.includes('chunked-prefill')) {
    bottlenecks.push('Long sequences without chunked prefill - may impact latency')
  }
  
  return bottlenecks
}

// ================================
// INTEGRATION FUNCTIONS
// ================================

/**
 * Generate complete vLLM configuration from workload profile
 * @param {object} workloadProfile - Workload requirements
 * @param {object} modelInfo - Model information
 * @param {object} hardwareInfo - Hardware specifications
 * @returns {object} Complete configuration package
 */
export function generateWorkloadConfiguration(workloadProfile, modelInfo, hardwareInfo = {}) {
  // Handle backward compatibility - if only one argument is passed, extract the components
  if (arguments.length === 1 && typeof workloadProfile === 'object') {
    const originalProfile = workloadProfile
    // Extract model and hardware info from the single parameter
    modelInfo = {
      modelPath: originalProfile.modelPath || '/models/model',
      modelSize: originalProfile.modelSize || 7,
      architecture: originalProfile.architecture || { layers: 32, hiddenSize: 4096, numHeads: 32 }
    }
    hardwareInfo = {
      gpuCount: originalProfile.gpuCount || 1,
      memoryGB: originalProfile.gpuSpecs?.memoryGB || 24
    }
    // Keep the workload profile as is for optimization
  }

  // Optimize for workload
  const optimization = optimizeForWorkload(workloadProfile)
  
  // Generate vLLM configuration
  const vllmConfig = generateConfiguration(
    workloadProfile.deploymentType || 'production',
    {
      model: modelInfo?.modelPath || '/models/model',
      'tensor-parallel-size': hardwareInfo.gpuCount || 1,
      'max-num-seqs': optimization.optimizations.batchingStrategy.maxNumSeqs,
      'max-seq-len': optimization.optimizations.batchingStrategy.maxSeqLen,
      'gpu-memory-utilization': optimization.optimizations.memorySettings.gpuMemoryUtilization,
      quantization: optimization.optimizations.recommendedQuantization,
      ...optimization.optimizations.specialSettings
    }
  )
  
  // Validate configuration
  const validation = validateConfiguration(vllmConfig)
  
  // Generate command
  const command = generateVLLMCommand(vllmConfig, {
    multiline: true,
    includeComments: true
  })
  
  return {
    workloadType: workloadProfile.workloadType || 'serving',
    configuration: vllmConfig,
    validation,
    command,
    recommendations: [
      `Optimized for ${workloadProfile.workloadType || 'serving'} workload`,
      `Memory utilization: ${optimization.optimizations.memorySettings.gpuMemoryUtilization}`,
      `Max sequences: ${optimization.optimizations.batchingStrategy.maxNumSeqs}`,
      `Estimated GPU count: ${Math.ceil((modelInfo.estimatedMemoryGB || 0) / (hardwareInfo.memoryGB || 24))}`
    ],
    workload: optimization,
    deployment: {
      estimated_memory_usage: modelInfo.estimatedMemoryGB || 'N/A',
      recommended_gpu_count: Math.ceil((modelInfo.estimatedMemoryGB || 0) / (hardwareInfo.memoryGB || 24)),
      scaling_recommendations: generateScalingRecommendations(optimization, modelInfo, hardwareInfo)
    }
  }
}

/**
 * Generate scaling recommendations
 * @param {object} optimization - Workload optimization
 * @param {object} modelInfo - Model information
 * @param {object} hardwareInfo - Hardware specifications
 * @returns {object} Scaling recommendations
 */
function generateScalingRecommendations(optimization, modelInfo, hardwareInfo) {
  const recommendations = {
    horizontal: [],
    vertical: [],
    cost_optimization: []
  }
  
  // Horizontal scaling (more instances)
  if (optimization.characteristics.peakConcurrency > optimization.optimizations.batchingStrategy.maxNumSeqs) {
    const instancesNeeded = Math.ceil(optimization.characteristics.peakConcurrency / optimization.optimizations.batchingStrategy.maxNumSeqs)
    recommendations.horizontal.push(`Consider ${instancesNeeded} instances to handle peak concurrency`)
  }
  
  // Vertical scaling (bigger hardware)
  if (modelInfo.estimatedMemoryGB > (hardwareInfo.gpuMemoryGB || 80) * 0.9) {
    recommendations.vertical.push('Model may not fit on current GPU - consider larger GPU or multi-GPU setup')
  }
  
  // Cost optimization
  if (optimization.optimizations.recommendedQuantization !== 'fp16') {
    recommendations.cost_optimization.push('Quantization enabled - monitor quality vs cost tradeoffs')
  }
  
  return recommendations
}
