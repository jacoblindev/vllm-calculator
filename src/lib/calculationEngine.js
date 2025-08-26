/**
 * vLLM Memory Calculation Engine - Lightweight Orchestrator
 * 
 * This module serves as the main orchestrator for vLLM memory calculations and optimizations.
 * It coordinates between specialized modules to provide high-level calculation APIs.
 * 
 * Key responsibilities:
 * - Orchestrate memory calculations across different components
 * - Coordinate optimization strategies (throughput, latency, balanced)
 * - Provide unified calculation APIs for the application
 * - Handle configuration generation and validation
 * 
 * References:
 * - vLLM documentation: https://docs.vllm.ai/en/latest/
 * - Memory optimization paper: https://arxiv.org/abs/2309.06180
 */

// ================================
// IMPORTS - Specialized Modules
// ================================

// Memory calculation modules
import {
  calculateVRAMBreakdown,
  calculateModelWeightsMemoryFromSize,
  calculateOptimalSwapSpace,
  calculateMemoryFragmentation,
  calculateReservedMemory,
  calculateMemoryEfficiency,
  getEfficiencyRating,
  analyzeMemoryPressure,
  analyzeQuantizationBenefit,
  generateMemoryOptimizationRecommendations,
  calculateOptimalBatchSizeForVRAM,
  calculateMaxConcurrentSequences
} from './memory/vramBreakdown.js'

import {
  calculateKVCacheMemory,
  calculateKVCacheBreakdown,
  estimateOptimalKVCacheBlockSize,
  calculateKVCacheScaling,
  validateKVCacheConfig
} from './memory/kvCache.js'

import {
  calculateActivationMemory,
  calculateActivationBreakdown,
  calculateActivationScaling,
  calculatePeakActivationMemory,
  optimizeActivationMemory
} from './memory/activations.js'

import {
  calculateSystemOverhead,
  calculateSystemOverheadBreakdown,
  compareSystemOverheadByGPU,
  optimizeSystemOverhead
} from './memory/systemOverhead.js'

// Quantization module
import {
  calculateQuantizationFactor,
  getSupportedQuantizationFormats,
  compareQuantizationFormats,
  estimateQuantizationQualityImpact,
  generateQuantizationRecommendation,
  calculateModelWeightsMemory
} from './quantization.js'

// Validation module
import {
  ValidationError,
  ConfigurationError,
  MemoryError,
  Validators,
  VLLMValidators
} from './validation.js'

// Optimization modules
import {
  THROUGHPUT_OPTIMIZATION_CONFIGS,
  calculateOptimalBatchSize,
  calculateMemoryAllocationStrategy,
  estimateThroughputMetrics,
  calculateThroughputOptimizedConfig
} from './optimization/throughputOptimization.js'

import {
  LATENCY_OPTIMIZATION_CONFIGS,
  calculateLatencyOptimalBatchSize,
  calculateLatencyMemoryStrategy,
  estimateLatencyMetrics,
  calculateLatencyOptimizedConfig,
  optimizeForLatency,
  calculateVRAMUsage,
  canRunOnGPU
} from './optimization/latencyOptimization.js'

import {
  BALANCED_OPTIMIZATION_CONFIGS,
  calculateBalancedBatchSize,
  calculateBalancedMemoryStrategy,
  estimateBalancedMetrics,
  calculateBalancedOptimizedConfig,
  optimizeForBalance,
  getBalancedConsiderations
} from './optimization/balancedOptimization.js'

// Workload management modules
import {
  optimizeForWorkload,
  generateWorkloadConfiguration,
  WORKLOAD_TYPES,
  PERFORMANCE_PRIORITIES
} from './workload/workloadOptimizer.js'

import {
  generateVLLMCommand,
  generateConfiguration,
  validateConfiguration
} from './workload/commandGenerator.js'

import {
  estimateModelArchitecture,
  calculateVLLMMemoryUsage
} from './workload/modelArchitecture.js'

// ================================
// ORCHESTRATION FUNCTIONS
// ================================

/**
 * Calculate comprehensive memory breakdown for a vLLM configuration
 * @param {object} config - Configuration parameters
 * @returns {object} Complete memory analysis
 */
