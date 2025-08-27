<script setup>
import { computed, onMounted } from 'vue'

// Import Pinia stores
import { useGpuStore } from '../../stores/gpuStore.js'
import { useModelStore } from '../../stores/modelStore.js'
import { useConfigStore } from '../../stores/configStore.js'
import { useUiStore } from '../../stores/uiStore.js'

// Initialize stores
const gpuStore = useGpuStore()
const modelStore = useModelStore()
const configStore = useConfigStore()
const uiStore = useUiStore()

// Reactive references to store getters for template use
const selectedGPUs = computed(() => gpuStore.selectedGPUs)
const selectedModels = computed(() => modelStore.selectedModels)

// Navigation and UI state from store
const showSettingsMenu = computed(() => uiStore.showSettingsMenu)
const showMobileMenu = computed(() => uiStore.showMobileMenu)
const showDebugInfo = computed(() => uiStore.showDebugInfo)

// Configuration calculations from config store
const hasValidConfiguration = computed(() => configStore.hasValidConfiguration)
const configurationStep = computed(() => configStore.configurationStep)
const setupProgress = computed(() => configStore.setupProgress)
const configurationHealth = computed(() => configStore.configurationHealth)

// State management functions - now delegated to stores
const saveStateToStorage = () => {
  try {
    // Pinia stores automatically persist their state with the persist plugin
    uiStore.updateLastSavedState({
      gpus: selectedGPUs.value,
      models: selectedModels.value
    })
    uiStore.showSuccessNotification('Configuration saved successfully!')
  } catch (error) {
    console.warn('Failed to save state to localStorage:', error)
    uiStore.addStateError('Failed to save configuration. Your settings may not persist.')
  }
}

const clearStoredState = () => {
  try {
    // Clear the stores which will automatically update persistence
    gpuStore.clearAllGPUs()
    modelStore.clearAllModels()
    uiStore.clearLastSavedState()
    uiStore.showInfoNotification('All stored data cleared.')
  } catch (error) {
    console.warn('Failed to clear stored state:', error)
  }
}

// Enhanced application lifecycle with state management
onMounted(() => {
  // Add click listener to close menus when clicking outside
  const handleDocumentClick = (event) => {
    // Close settings menu if clicking outside
    if (showSettingsMenu.value) {
      const settingsButton = event.target.closest('[data-settings-menu]')
      if (!settingsButton) {
        uiStore.toggleSettingsMenu()
      }
    }
    
    // Close mobile menu if clicking outside
    if (showMobileMenu.value) {
      const mobileMenuButton = event.target.closest('[data-mobile-menu]')
      const mobileMenuContent = event.target.closest('[data-mobile-menu-content]')
      if (!mobileMenuButton && !mobileMenuContent) {
        uiStore.toggleMobileMenu()
      }
    }
  }

  document.addEventListener('click', handleDocumentClick)
  
  // Cleanup event listener on unmount
  return () => {
    document.removeEventListener('click', handleDocumentClick)
  }
})
</script>

