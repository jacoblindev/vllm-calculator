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
    console.log('hasValidConfiguration check:', { hasGPUs, hasModels, selectedGPUs: gpuStore.selectedGPUs.length, selectedModels: modelStore.selectedModels.length })
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
        
        const weightsMemory = calculateModelWeightsMemory(params, quantization)
        breakdown.modelWeights += weightsMemory
      })

      // Calculate KV cache memory (estimate based on configuration)
      const avgConfig = configurations.value.find(c => c.type === 'balanced') || configurations.value[0]
      if (avgConfig && avgConfig.parameters) {
        const maxSeqsParam = avgConfig.parameters.find(p => p.name === '--max-num-seqs')
        const maxLenParam = avgConfig.parameters.find(p => p.name === '--max-model-len')
        const maxSeqs = parseInt(maxSeqsParam?.value || '16')
        const maxLen = parseInt(maxLenParam?.value || '2048')
        
        modelStore.selectedModels.forEach(model => {
          const params = model.parameters || modelStore.estimateParametersFromSize(model.size)
          const kvMemory = calculateKVCacheMemory(
            params,
            maxSeqs,
            maxLen,
            'fp16', // Assuming fp16 for KV cache
            { numLayers: Math.floor(Math.sqrt(params / 1000000)) } // Rough layer estimation
          )
          breakdown.kvCache += kvMemory
        })
      }

      // Estimate activation memory (roughly 10-20% of model weights)
      breakdown.activations = breakdown.modelWeights * 0.15

      // Estimate system overhead (roughly 5-10% of total VRAM)
      breakdown.systemOverhead = gpuStore.totalVRAM * 0.08

      // Calculate available memory
      const usedMemory = breakdown.modelWeights + breakdown.kvCache + 
                        breakdown.activations + breakdown.systemOverhead
      breakdown.available = Math.max(0, gpuStore.totalVRAM - usedMemory)

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

    const cacheKey = `${gpuStore.totalVRAM}-${modelStore.totalModelSize}-${modelStore.selectedModels.length}`
    if (calculationCache.value.has(cacheKey)) {
      return calculationCache.value.get(cacheKey)
    }

    // Prepare parameters for calculation engine
    const baseParams = {
      totalVRAMGB: gpuStore.totalVRAM,
      modelSizeGB: modelStore.totalModelSize,
      models: modelStore.modelSpecs,
      hardware: gpuStore.hardwareSpecs
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
    if (!engineConfig || !engineConfig.parameters) {
      return generateFallbackConfig(type, title)
    }

    const params = engineConfig.parameters
    const metrics = engineConfig.metrics || {}
    
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
    Object.entries(params).forEach(([key, value]) => {
      if (!uiParameters.some(p => p.name === `--${key}`)) {
        uiParameters.push({
          name: `--${key}`,
          value: value.toString(),
          explanation: `${key.replace(/-/g, ' ')} parameter.`
        })
      }
    })

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
  command: generateVLLMCommand(params).command,
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
      command: '',
      considerations: ['This is a fallback configuration.']
    }

    if (gpuStore.totalGPUCount > 1) {
      baseConfig.parameters.push({
        name: '--tensor-parallel-size',
        value: gpuStore.totalGPUCount.toString(),
        explanation: 'Use all available GPUs for tensor parallelism.'
      })
    }

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
