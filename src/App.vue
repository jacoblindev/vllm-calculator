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
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
    <!-- Navigation Header -->
    <TheHeader />

    <main 
      class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8"
      role="main"
      aria-label="vLLM Configuration Calculator Application"
    >
      <ErrorBoundary>
        <LoadingIndicator />
        
        <!-- Hero Section -->
        <div class="animate-fade-in-up mb-6 sm:mb-8 lg:mb-12">
          <HeroSection />
        </div>
        
        <!-- Mobile Configuration Summary - Show progress on mobile -->
        <div v-if="hasValidConfiguration" class="lg:hidden animate-fade-in-up mb-4 sm:mb-6">
          <ConfigurationSummary />
        </div>
        
        <!-- Configuration Steps -->
        <div class="space-y-4 sm:space-y-6 lg:space-y-8">
          <!-- Step 1: GPU Selection -->
          <section 
            class="scroll-mt-16 sm:scroll-mt-20 animate-fade-in-up" 
            id="gpu-selection" 
            style="animation-delay: 0.1s"
            aria-labelledby="gpu-selection-heading"
          >
            <div class="card-professional p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
              <div class="flex items-center mb-4 sm:mb-6 lg:mb-8">
                <div 
                  class="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 gradient-primary text-white rounded-full text-sm sm:text-lg font-bold mr-3 sm:mr-4 lg:mr-6 shadow-lg flex-shrink-0"
                  aria-label="Step 1 of 3"
                >
                  1
                </div>
                <div class="flex-1 min-w-0">
                  <h3 
                    id="gpu-selection-heading"
                    class="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 truncate"
                  >
                    Select Your GPU Configuration
                  </h3>
                  <p class="text-gray-600 text-xs sm:text-sm lg:text-base leading-relaxed">Choose the GPUs that will power your vLLM deployment</p>
                </div>
              </div>
              
              <!-- State Error Display -->
              <div v-if="stateErrors.length > 0" class="mb-4 sm:mb-6 lg:mb-8 space-y-2 sm:space-y-3">
                <div 
                  v-for="error in stateErrors" 
                  :key="error.id"
                  class="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-5 flex items-start animate-fade-in-right shadow-sm"
                >
                  <svg class="w-5 h-5 sm:w-6 sm:h-6 text-red-500 mr-2 sm:mr-3 lg:mr-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                  </svg>
                  <div class="flex-1 min-w-0">
                    <p class="text-red-800 font-semibold text-sm sm:text-base">{{ error.message }}</p>
                    <p class="text-red-600 text-xs sm:text-sm mt-1">{{ error.timestamp.toLocaleTimeString() }}</p>
                  </div>
                  <button 
                    @click="uiStore.removeStateError(error.id)"
                    class="ml-2 sm:ml-3 lg:ml-4 text-red-400 hover:text-red-600 focus:outline-none transition-colors duration-200 p-1 rounded-md hover:bg-red-100 flex-shrink-0"
                    aria-label="Dismiss error message"
                    :title="`Dismiss error: ${error.message}`"
                  >
                    <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                  </button>
                </div>
              </div>
              
              <GPUSelector />
            </div>
          </section>

          <!-- Step 2: Model Selection -->
          <section 
            class="scroll-mt-16 sm:scroll-mt-20 animate-fade-in-up" 
            id="model-selection" 
            style="animation-delay: 0.2s"
            aria-labelledby="model-selection-heading"
          >
            <div class="card-professional p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
              <div class="flex items-center mb-4 sm:mb-6 lg:mb-8">
                <div 
                  class="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 gradient-secondary text-white rounded-full text-sm sm:text-lg font-bold mr-3 sm:mr-4 lg:mr-6 shadow-lg flex-shrink-0"
                  aria-label="Step 2 of 3"
                >
                  2
                </div>
                <div class="flex-1 min-w-0">
                  <h3 
                    id="model-selection-heading"
                    class="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 truncate"
                  >
                    Choose Your Model
                  </h3>
                  <p class="text-gray-600 text-xs sm:text-sm lg:text-base leading-relaxed">Select the language model and quantization settings</p>
                </div>
              </div>
              <ModelSelector />
            </div>
          </section>

          <!-- Configuration Results -->
          <section 
            v-if="hasValidConfiguration" 
            class="scroll-mt-16 sm:scroll-mt-20 animate-fade-in-up" 
            id="configuration-output" 
            style="animation-delay: 0.3s"
            aria-labelledby="configuration-results-heading"
          >
            <div class="card-professional p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
              <div class="flex items-center mb-4 sm:mb-6 lg:mb-8">
                <div 
                  class="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 gradient-success text-white rounded-full text-sm sm:text-lg font-bold mr-3 sm:mr-4 lg:mr-6 shadow-lg flex-shrink-0"
                  aria-label="Step 3 completed"
                >
                  ✓
                </div>
                <div class="flex-1 min-w-0">
                  <h3 
                    id="configuration-results-heading"
                    class="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 truncate"
                  >
                    Optimized vLLM Configurations
                  </h3>
                  <p class="text-gray-600 text-xs sm:text-sm lg:text-base leading-relaxed">Three performance-optimized configurations for your setup</p>
                </div>
              </div>
              <ConfigurationOutput />
            </div>
          </section>

          <!-- VRAM Visualization -->
          <section v-if="hasValidConfiguration" class="scroll-mt-16 sm:scroll-mt-20 animate-fade-in-up" id="vram-analysis" style="animation-delay: 0.4s">
            <div class="card-professional p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
              <div class="flex items-center mb-4 sm:mb-6 lg:mb-8">
                <div class="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm sm:text-lg font-bold mr-3 sm:mr-4 lg:mr-6 shadow-lg flex-shrink-0">
                  📊
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 truncate">Memory Usage Analysis</h3>
                  <p class="text-gray-600 text-xs sm:text-sm lg:text-base leading-relaxed">Detailed breakdown of VRAM allocation across components</p>
                </div>
              </div>
              <VRAMChart 
                :show-breakdown="true"
                title="VRAM Memory Allocation by Configuration"
              />
            </div>
          </section>
        </div>
        
        <!-- Configuration Summary Dashboard - Hidden on Mobile, shown in sticky position on larger screens -->
        <div class="hidden lg:block animate-fade-in-up" style="animation-delay: 0.5s">
          <ConfigurationSummary />
        </div>
        
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