<template>
  <!-- Navigation Header -->
  <header class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm backdrop-blur-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Brand Section -->
        <div class="flex items-center space-x-4">
          <div class="flex-shrink-0">
            <svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-900">vLLM Calculator</h1>
            <p class="text-sm text-gray-500">GPU Configuration Tool</p>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav class="hidden lg:flex items-center space-x-8">
          <a 
            href="#gpu-selection" 
            :class="[
              'text-sm font-medium transition-colors duration-200',
              configurationStep === 'gpu' 
                ? 'text-blue-600 border-b-2 border-blue-600 pb-1' 
                : 'text-gray-600 hover:text-gray-900'
            ]"
          >
            <span class="flex items-center space-x-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
              </svg>
              <span>GPU Setup</span>
            </span>
          </a>
          
          <a 
            href="#model-selection" 
            :class="[
              'text-sm font-medium transition-colors duration-200',
              configurationStep === 'model' 
                ? 'text-blue-600 border-b-2 border-blue-600 pb-1' 
                : selectedGPUs.length > 0 
                  ? 'text-gray-600 hover:text-gray-900' 
                  : 'text-gray-400 cursor-not-allowed'
            ]"
          >
            <span class="flex items-center space-x-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Model Setup</span>
            </span>
          </a>
          
          <a 
            href="#configuration-results" 
            :class="[
              'text-sm font-medium transition-colors duration-200',
              configurationStep === 'complete' 
                ? 'text-blue-600 border-b-2 border-blue-600 pb-1' 
                : hasValidConfiguration 
                  ? 'text-gray-600 hover:text-gray-900' 
                  : 'text-gray-400 cursor-not-allowed'
            ]"
          >
            <span class="flex items-center space-x-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
              </svg>
              <span>Configurations</span>
            </span>
          </a>
        </nav>
        
        <!-- Action Buttons & Status -->
        <div class="flex items-center space-x-4">
          <!-- Configuration Health Indicator -->
          <div class="hidden md:flex items-center space-x-2">
            <div 
              :class="[
                'w-3 h-3 rounded-full',
                configurationHealth.status === 'healthy' ? 'bg-green-500' :
                configurationHealth.status === 'warning' ? 'bg-yellow-500' :
                'bg-red-500'
              ]"
              :title="configurationHealth.issues.join(', ') || 'Configuration is healthy'"
            ></div>
            <span class="text-sm text-gray-600">
              {{ configurationHealth.status === 'healthy' ? 'Ready' : 
                 configurationHealth.status === 'warning' ? 'Warning' : 'Issues' }}
            </span>
          </div>

          <!-- Progress Indicator -->
          <div class="hidden lg:flex items-center space-x-2">
            <span class="text-sm font-medium text-gray-700">Setup Progress</span>
            <div class="w-24 bg-gray-200 rounded-full h-2">
              <div 
                class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                :style="{ width: setupProgress + '%' }"
              ></div>
            </div>
            <span class="text-sm text-gray-500">{{ Math.round(setupProgress) }}%</span>
          </div>

          <!-- Action Menu -->
          <div class="flex items-center space-x-2">
            <!-- Save Configuration -->
            <button
              v-if="hasValidConfiguration"
              @click="saveStateToStorage"
              class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              title="Save current configuration"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
              Save
            </button>

            <!-- Clear Configuration -->
            <button
              v-if="selectedGPUs.length > 0 || selectedModels.length > 0"
              @click="clearStoredState(); gpuStore.clearAllGPUs(); modelStore.clearAllModels();"
              class="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              title="Clear all selections"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Clear
            </button>

            <!-- Settings Dropdown -->
            <div class="relative" @click="$event.stopPropagation()" data-settings-menu>
              <button
                @click="uiStore.toggleSettingsMenu()"
                class="inline-flex items-center p-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                title="Settings and options"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                </svg>
              </button>

              <!-- Settings Dropdown Menu -->
              <div
                v-if="showSettingsMenu"
                class="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                @click.stop
              >
                <div class="py-1">
                  <div class="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    Configuration
                  </div>
                  <button
                    @click="clearStoredState(); uiStore.showSettingsMenu = false"
                    class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <svg class="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Clear Saved Data
                  </button>
                  
                  <div class="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 border-t mt-1">
                    View Options
                  </div>
                  <button
                    @click="uiStore.toggleDebugInfo(); uiStore.showSettingsMenu = false"
                    class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <svg class="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    {{ showDebugInfo ? 'Hide' : 'Show' }} Debug Info
                  </button>
                  
                  <a
                    href="https://docs.vllm.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    @click="uiStore.showSettingsMenu = false"
                  >
                    <svg class="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                    vLLM Documentation
                  </a>
                </div>
              </div>
            </div>
          </div>

          <!-- Mobile Menu Button -->
          <button
            @click="uiStore.toggleMobileMenu()"
            class="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            data-mobile-menu
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!showMobileMenu" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Menu -->
      <div v-if="showMobileMenu" class="md:hidden border-t border-gray-200 bg-white" data-mobile-menu-content>
        <div class="pt-2 pb-3 space-y-1">
          <!-- Mobile Progress Indicator -->
          <div class="px-4 py-2">
            <div class="flex items-center space-x-2 mb-2">
              <span class="text-sm font-medium text-gray-700">Setup Progress</span>
              <span class="text-sm text-gray-500">{{ Math.round(setupProgress) }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div 
                class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                :style="{ width: setupProgress + '%' }"
              ></div>
            </div>
          </div>

          <!-- Mobile Navigation Links -->
          <a
            href="#gpu-selection"
            @click="uiStore.showMobileMenu = false"
            :class="[
              'block px-4 py-2 text-base font-medium border-l-4 transition-colors duration-200',
              configurationStep === 'gpu'
                ? 'text-blue-700 bg-blue-50 border-blue-500'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-transparent'
            ]"
          >
            GPU Setup
          </a>
          
          <a
            href="#model-selection"
            @click="uiStore.showMobileMenu = false"
            :class="[
              'block px-4 py-2 text-base font-medium border-l-4 transition-colors duration-200',
              configurationStep === 'model'
                ? 'text-blue-700 bg-blue-50 border-blue-500'
                : selectedGPUs.length > 0
                  ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-transparent'
                  : 'text-gray-400 border-transparent cursor-not-allowed'
            ]"
          >
            Model Setup
          </a>
          
          <a
            href="#configuration-results"
            @click="uiStore.showMobileMenu = false"
            :class="[
              'block px-4 py-2 text-base font-medium border-l-4 transition-colors duration-200',
              configurationStep === 'complete'
                ? 'text-blue-700 bg-blue-50 border-blue-500'
                : hasValidConfiguration
                  ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-transparent'
                  : 'text-gray-400 border-transparent cursor-not-allowed'
            ]"
          >
            Configurations
          </a>

          <!-- Mobile Action Buttons -->
          <div class="px-4 py-3 border-t border-gray-200 space-y-2">
            <button
              v-if="hasValidConfiguration"
              @click="saveStateToStorage(); uiStore.showMobileMenu = false"
              class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
              Save Configuration
            </button>
            
            <button
              v-if="selectedGPUs.length > 0 || selectedModels.length > 0"
              @click="clearStoredState(); gpuStore.clearAllGPUs(); modelStore.clearAllModels(); uiStore.showMobileMenu = false"
              class="w-full flex items-center justify-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* Tailwind CSS classes handle the styling */
</style>
