/**
 * Memory calculation modules index
 * Exports all memory calculation functions for easier importing
 */

export { 
  calculateKVCacheMemory,
  calculateKVCacheBreakdown,
  estimateOptimalKVCacheBlockSize,
  calculateKVCacheScaling,
  validateKVCacheConfig
} from './kvCache.js'

export { 
  calculateActivationMemory,
  calculateActivationBreakdown,
  calculateActivationScaling,
  calculatePeakActivationMemory,
  optimizeActivationMemory
} from './activations.js'

export { 
  calculateSystemOverhead,
  calculateSystemOverheadBreakdown,
  compareSystemOverheadByGPU,
  calculateMemoryFragmentation,
  optimizeSystemOverhead
} from './systemOverhead.js'

export {
  calculateVRAMBreakdown,
  calculateModelWeightsMemoryFromSize,
  calculateOptimalSwapSpace,
  calculateReservedMemory,
  calculateMemoryEfficiency,
  generateMemoryOptimizationRecommendations
} from './vramBreakdown.js'

// Import from quantization module for model weights
export { 
  calculateModelWeightsMemory
} from '../quantization.js'
