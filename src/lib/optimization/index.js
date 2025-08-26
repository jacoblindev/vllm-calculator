/**
 * Optimization modules index
 * Exports all optimization strategy functions for easier importing
 */

export {
  calculateThroughputOptimizedConfig,
  calculateOptimalBatchSize,
  calculateMemoryAllocationStrategy,
  estimateThroughputMetrics,
  optimizeForWorkload,
  estimateModelArchitecture,
  calculateVLLMMemoryUsage,
  generateVLLMCommand,
  THROUGHPUT_OPTIMIZATION_CONFIGS
} from './throughputOptimization.js'

export {
  calculateLatencyOptimizedConfig,
  calculateLatencyMemoryStrategy,
  estimateLatencyMetrics,
  optimizeForLatency,
  LATENCY_OPTIMIZATION_CONFIGS
} from './latencyOptimization.js'

export {
  calculateBalancedOptimizedConfig,
  calculateBalancedMemoryStrategy,
  calculateBalanceScore,
  optimizeForBalance,
  BALANCED_OPTIMIZATION_CONFIGS
} from './balancedOptimization.js'