export function calculateComprehensiveMemoryBreakdown(config) {
  const {
    modelSizeGB,
    maxSequenceLength = 2048,
    batchSize = 1,
    architecture,
    quantization = 'fp16',
    gpuMemoryGB,
    optimizationStrategy = 'balanced'
  } = config

  // Basic validation
  if (!modelSizeGB || !architecture || !gpuMemoryGB) {
    throw new ValidationError('modelSizeGB, architecture, and gpuMemoryGB are required')
  }

  // Calculate individual memory components
  const modelWeights = calculateModelWeightsMemory(modelSizeGB, quantization)
  const kvCache = calculateKVCacheMemory(batchSize, maxSequenceLength, architecture.layers, architecture.hiddenSize, architecture.numHeads, quantization)
  const activations = calculateActivationMemory(batchSize, maxSequenceLength, architecture.layers, architecture.hiddenSize, quantization)
  const systemOverhead = calculateSystemOverhead(gpuMemoryGB, batchSize, maxSequenceLength)

  // Calculate VRAM breakdown
  const vramBreakdown = calculateVRAMBreakdown({
    modelWeights: modelWeights.totalMemory,
    kvCache: kvCache.totalMemory,
    activations: activations.totalMemory,
    systemOverhead: systemOverhead.totalMemory,
    availableMemoryGB: gpuMemoryGB
  })

  // Analyze memory efficiency and pressure
  const memoryEfficiency = calculateMemoryEfficiency(vramBreakdown)
  const memoryPressure = analyzeMemoryPressure(vramBreakdown, gpuMemoryGB)
  const quantizationBenefit = analyzeQuantizationBenefit(modelSizeGB, quantization)

  return {
    components: {
      modelWeights,
      kvCache,
      activations,
      systemOverhead
    },
    vramBreakdown,
    analysis: {
      memoryEfficiency,
      memoryPressure,
      quantizationBenefit,
      efficiencyRating: getEfficiencyRating(memoryEfficiency.utilizationPercent)
    },
    recommendations: generateMemoryOptimizationRecommendations(vramBreakdown, memoryPressure, optimizationStrategy)
  }
}

/**
 * Generate optimized configuration based on strategy and constraints
 * @param {object} params - Optimization parameters
 * @returns {object} Optimized configuration
 */
export function generateOptimizedConfiguration(params) {
  const {
    strategy = 'balanced',
    modelSize,
    gpuSpecs,
    workloadType = 'serving',
    constraints = {},
    preferences = {}
  } = params

  // Basic validation
  if (!modelSize || !gpuSpecs) {
    throw new ValidationError('modelSize and gpuSpecs are required parameters')
  }

  // Estimate model architecture if not provided
  const architecture = params.architecture || estimateModelArchitecture(modelSize)

  // Generate base configuration based on strategy
  let optimizedConfig
  switch (strategy) {
    case 'throughput':
      optimizedConfig = calculateThroughputOptimizedConfig({
        modelSize,
        gpuSpecs,
        architecture,
        workloadType,
        constraints
      })
      break
    
    case 'latency':
      optimizedConfig = calculateLatencyOptimizedConfig({
        modelSize,
        gpuSpecs,
        architecture,
        workloadType,
        constraints
      })
      break
    
    case 'balanced':
    default:
      optimizedConfig = calculateBalancedOptimizedConfig({
        modelSize,
        gpuSpecs,
        architecture,
        workloadType,
        constraints
      })
      break
  }

  // Apply workload-specific optimizations
  const workloadOptimized = optimizeForWorkload({
    ...optimizedConfig,
    workloadType,
    architecture,
    preferences
  })

  // Generate vLLM command
  const vllmCommand = generateVLLMCommand(workloadOptimized.config, {
    format: preferences.commandFormat || 'shell',
    includeComments: preferences.includeComments || false
  })

  // Validate final configuration
  const validation = validateConfiguration(workloadOptimized.config)

  return {
    config: workloadOptimized.config,
    optimization: {
      strategy,
      workloadType,
      metrics: workloadOptimized.metrics,
      considerations: workloadOptimized.considerations
    },
    deployment: {
      vllmCommand,
      validation
    },
    memoryAnalysis: calculateComprehensiveMemoryBreakdown({
      modelSizeGB: modelSize,
      maxSequenceLength: workloadOptimized.config['max-model-len'] || 2048,
      batchSize: workloadOptimized.config['max-num-seqs'] || 1,
      architecture,
      quantization: workloadOptimized.config.quantization || 'fp16',
      gpuMemoryGB: gpuSpecs.memoryGB,
      optimizationStrategy: strategy
    })
  }
}

/**
 * Check if a model can run on given GPU configuration
 * @param {object} params - Model and GPU parameters
 * @returns {object} Compatibility analysis
 */
export function checkModelGPUCompatibility(params) {
  const {
    modelSize,
    gpuSpecs,
    maxSequenceLength = 2048,
    batchSize = 1,
    quantization = 'fp16',
    optimizationStrategy = 'balanced'
  } = params

  // Validate input parameters
  if (!modelSize || !gpuSpecs) {
    throw new ValidationError('modelSize and gpuSpecs are required parameters')
  }

  // Estimate model architecture
  const architecture = estimateModelArchitecture(modelSize)

  // Calculate individual memory components (simplified)
  const modelWeights = calculateModelWeightsMemory(modelSize, quantization)
  
  // For now, return basic compatibility check
  const totalModelMemory = modelWeights.totalMemory
  const availableMemory = gpuSpecs.memoryGB
  const compatible = totalModelMemory < (availableMemory * 0.8) // 80% threshold
  
  return {
    compatible,
    modelMemory: totalModelMemory,
    availableMemory,
    utilizationPercent: (totalModelMemory / availableMemory) * 100,
    architecture,
    recommendations: compatible ? ['Configuration looks good'] : ['Consider using quantization or a larger GPU']
  }
}

