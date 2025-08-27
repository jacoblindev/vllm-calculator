<template>
  <!-- Global Loading Overlay -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-300"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showGlobalLoading"
        class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
        @click.self="handleBackgroundClick"
      >
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4 min-w-[300px]">
          <!-- Loading Animation -->
          <div class="flex items-center justify-center mb-4">
            <div class="relative">
              <!-- Main spinner -->
              <div class="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <!-- Inner pulse -->
              <div class="absolute inset-2 w-8 h-8 bg-blue-100 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          <!-- Loading Message -->
          <div class="text-center">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">
              {{ currentLoadingTitle }}
            </h3>
            <p class="text-gray-600 text-sm mb-4">
              {{ currentLoadingMessage }}
            </p>
            
            <!-- Progress indicator for multiple loading states -->
            <div v-if="activeStates.length > 1" class="mb-4">
              <div class="text-xs text-gray-500 mb-2">
                {{ currentStateIndex + 1 }} of {{ activeStates.length }} operations
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div 
                  class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  :style="{ width: `${((currentStateIndex + 1) / activeStates.length) * 100}%` }"
                ></div>
              </div>
            </div>
            
            <!-- Cancel button for long operations -->
            <button
              v-if="showCancelButton && showCancel"
              @click="handleCancel"
              class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  
  <!-- Inline Loading States -->
  <div class="space-y-2">
    <Transition
      v-for="state in inlineStates"
      :key="state.namespace"
      enter-active-class="transition-all duration-300"
      enter-from-class="opacity-0 transform scale-95"
      enter-to-class="opacity-100 transform scale-100"
      leave-active-class="transition-all duration-300"
      leave-from-class="opacity-100 transform scale-100"
      leave-to-class="opacity-0 transform scale-95"
    >
      <div v-if="state" class="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
        <div class="flex-shrink-0 mr-3">
          <div class="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-blue-900">
            {{ getStateTitle(state.namespace) }}
          </p>
          <p class="text-xs text-blue-700 truncate">
            {{ state.message }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useGlobalLoading } from '../composables/useLoadingState.js'

// Props
const props = defineProps({
  mode: {
    type: String,
    default: 'auto', // 'auto', 'overlay', 'inline', 'none'
    validator: (value) => ['auto', 'overlay', 'inline', 'none'].includes(value)
  },
  showCancelButton: {
    type: Boolean,
    default: false
  },
  cancelTimeout: {
    type: Number,
    default: 30000 // Show cancel button after 30 seconds
  },
  overlayThreshold: {
    type: Number,
    default: 2 // Number of loading states to trigger overlay mode
  }
})

// Emits
const emit = defineEmits(['cancel'])

// Composables
const { isAnyLoading, activeLoadingStates } = useGlobalLoading()

// State
const currentStateIndex = ref(0)
const showCancel = ref(false)
const cancelTimer = ref(null)
const messageIntervalRef = ref(null)

// Computed properties
const activeStates = computed(() => activeLoadingStates.value)

const showGlobalLoading = computed(() => {
  if (props.mode === 'none') return false
  if (props.mode === 'overlay') return isAnyLoading.value
  if (props.mode === 'inline') return false
  
  // Auto mode: show overlay if multiple states or critical operations
  return isAnyLoading.value && (
    activeStates.value.length >= props.overlayThreshold ||
    activeStates.value.some(state => 
      ['gpu-data', 'model-data', 'calculations'].includes(state.namespace)
    )
  )
})

const inlineStates = computed(() => {
  if (props.mode === 'overlay' || props.mode === 'none') return []
  if (showGlobalLoading.value) return []
  
  return activeStates.value
})

const currentLoadingTitle = computed(() => {
  const state = activeStates.value[currentStateIndex.value]
  if (!state) return 'Loading'
  
  return getStateTitle(state.namespace)
})

const currentLoadingMessage = computed(() => {
  const state = activeStates.value[currentStateIndex.value]
  return state?.message || 'Please wait...'
})

// Methods
const getStateTitle = (namespace) => {
  const titles = {
    'gpu-data': 'Loading GPU Data',
    'model-data': 'Loading Model Data',
    'calculations': 'Calculating Configurations',
    'huggingface-api': 'Fetching Model Info',
    'default': 'Loading'
  }
  
  return titles[namespace] || titles.default
}

const handleBackgroundClick = () => {
  // Don't close on background click for critical operations
  const criticalOperations = ['calculations', 'gpu-data', 'model-data']
  const hasCritical = activeStates.value.some(state => 
    criticalOperations.includes(state.namespace)
  )
  
  if (!hasCritical) {
    emit('cancel')
  }
}

const handleCancel = () => {
  emit('cancel')
}

const startCancelTimer = () => {
  if (cancelTimer.value) {
    clearTimeout(cancelTimer.value)
  }
  
  cancelTimer.value = setTimeout(() => {
    showCancel.value = true
  }, props.cancelTimeout)
}

const clearCancelTimer = () => {
  if (cancelTimer.value) {
    clearTimeout(cancelTimer.value)
    cancelTimer.value = null
  }
  showCancel.value = false
  currentStateIndex.value = 0
}

// Watch for loading state changes
watch(isAnyLoading, (newValue) => {
  if (newValue) {
    startCancelTimer()
  } else {
    clearCancelTimer()
  }
})

// Lifecycle
onMounted(() => {
  // Cycle through loading messages
  messageIntervalRef.value = window.setInterval(() => {
    if (activeStates.value.length > 1) {
      currentStateIndex.value = (currentStateIndex.value + 1) % activeStates.value.length
    }
  }, 3000)
})

onUnmounted(() => {
  clearCancelTimer()
  if (messageIntervalRef.value) {
    window.clearInterval(messageIntervalRef.value)
  }
})
</script>
