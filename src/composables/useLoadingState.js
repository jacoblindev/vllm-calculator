/**
 * Global loading state management composable
 * Provides centralized loading state management across the application
 */

import { ref, computed } from 'vue'

// Global loading state
const globalLoadingStates = ref(new Map())
const loadingMessages = ref(new Map())

/**
 * Composable for managing loading states
 * @param {string} namespace - Unique identifier for the loading state
 */
export function useLoadingState(namespace = 'default') {
  // Get or create loading state for this namespace
  if (!globalLoadingStates.value.has(namespace)) {
    globalLoadingStates.value.set(namespace, false)
    loadingMessages.value.set(namespace, '')
  }
  
  const isLoading = computed({
    get: () => globalLoadingStates.value.get(namespace) || false,
    set: (value) => {
      globalLoadingStates.value.set(namespace, value)
      // Clear message when loading ends
      if (!value) {
        loadingMessages.value.set(namespace, '')
      }
    }
  })
  
  const loadingMessage = computed({
    get: () => loadingMessages.value.get(namespace) || '',
    set: (value) => loadingMessages.value.set(namespace, value)
  })
  
  const startLoading = (message = 'Loading...') => {
    isLoading.value = true
    loadingMessage.value = message
  }
  
  const stopLoading = () => {
    isLoading.value = false
    loadingMessage.value = ''
  }
  
  const setLoadingMessage = (message) => {
    loadingMessage.value = message
  }
  
  return {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading,
    setLoadingMessage
  }
}

/**
 * Global loading state computed properties
 */
export function useGlobalLoading() {
  const isAnyLoading = computed(() => {
    return Array.from(globalLoadingStates.value.values()).some(state => state)
  })
  
  const activeLoadingStates = computed(() => {
    const active = []
    for (const [namespace, isLoading] of globalLoadingStates.value) {
      if (isLoading) {
        active.push({
          namespace,
          message: loadingMessages.value.get(namespace) || 'Loading...'
        })
      }
    }
    return active
  })
  
  const clearAllLoading = () => {
    for (const namespace of globalLoadingStates.value.keys()) {
      globalLoadingStates.value.set(namespace, false)
      loadingMessages.value.set(namespace, '')
    }
  }
  
  return {
    isAnyLoading,
    activeLoadingStates,
    clearAllLoading
  }
}

/**
 * Enhanced loading state with retry logic
 * @param {string} namespace 
 * @param {object} options 
 */
export function useLoadingWithRetry(namespace, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 10000
  } = options
  
  const { isLoading, loadingMessage, startLoading, stopLoading } = useLoadingState(namespace)
  const retryCount = ref(0)
  const lastError = ref(null)
  
  const executeWithRetry = async (asyncOperation, loadingMsg = 'Loading...') => {
    let delay = initialDelay
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt === 0) {
          startLoading(loadingMsg)
        } else {
          startLoading(`${loadingMsg} (Retry ${attempt}/${maxRetries})`)
        }
        
        retryCount.value = attempt
        const result = await asyncOperation()
        
        stopLoading()
        retryCount.value = 0
        lastError.value = null
        
        return result
      } catch (error) {
        lastError.value = error
        console.error(`Attempt ${attempt + 1} failed:`, error)
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
          delay = Math.min(delay * backoffMultiplier, maxDelay)
        } else {
          stopLoading()
          throw error
        }
      }
    }
  }
  
  return {
    isLoading,
    loadingMessage,
    retryCount,
    lastError,
    executeWithRetry,
    startLoading,
    stopLoading
  }
}

/**
 * Loading state for data fetching operations
 */
export function useDataLoadingState() {
  const gpuLoading = useLoadingState('gpu-data')
  const modelLoading = useLoadingState('model-data')
  const calculationLoading = useLoadingState('calculations')
  const hfLoading = useLoadingState('huggingface-api')
  
  return {
    gpu: gpuLoading,
    model: modelLoading,
    calculation: calculationLoading,
    huggingface: hfLoading
  }
}
