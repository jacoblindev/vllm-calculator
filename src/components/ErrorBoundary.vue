<template>
  <div v-if="hasError" class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div class="text-center">
          <!-- Error Icon -->
          <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.966-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          
          <!-- Error Title -->
          <h2 class="text-2xl font-bold text-gray-900 mb-2">
            Something went wrong
          </h2>
          
          <!-- Error Message -->
          <p class="text-gray-600 mb-6">
            {{ errorMessage }}
          </p>
          
          <!-- Error Details (Development Mode) -->
          <div v-if="showDetails && errorInfo" class="text-left mb-6">
            <details class="bg-gray-50 rounded-lg p-4 text-sm">
              <summary class="font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                Technical Details
              </summary>
              <pre class="mt-2 text-xs text-gray-600 overflow-auto">{{ errorInfo }}</pre>
            </details>
          </div>
          
          <!-- Action Buttons -->
          <div class="space-y-3">
            <button
              @click="handleReload"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Reload Application
            </button>
            
            <button
              @click="handleRetry"
              class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Try Again
            </button>
            
            <button
              v-if="showReportButton"
              @click="handleReport"
              class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.966-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              Report Issue
            </button>
          </div>
          
          <!-- Helpful Tips -->
          <div class="mt-6 text-left">
            <h3 class="text-sm font-medium text-gray-900 mb-2">What you can try:</h3>
            <ul class="text-sm text-gray-600 space-y-1">
              <li>• Check your internet connection</li>
              <li>• Refresh the page</li>
              <li>• Clear your browser cache</li>
              <li>• Try again in a few minutes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <slot v-else></slot>
</template>

<script setup>
import { ref, onErrorCaptured, nextTick } from 'vue'

// Props
const props = defineProps({
  fallbackMessage: {
    type: String,
    default: 'An unexpected error occurred. Please try refreshing the page.'
  },
  showDetails: {
    type: Boolean,
    default: import.meta.env.DEV // Show details in development mode
  },
  showReportButton: {
    type: Boolean,
    default: false
  },
  onRetry: {
    type: Function,
    default: null
  },
  onReport: {
    type: Function,
    default: null
  }
})

// Emits
const emit = defineEmits(['error', 'retry', 'report'])

// State
const hasError = ref(false)
const errorMessage = ref('')
const errorInfo = ref('')
const retryCount = ref(0)
const maxRetries = ref(3)

// Error handler
onErrorCaptured((error, instance, info) => {
  hasError.value = true
  
  // Format error message
  if (error.message) {
    errorMessage.value = error.message
  } else {
    errorMessage.value = props.fallbackMessage
  }
  
  // Capture error details for debugging
  if (props.showDetails) {
    errorInfo.value = `Error: ${error.toString()}\n\nComponent: ${instance?.$options?.name || 'Unknown'}\nInfo: ${info}\n\nStack: ${error.stack}`
  }
  
  // Log error for monitoring
  console.error('ErrorBoundary caught error:', error)
  console.error('Error info:', info)
  console.error('Component instance:', instance)
  
  // Emit error event
  emit('error', { error, instance, info })
  
  // Prevent the error from propagating further
  return false
})

// Action handlers
const handleReload = () => {
  window.location.reload()
}

const handleRetry = async () => {
  if (retryCount.value >= maxRetries.value) {
    errorMessage.value = 'Maximum retry attempts reached. Please reload the page.'
    return
  }
  
  retryCount.value++
  
  try {
    // If custom retry handler provided, use it
    if (props.onRetry) {
      await props.onRetry()
    }
    
    // Reset error state
    hasError.value = false
    errorMessage.value = ''
    errorInfo.value = ''
    
    // Wait for next tick to ensure clean state
    await nextTick()
    
    emit('retry', { retryCount: retryCount.value })
  } catch (retryError) {
    console.error('Retry failed:', retryError)
    errorMessage.value = 'Retry failed. Please try reloading the page.'
  }
}

const handleReport = () => {
  const reportData = {
    error: errorMessage.value,
    details: errorInfo.value,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString()
  }
  
  if (props.onReport) {
    props.onReport(reportData)
  }
  
  emit('report', reportData)
  
  // Default action: copy error details to clipboard
  const reportText = `vLLM Calculator Error Report
  
Error: ${errorMessage.value}
Time: ${new Date().toLocaleString()}
URL: ${window.location.href}
Browser: ${navigator.userAgent}

Technical Details:
${errorInfo.value}
`
  
  navigator.clipboard.writeText(reportText).then(() => {
    // Show success notification
    console.log('Error details copied to clipboard')
    errorMessage.value = 'Error details copied to clipboard. Please paste this information when reporting the issue.'
  }).catch(() => {
    console.error('Failed to copy error details to clipboard')
    errorMessage.value = 'Failed to copy to clipboard. Please manually copy the error details from the Technical Details section.'
  })
}

// Reset function for external use
const resetError = () => {
  hasError.value = false
  errorMessage.value = ''
  errorInfo.value = ''
  retryCount.value = 0
}

// Expose methods
defineExpose({
  resetError,
  hasError: hasError.value
})
</script>
