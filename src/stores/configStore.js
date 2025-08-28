import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGpuStore } from './gpuStore.js'
import { useModelStore } from './modelStore.js'
import {
  calculateThroughputOptimizedConfig,
  calculateBalancedOptimizedConfig,
  calculateKVCacheMemory,
  calculateVLLMMemoryUsage,
  estimateThroughputMetrics,
  estimateLatencyMetrics,
  calculateMemoryAllocationStrategy,
  generateVLLMCommand
} from '../lib/calculationEngine.js'
import {
  calculateModelWeightsMemory,
  generateQuantizationRecommendation,
  calculateQuantizationFactor
} from '../lib/quantization.js'

export const useConfigStore = defineStore('config', () => {
  // State
  const loading = ref(false)
  const error = ref(null)
  const calculationCache = ref(new Map())

  // Access other stores
  const gpuStore = useGpuStore()
  const modelStore = useModelStore()

  // Getters
  const hasValidConfiguration = computed(() => {
    const hasGPUs = gpuStore.selectedGPUs.length > 0
    const hasModels = modelStore.selectedModels.length > 0
    return hasGPUs && hasModels
  })

  const configurationStep = computed(() => {
    if (gpuStore.selectedGPUs.length === 0) return 'gpu'
    if (modelStore.selectedModels.length === 0) return 'model'
    return 'complete'
  })

  const setupProgress = computed(() => {
    const steps = ['gpu', 'model', 'complete']
    const currentStepIndex = steps.indexOf(configurationStep.value)
    return Math.min(100, ((currentStepIndex + 1) / steps.length) * 100)
  })

  const memoryPressure = computed(() => {
    if (gpuStore.totalVRAM === 0) return 'unknown'
    const ratio = modelStore.totalModelSize / gpuStore.totalVRAM
    if (ratio > 0.9) return 'critical'
    if (ratio > 0.8) return 'high'
    if (ratio > 0.6) return 'moderate'
    return 'low'
  })

  // VRAM Breakdown calculation
  const vramBreakdown = computed(() => {
    if (!hasValidConfiguration.value) return null

    try {
      const breakdown = {
        modelWeights: 0,
        kvCache: 0,
        activations: 0,
        systemOverhead: 0,
        available: 0
      }

      // Calculate model weights memory for each selected model
      modelStore.selectedModels.forEach(model => {
        const params = model.parameters || modelStore.estimateParametersFromSize(model.size)
        const quantization = model.quantization || 'fp16'
        
        try {
          const weightsMemory = calculateModelWeightsMemory(params, quantization)
          if (weightsMemory && typeof weightsMemory.totalMemory === 'number' && weightsMemory.totalMemory > 0) {
            breakdown.modelWeights += weightsMemory.totalMemory
          } else {
            console.warn('Invalid VRAM breakdown value for modelWeights:', weightsMemory?.totalMemory)
            // Fallback calculation
            breakdown.modelWeights += (model.size || 7) * 2 // Rough estimate: size * 2 for fp16
          }
        } catch (error) {
          console.warn('Error calculating model weights memory:', error)
          breakdown.modelWeights += (model.size || 7) * 2 // Fallback
        }
      })

      // Calculate KV cache memory (estimate based on a reasonable default)
      if (modelStore.selectedModels && modelStore.selectedModels.length > 0) {
        const primaryModel = modelStore.selectedModels[0];
        const params = primaryModel.parameters || modelStore.estimateParametersFromSize(primaryModel.size);
        const estimatedLayers = Math.floor(Math.sqrt(params / 1000000)) || 32;
        const estimatedHiddenSize = Math.floor(Math.pow(params / estimatedLayers, 0.33)) || 4096;
        const estimatedHeads = Math.max(1, Math.floor(estimatedHiddenSize / 128)) || 32;
        
        try {
          const kvMemory = calculateKVCacheMemory(
            32,       // A reasonable default batch size for estimation
            2048,     // A reasonable default max sequence length
            estimatedLayers,
            estimatedHiddenSize,
            estimatedHeads,
            'fp16'
          );
          breakdown.kvCache = kvMemory;
        } catch (error) {
          console.warn('Error calculating KV cache memory, using fallback:', error);
          breakdown.kvCache = (params * 0.1) / 1e9; // Fallback: 10% of params in GB
        }
      }

      // Estimate activation memory (roughly 10-20% of model weights)
      if (breakdown.modelWeights > 0) {
        breakdown.activations = breakdown.modelWeights * 0.15
      } else {
        console.warn('Invalid VRAM breakdown value for activations: modelWeights is', breakdown.modelWeights)
        breakdown.activations = 1.0 // Fallback minimum
      }

      // Estimate system overhead (roughly 5-10% of total VRAM)
      breakdown.systemOverhead = gpuStore.totalVRAM * 0.08

      // Calculate available memory
      const usedMemory = breakdown.modelWeights + breakdown.kvCache + 
                        breakdown.activations + breakdown.systemOverhead
      breakdown.available = Math.max(0, gpuStore.totalVRAM - usedMemory)
      
      if (breakdown.available < 0 || isNaN(breakdown.available)) {
        console.warn('Invalid VRAM breakdown value for available:', breakdown.available)
        breakdown.available = Math.max(0, gpuStore.totalVRAM * 0.1) // At least 10% should be available
      }

      // Ensure all values are valid numbers
      Object.keys(breakdown).forEach(key => {
        if (typeof breakdown[key] !== 'number' || isNaN(breakdown[key])) {
          console.warn(`Invalid VRAM breakdown value for ${key}:`, breakdown[key])
          breakdown[key] = 0
        }
      })

      return breakdown
    } catch (error) {
      console.error('Error calculating VRAM breakdown:', error)
      
      // Fallback calculation
      const modelMemory = modelStore.totalModelSize
      const kvCache = modelMemory * 0.3 // Rough estimate
      const activations = modelMemory * 0.15
      const systemOverhead = gpuStore.totalVRAM * 0.08
      const available = Math.max(0, gpuStore.totalVRAM - modelMemory - kvCache - activations - systemOverhead)

      return {
        modelWeights: modelMemory,
        kvCache,
        activations,
        systemOverhead,
        available
      }
    }
  })

  // Configuration generation
  const configurations = computed(() => {
    if (!hasValidConfiguration.value) return []

    const cacheKey = `${gpuStore.totalVRAM}-${modelStore.totalModelSize}-${modelStore.selectedModels?.length || 0}`
    if (calculationCache.value.has(cacheKey)) {
      return calculationCache.value.get(cacheKey)
    }

    // Prepare parameters for calculation engine
    const primaryModel = modelStore.selectedModels?.[0]
    const baseParams = {
      totalVRAMGB: gpuStore.totalVRAM,
      modelSizeGB: modelStore.totalModelSize,
      models: modelStore.modelSpecs,
      hardware: gpuStore.hardwareSpecs,
      model: primaryModel?.hf_id || primaryModel?.name || 'MODEL_PATH',
      // Always set tensor-parallel-size for calculation engine
      'tensor-parallel-size': gpuStore.totalGPUCount > 0 ? gpuStore.totalGPUCount : 1
    }

    try {
      // Generate optimized configurations using calculation engine
      const throughputConfig = calculateThroughputOptimizedConfig({
        ...baseParams,
        optimizationTarget: 'throughput',
        maxSequenceLength: 2048,
        prioritizeMemoryEfficiency: false
      })
      
      const latencyConfig = calculateBalancedOptimizedConfig({
        ...baseParams,
        optimizationTarget: 'latency',
        maxSequenceLength: 4096,
        balanceTarget: 'latency'
      })
      
      const balancedConfig = calculateBalancedOptimizedConfig({
        ...baseParams,
        optimizationTarget: 'balanced',
        maxSequenceLength: 3072,
        balanceTarget: 'general'
      })

      // Transform calculation engine output to UI format
      const configs = [
        transformConfigToUI(throughputConfig, 'throughput', 'Maximum Throughput'),
        transformConfigToUI(latencyConfig, 'latency', 'Minimum Latency'),
        transformConfigToUI(balancedConfig, 'balanced', 'Balanced Performance')
      ]

      // Only log debug info if VITE_DEBUG is set (for Vite projects)
      if (import.meta.env && import.meta.env.VITE_DEBUG) {
        console.log('Generated UI Configurations:', JSON.stringify(configs, null, 2));
      }

      // Cache the result
      calculationCache.value.set(cacheKey, configs)
      
      return configs
    } catch (error) {
      console.error('Error generating configurations with calculation engine:', error)
      
      // Fallback to basic configurations if engine fails
      return generateFallbackConfigurations(gpuStore.totalVRAM, modelStore.totalModelSize)
    }
  })

  // Quantization recommendations
  const quantizationRecommendations = computed(() => {
    if (!hasValidConfiguration.value) return []

    try {
      const recommendations = []
      
      modelStore.selectedModels.forEach(model => {
        if (model.size && model.size > 0) {
          const recommendation = generateQuantizationRecommendation(
            gpuStore.totalVRAM,
            model.parameters || modelStore.estimateParametersFromSize(model.size),
            {
              modelName: model.name,
              targetMemoryUtilization: 0.85,
              qualityTolerance: 'medium'
            }
          )
          
          if (recommendation) {
            // Calculate memory savings based on current vs recommended format
            const currentFormat = model.quantization || 'fp16'
            const currentQuantInfo = calculateQuantizationFactor(currentFormat)
            const recommendedQuantInfo = calculateQuantizationFactor(recommendation.recommendedFormat)
            
            // Estimate model weights memory with current vs recommended quantization
            const baseMemory = (model.size || model.parameters || 7) * 2 // Base fp16 memory in GB
            const currentMemory = baseMemory * currentQuantInfo.memoryFactor
            const recommendedMemory = baseMemory * recommendedQuantInfo.memoryFactor
            const memorySavings = Math.max(0, currentMemory - recommendedMemory)
            
            recommendations.push({
              modelName: model.name,
              currentFormat: currentFormat,
              recommendedFormat: recommendation.recommendedFormat,
              memorySavings: memorySavings,
              qualityImpact: recommendation.qualityImpact,
              reason: recommendation.reason
            })
          }
        }
      })

      return recommendations
    } catch (error) {
      console.error('Error generating quantization recommendations:', error)
      return []
    }
  })

  // Configuration health analysis
  const configurationHealth = computed(() => {
    const issues = []
    
    if (memoryPressure.value === 'critical') {
      issues.push('Critical memory pressure - models may not fit')
    }
    
    if (gpuStore.totalGPUCount > 16) {
      issues.push('Excessive GPU count may impact performance')
    }

    if (modelStore.totalModelSize > gpuStore.totalVRAM * 0.9) {
      issues.push('Model size approaching VRAM limits')
    }
    
    // Determine status: critical if excessive GPUs or multiple issues
    let status = 'healthy'
    if (gpuStore.totalGPUCount > 16) {
      status = 'critical'
    } else if (issues.length > 0) {
      status = issues.length === 1 ? 'warning' : 'critical'
    }
    
    return {
      status,
      issues
    }
  })

  // State analysis
  const stateAnalysis = computed(() => {
    return {
      isComplete: hasValidConfiguration.value,
      gpuCount: gpuStore.totalGPUCount,
      modelCount: modelStore.modelCount,
      memoryEfficiency: gpuStore.totalVRAM > 0 ? (modelStore.totalModelSize / gpuStore.totalVRAM) : 0,
      hasCustomGPUs: gpuStore.hasCustomGPUs,
      hasMultipleModels: modelStore.hasMultipleModels,
      estimatedCost: gpuStore.estimatedCost,
      memoryPressure: memoryPressure.value
    }
  })

  // Actions
  const clearCache = () => {
    calculationCache.value.clear()
  }

  const setLoading = (isLoading) => {
    loading.value = isLoading
  }

  const setError = (errorMessage) => {
    error.value = errorMessage
  }

  const recalculate = () => {
    clearCache()
    // Trigger reactive recalculation by accessing computed properties
    return {
      configurations: configurations.value,
      vramBreakdown: vramBreakdown.value,
      quantizationRecommendations: quantizationRecommendations.value
    }
  }

  // Helper functions
  const transformConfigToUI = (engineConfig, type, title) => {
    if (!engineConfig || (!engineConfig.parameters && !engineConfig.vllmParameters)) {
      return generateFallbackConfig(type, title)
    }

    const params = engineConfig.parameters || engineConfig.vllmParameters || {}
    const metrics = engineConfig.metrics || engineConfig.performanceEstimate || {}

    // Force tensor-parallel-size for multi-GPU scenarios
    const gpuCount = typeof params['tensor-parallel-size'] === 'number' ? params['tensor-parallel-size'] : 1;
    if (gpuStore.totalGPUCount > 1 && !params['tensor-parallel-size']) {
      params['tensor-parallel-size'] = gpuStore.totalGPUCount;
    }

    // Map calculation engine parameters to UI format
    const uiParameters = [
      {
        name: '--gpu-memory-utilization',
        value: params['gpu-memory-utilization'] || '0.85',
        explanation: engineConfig.explanations?.find(e => e.includes('memory utilization'))?.text || 
                     'GPU memory utilization for optimal performance.'
      },
      {
        name: '--max-model-len',
        value: params['max-model-len'] || '2048',
        explanation: 'Maximum sequence length that can be processed.'
      },
      {
        name: '--max-num-seqs',
        value: params['max-num-seqs'] || '256',
        explanation: 'Maximum number of sequences processed concurrently.'
      },
      {
        name: '--tensor-parallel-size',
        value: params['tensor-parallel-size'] || '1',
        explanation: 'Number of GPUs to use for tensor parallelism.'
      }
    ]

    // Add additional parameters if they exist
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([key, value]) => {
        if (!uiParameters.some(p => p.name === `--${key}`)) {
          uiParameters.push({
            name: `--${key}`,
            value: value?.toString() || '',
            explanation: `${key.replace(/-/g, ' ')} parameter.`
          })
        }
      })
    }

    return {
      type,
      title,
      description: engineConfig.description || `Optimized for ${type} performance.`,
      parameters: uiParameters,
      metrics: {
        throughput: metrics.throughput || 'N/A',
        latency: metrics.latency || 'N/A',
        memoryUsage: metrics.memoryUsage || 'N/A'
      },
      command: engineConfig.command || engineConfig.vllmCommand || (() => {
        const result = generateVLLMCommand(params)
        return result.command
      })(),
      considerations: engineConfig.considerations || []
    }
  }

  const generateFallbackConfig = (type, title) => {
    const baseConfig = {
      type,
      title,
      description: `Basic ${type} configuration.`,
      parameters: [
        {
          name: '--gpu-memory-utilization',
          value: '0.85',
          explanation: 'GPU memory utilization.'
        },
        {
          name: '--max-model-len',
          value: type === 'latency' ? '4096' : '2048',
          explanation: 'Maximum sequence length.'
        },
        {
          name: '--max-num-seqs',
          value: type === 'throughput' ? '512' : '128',
          explanation: 'Maximum concurrent sequences.'
        }
      ],
      metrics: {
        throughput: 'Estimated',
        latency: 'Estimated',
        memoryUsage: 'Estimated'
      },
      considerations: ['This is a fallback configuration.']
    }

    // Always set tensor-parallel-size, default to 1 if not present
    baseConfig.parameters.push({
      name: '--tensor-parallel-size',
      value: (gpuStore.totalGPUCount > 0 ? gpuStore.totalGPUCount : 1).toString(),
      explanation: 'Number of GPUs to use for tensor parallelism.'
    })

    // Now assign the command property after baseConfig is initialized
    const params = {}
    baseConfig.parameters.forEach(param => {
      // Use hyphenated keys for command generator compatibility
      const key = param.name.replace(/^--/, '')
      params[key] = param.value
    })
    // Force tensor-parallel-size to be present
    if (!('tensor-parallel-size' in params)) {
      params['tensor-parallel-size'] = '1';
    }
    const primaryModel = modelStore.selectedModels?.[0]
    params.model = primaryModel?.hf_id || primaryModel?.name || 'MODEL_PATH'
    const result = generateVLLMCommand(params)
    baseConfig.command = result.command

    return baseConfig
  }

  const generateFallbackConfigurations = (totalVRAM, totalModelSize) => {
    return [
      generateFallbackConfig('throughput', 'Maximum Throughput'),
      generateFallbackConfig('latency', 'Minimum Latency'),
      generateFallbackConfig('balanced', 'Balanced Performance')
    ]
  }

  return {
    // State
    loading,
    error,
    
    // Getters
    hasValidConfiguration,
    configurationStep,
    setupProgress,
    memoryPressure,
    vramBreakdown,
    configurations,
    quantizationRecommendations,
    configurationHealth,
    stateAnalysis,
    
    // Actions
    clearCache,
    setLoading,
    setError,
    recalculate
  }
})
