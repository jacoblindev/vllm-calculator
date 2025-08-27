<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import GPUSelector from './components/GPUSelector.vue'
import ModelSelector from './components/ModelSelector.vue'
import ConfigurationOutput from './components/ConfigurationOutput.vue'
import VRAMChart from './components/VRAMChart.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import LoadingIndicator from './components/LoadingIndicator.vue'
import TheHeader from './components/layout/TheHeader.vue'
import TheFooter from './components/layout/TheFooter.vue'
import HeroSection from './components/HeroSection.vue'
import ConfigurationSummary from './components/ConfigurationSummary.vue'
import DebugPanel from './components/DebugPanel.vue'

// Import Pinia stores
import { useGpuStore } from './stores/gpuStore.js'
import { useModelStore } from './stores/modelStore.js'
import { useConfigStore } from './stores/configStore.js'
import { useUiStore } from './stores/uiStore.js'

// Initialize stores
const gpuStore = useGpuStore()
const modelStore = useModelStore()
const configStore = useConfigStore()
const uiStore = useUiStore()

// Extract required computeds from stores for debugging
const { stateAnalysis, memoryPressure, vramBreakdown, quantizationRecommendations } = storeToRefs(configStore)

// Enhanced state management with persistence and validation
// All state is now managed through Pinia stores

// Reactive references to store getters for template use
const selectedGPUs = computed(() => gpuStore.selectedGPUs)
const selectedModels = computed(() => modelStore.selectedModels)
const applicationReady = computed(() => uiStore.applicationReady)
const lastSavedState = computed(() => uiStore.lastSavedState)
const stateErrors = computed(() => uiStore.stateErrors)
const isStateRestoring = computed(() => uiStore.isStateRestoring)

// Configuration calculations from config store
const hasValidConfiguration = computed(() => configStore.hasValidConfiguration)

// State management functions - now delegated to stores
const loadStateFromStorage = () => {
  try {
    uiStore.setStateRestoring(true)
    // Pinia stores automatically load their state with the persist plugin
    // No explicit loading needed as it happens on store initialization
  } catch (error) {
    console.warn('Failed to load state from localStorage:', error)
    uiStore.addStateError('Failed to restore previous configuration.')
  } finally {
    uiStore.setStateRestoring(false)
  }
}

// Enhanced application lifecycle with state management
onMounted(() => {
  // Load saved state first
  loadStateFromStorage()
  
  // Mark application as ready after initial load
  setTimeout(() => {
    uiStore.setApplicationReady(true)
  }, 100)
})

// Pinia stores now handle state persistence automatically

// Window beforeunload handler for cleanup
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Auto-save handled by Pinia persistence plugin
  })
}

// Development utilities (exposed to window for debugging)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.vllmDebug = {
    stateAnalysis,
    memoryPressure,
    vramBreakdown,
    quantizationRecommendations,
    // Store access for debugging
    gpuStore,
    modelStore,
    configStore,
    uiStore
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
    <!-- Navigation Header -->
    <TheHeader />

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <ErrorBoundary>
        <LoadingIndicator />
        
        <!-- Hero Section -->
        <HeroSection />
        
        <!-- Configuration Steps -->
      <div class="space-y-8 sm:space-y-12">
        <!-- Step 1: GPU Selection -->
        <section class="scroll-mt-20" id="gpu-selection">
          <div class="flex items-center mb-4 sm:mb-6">
            <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 text-white rounded-full text-sm font-bold mr-3 sm:mr-4">
              1
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900">Select Your GPU Configuration</h3>
          </div>
          
          <!-- State Error Display -->
          <div v-if="stateErrors.length > 0" class="mb-6 space-y-2">
            <div 
              v-for="error in stateErrors" 
              :key="error.id"
              class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start"
            >
              <svg class="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
              <div class="flex-1">
                <p class="text-red-700 font-medium">{{ error.message }}</p>
                <p class="text-red-600 text-sm mt-1">{{ error.timestamp.toLocaleTimeString() }}</p>
              </div>
              <button 
                @click="uiStore.removeStateError(error.id)"
                class="ml-4 text-red-400 hover:text-red-600 focus:outline-none"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <GPUSelector />
        </section>

        <!-- Step 2: Model Selection -->
        <section class="scroll-mt-20" id="model-selection">
          <div class="flex items-center mb-4 sm:mb-6">
            <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-green-600 text-white rounded-full text-sm font-bold mr-3 sm:mr-4">
              2
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900">Choose Your Model</h3>
          </div>
          <ModelSelector />
        </section>

        <!-- Configuration Results -->
        <section v-if="hasValidConfiguration" class="scroll-mt-20" id="configuration-output">
          <div class="flex items-center mb-4 sm:mb-6">
            <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-green-600 text-white rounded-full text-sm font-bold mr-3 sm:mr-4">
              ✓
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900">Optimized vLLM Configurations</h3>
          </div>
          <ConfigurationOutput />
        </section>

        <!-- VRAM Visualization -->
        <section v-if="hasValidConfiguration" class="scroll-mt-20" id="vram-analysis">
          <div class="flex items-center mb-4 sm:mb-6">
            <div class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-purple-600 text-white rounded-full text-sm font-bold mr-3 sm:mr-4">
              📊
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900">Memory Usage Analysis</h3>
          </div>
          <VRAMChart 
            :show-breakdown="true"
            title="VRAM Memory Allocation by Configuration"
          />
        </section>
      </div>
      
      <!-- Configuration Summary Dashboard -->
      <ConfigurationSummary />
      
      </ErrorBoundary>
    </main>

    <!-- Debug Information Panel -->
    <DebugPanel />

    <!-- Footer -->
    <TheFooter />
  </div>
</template>

<style scoped>
/* Tailwind CSS classes handle the styling */
</style>