/**
 * Compare optimization strategies for given configuration
 * @param {object} config - Base configuration
 * @returns {object} Strategy comparison
 */
export function compareOptimizationStrategies(config) {
  const strategies = ['throughput', 'latency', 'balanced']
  const comparisons = {}

  for (const strategy of strategies) {
    try {
      const optimizedConfig = generateOptimizedConfiguration({
        ...config,
        strategy
      })

      comparisons[strategy] = {
        config: optimizedConfig.config,
        metrics: optimizedConfig.optimization.metrics,
        memoryUsage: optimizedConfig.memoryAnalysis.vramBreakdown.totalUsedGB,
        memoryEfficiency: optimizedConfig.memoryAnalysis.analysis.memoryEfficiency.utilizationPercent,
        recommendations: optimizedConfig.recommendations
      }
    } catch (error) {
      comparisons[strategy] = {
        error: error.message,
        viable: false
      }
    }
  }

  return {
    strategies: comparisons,
    recommended: determineRecommendedStrategy(comparisons, config.workloadType || 'serving')
  }
}

/**
 * Determine recommended optimization strategy based on comparisons
 * @param {object} comparisons - Strategy comparison results
 * @param {string} workloadType - Type of workload
 * @returns {string} Recommended strategy
 */
function determineRecommendedStrategy(comparisons, workloadType) {
  const viable = Object.entries(comparisons).filter(([, result]) => !result.error)
  
  if (viable.length === 0) {
    return 'none' // No viable strategies
  }

  // Workload-specific preferences
  const workloadPreferences = {
    'chat': 'latency',
    'completion': 'throughput',
    'code-generation': 'balanced',
    'batch': 'throughput',
    'serving': 'balanced',
    'embedding': 'throughput'
  }

  const preferred = workloadPreferences[workloadType] || 'balanced'

  // Return preferred strategy if viable, otherwise return best viable option
  if (viable.find(([strategy]) => strategy === preferred)) {
    return preferred
  }

  // Fallback to highest efficiency
  return viable.reduce((best, [strategy, result]) => {
    return result.memoryEfficiency > (comparisons[best]?.memoryEfficiency || 0) ? strategy : best
  }, viable[0][0])
}

// ================================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// ================================

// Memory calculation functions
export {
  calculateKVCacheMemory,
  calculateKVCacheBreakdown,
  estimateOptimalKVCacheBlockSize,
  calculateKVCacheScaling,
  validateKVCacheConfig,
  calculateActivationMemory,
  calculateActivationBreakdown,
  calculateActivationScaling,
  calculatePeakActivationMemory,
  optimizeActivationMemory,
  calculateSystemOverhead,
  calculateSystemOverheadBreakdown,
  compareSystemOverheadByGPU,
  optimizeSystemOverhead,
  calculateVRAMBreakdown,
  calculateModelWeightsMemoryFromSize,
  calculateOptimalSwapSpace,
  calculateMemoryFragmentation,
  calculateReservedMemory,
  calculateMemoryEfficiency,
  getEfficiencyRating,
  analyzeMemoryPressure,
  analyzeQuantizationBenefit,
  generateMemoryOptimizationRecommendations,
  calculateOptimalBatchSizeForVRAM,
  calculateMaxConcurrentSequences
}

// Quantization functions
export {
  calculateQuantizationFactor,
  getSupportedQuantizationFormats,
  compareQuantizationFormats,
  estimateQuantizationQualityImpact,
  generateQuantizationRecommendation,
  calculateModelWeightsMemory
}

// Validation functions
export {
  ValidationError,
  ConfigurationError,
  MemoryError,
  Validators,
  VLLMValidators
}

// Optimization functions
export {
  THROUGHPUT_OPTIMIZATION_CONFIGS,
  calculateOptimalBatchSize,
  calculateMemoryAllocationStrategy,
  estimateThroughputMetrics,
  calculateThroughputOptimizedConfig,
  LATENCY_OPTIMIZATION_CONFIGS,
  calculateLatencyOptimalBatchSize,
  calculateLatencyMemoryStrategy,
  estimateLatencyMetrics,
  calculateLatencyOptimizedConfig,
  optimizeForLatency,
  calculateVRAMUsage,
  canRunOnGPU,
  BALANCED_OPTIMIZATION_CONFIGS,
  calculateBalancedBatchSize,
  calculateBalancedMemoryStrategy,
  estimateBalancedMetrics,
  calculateBalancedOptimizedConfig,
  optimizeForBalance,
  getBalancedConsiderations
}

// Workload management functions
export {
  optimizeForWorkload,
  generateWorkloadConfiguration,
  WORKLOAD_TYPES,
  PERFORMANCE_PRIORITIES,
  generateVLLMCommand,
  generateConfiguration,
  validateConfiguration,
  estimateModelArchitecture,
  calculateVLLMMemoryUsage
}
