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

// Import VRAM breakdown functionality from dedicated module
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

// Import memory calculation functionality from dedicated modules
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

// Import quantization functionality from dedicated module
import {
  calculateQuantizationFactor,
  getSupportedQuantizationFormats,
  compareQuantizationFormats,
  estimateQuantizationQualityImpact,
  generateQuantizationRecommendation,
  calculateModelWeightsMemory
} from './quantization.js'

// Import validation functionality from dedicated module
import {
  ValidationError,
  ConfigurationError,
  MemoryError,
  Validators,
  VLLMValidators
} from './validation.js'

// ================================
// THROUGHPUT OPTIMIZATION FUNCTIONS
// ================================

/**
 * Optimal batch size configuration for throughput
 * Based on vLLM documentation for max_num_seqs and max_num_batched_tokens
 */
// Import throughput optimization functions
import {
  THROUGHPUT_OPTIMIZATION_CONFIGS,
  calculateOptimalBatchSize,
  calculateMemoryAllocationStrategy,
  estimateThroughputMetrics,
  calculateThroughputOptimizedConfig
} from './optimization/throughputOptimization.js'

// Import workload management functions
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

// Import latency optimization functions
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

// Import balanced optimization functions
import {
  BALANCED_OPTIMIZATION_CONFIGS,
  calculateBalancedBatchSize,
  calculateBalancedMemoryStrategy,
  estimateBalancedMetrics,
  calculateBalancedOptimizedConfig,
  optimizeForBalance,
  getBalancedConsiderations
} from './optimization/balancedOptimization.js'

// Re-export throughput optimization functions to maintain backward compatibility
export {
  THROUGHPUT_OPTIMIZATION_CONFIGS,
  calculateOptimalBatchSize,
  calculateMemoryAllocationStrategy,
  estimateThroughputMetrics,
  calculateThroughputOptimizedConfig
}

// Re-export workload management functions to maintain backward compatibility
export {
  optimizeForWorkload,
  generateWorkloadConfiguration,
  WORKLOAD_TYPES,
  PERFORMANCE_PRIORITIES
}

export {
  generateVLLMCommand,
  generateConfiguration,
  validateConfiguration
}

export {
  estimateModelArchitecture,
  calculateVLLMMemoryUsage
}

// Re-export latency optimization functions to maintain backward compatibility
export {
  LATENCY_OPTIMIZATION_CONFIGS,
  calculateLatencyOptimalBatchSize,
  calculateLatencyMemoryStrategy,
  estimateLatencyMetrics,
  calculateLatencyOptimizedConfig,
  optimizeForLatency,
  calculateVRAMUsage,
  canRunOnGPU
}

// Re-export balanced optimization functions to maintain backward compatibility
export {
  BALANCED_OPTIMIZATION_CONFIGS,
  calculateBalancedBatchSize,
  calculateBalancedMemoryStrategy,
  estimateBalancedMetrics,
  calculateBalancedOptimizedConfig,
  optimizeForBalance,
  getBalancedConsiderations
}

// Re-export memory calculation functions to maintain backward compatibility
export {
  calculateKVCacheMemory,
  calculateKVCacheBreakdown,
  estimateOptimalKVCacheBlockSize,
  calculateKVCacheScaling,
  validateKVCacheConfig
} from './memory/kvCache.js'

export {
  calculateActivationMemory,
  calculateActivationBreakdown,
  calculateActivationScaling,
  calculatePeakActivationMemory,
  optimizeActivationMemory
} from './memory/activations.js'

export {
  calculateSystemOverhead,
  calculateSystemOverheadBreakdown,
  compareSystemOverheadByGPU,
  optimizeSystemOverhead
} from './memory/systemOverhead.js'
