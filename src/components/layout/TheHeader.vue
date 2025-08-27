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
  <header 
    class="glass-morphism border-b border-white/20 sticky top-0 z-50 backdrop-blur-md"
    role="banner"
    aria-label="Main navigation"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-14 sm:h-16">
        <!-- Brand Section -->
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0">
            <div 
              class="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center shadow-md"
              aria-label="vLLM Calculator logo"
            >
              <svg 
                class="w-5 h-5 text-white" 
                fill="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
          </div>
          <div>
            <h1 class="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">vLLM Calculator</h1>
            <p class="text-xs text-gray-600 hidden sm:block">GPU Configuration Tool</p>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav 
          class="hidden lg:flex items-center space-x-8"
          role="navigation"
          aria-label="Main navigation links"
        >
          <a 
            href="#gpu-selection" 
            :class="[
              'text-base font-medium transition-all duration-300 px-5 py-1.5 rounded-lg whitespace-nowrap',
              configurationStep === 'gpu' 
                ? 'text-blue-600 bg-blue-50 border border-blue-200 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            ]"
            :aria-current="configurationStep === 'gpu' ? 'step' : undefined"
            aria-label="GPU selection step"
          >
            <span class="flex items-center space-x-3">
              <svg 
                class="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect x="4" y="4" width="16" height="16" rx="2"/>
                <rect x="9" y="9" width="6" height="6"/>
                <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>
              </svg>
              <span>GPU</span>
            </span>
          </a>
          
          <a 
            href="#model-selection" 
            :class="[
              'text-base font-medium transition-all duration-300 px-5 py-1.5 rounded-lg whitespace-nowrap',
              configurationStep === 'model' 
                ? 'text-blue-600 bg-blue-50 border border-blue-200 shadow-sm' 
                : selectedGPUs.length > 0 
                  ? 'text-gray-600 hover:text-gray-900 hover:bg-white/50' 
                  : 'text-gray-400 cursor-not-allowed opacity-50'
            ]"
            :aria-current="configurationStep === 'model' ? 'step' : undefined"
            :aria-disabled="selectedGPUs.length === 0"
            aria-label="Model selection step"
          >
            <span class="flex items-center space-x-3">
              <svg 
                class="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
              </svg>
              <span>Model</span>
            </span>
          </a>
          
          <a 
            href="#configuration-results" 
            :class="[
              'text-base font-medium transition-all duration-300 px-5 py-1.5 rounded-lg whitespace-nowrap',
              configurationStep === 'complete' 
                ? 'text-blue-600 bg-blue-50 border border-blue-200 shadow-sm' 
                : hasValidConfiguration 
                  ? 'text-gray-600 hover:text-gray-900 hover:bg-white/50' 
                  : 'text-gray-400 cursor-not-allowed opacity-50'
            ]"
            :aria-current="configurationStep === 'complete' ? 'step' : undefined"
            :aria-disabled="!hasValidConfiguration"
            aria-label="Configuration results step"
          >
            <span class="flex items-center space-x-3">
              <svg 
                class="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M9 12h6M9 16h6M9 8h6"/>
                <rect x="3" y="4" width="18" height="16" rx="2"/>
              </svg>
              <span>Config</span>
            </span>
          </a>
        </nav>
        
        <!-- Action Buttons & Status -->
        <div class="flex items-center space-x-2 sm:space-x-3">
          <!-- Configuration Health Indicator -->
          <div class="hidden md:flex items-center space-x-2">
            <div 
              :class="[
                'w-2.5 h-2.5 rounded-full shadow-sm animate-pulse-soft',
                configurationHealth.status === 'healthy' ? 'bg-green-500' :
                configurationHealth.status === 'warning' ? 'bg-yellow-500' :
                'bg-red-500'
              ]"
              :title="configurationHealth.issues.join(', ') || 'Configuration is healthy'"
              :aria-label="'Configuration status: ' + configurationHealth.status"
              role="status"
            ></div>
            <span 
              :class="[
                'text-xs font-medium',
                configurationHealth.status === 'healthy' ? 'text-green-700' :
                configurationHealth.status === 'warning' ? 'text-yellow-700' :
                'text-red-700'
              ]"
              aria-live="polite"
            >
              {{ configurationHealth.status === 'healthy' ? 'Ready' : 
                 configurationHealth.status === 'warning' ? 'Warning' : 'Issues' }}
            </span>
          </div>

          <!-- Progress Indicator -->
          <div class="hidden lg:flex items-center space-x-2">
            <span class="text-xs font-medium text-gray-700" id="progress-label">Progress</span>
            <div class="relative w-16" role="progressbar" :aria-valuenow="Math.round(setupProgress)" aria-valuemin="0" aria-valuemax="100" aria-labelledby="progress-label">
              <div class="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div 
                  class="gradient-primary h-1.5 rounded-full transition-all duration-500 ease-out" 
                  :style="{ width: setupProgress + '%' }"
                ></div>
              </div>
            </div>
            <span class="text-xs font-medium text-gray-600 min-w-[2rem] text-right" aria-live="polite">{{ Math.round(setupProgress) }}%</span>
          </div>

          <!-- Action Menu -->
          <div class="flex items-center space-x-2">
            <!-- Save Configuration -->
            <button
              v-if="hasValidConfiguration"
              @click="saveStateToStorage"
              class="!hidden lg:!inline-flex btn-professional px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md shadow-sm hover:shadow-md border border-blue-600 items-center"
              aria-label="Save current configuration"
            >
              <svg 
                class="w-4 h-4 mr-1.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
              <span class="hidden sm:inline">Save</span>
            </button>

            <!-- Clear Configuration -->
            <button
              v-if="selectedGPUs.length > 0 || selectedModels.length > 0"
              @click="clearStoredState(); gpuStore.clearAllGPUs(); modelStore.clearAllModels();"
              class="!hidden lg:!inline-flex btn-professional px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 text-xs rounded-md shadow-sm hover:shadow-md items-center"
              aria-label="Clear all selections"
            >
              <svg 
                class="w-4 h-4 mr-1.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              <span class="hidden sm:inline">Clear</span>
            </button>

            <!-- Settings Dropdown -->
            <div class="relative" @click="$event.stopPropagation()" data-settings-menu>
              <button
                @click="uiStore.toggleSettingsMenu()"
                class="btn-professional p-2 lg:p-1.5 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md shadow-sm hover:shadow-md"
                aria-label="Settings and options"
                :aria-expanded="showSettingsMenu"
                aria-haspopup="true"
              >
                <svg 
                  class="w-6 h-6 lg:w-4 lg:h-4 text-gray-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                </svg>
              </button>

              <!-- Settings Dropdown Menu -->
              <div
                v-if="showSettingsMenu"
                class="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden"
                @click.stop
                role="menu"
                aria-labelledby="settings-button"
              >
                <div class="py-1">
                  <div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                    Configuration
                  </div>
                  <button
                    @click="clearStoredState(); uiStore.showSettingsMenu = false"
                    class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center transition-colors duration-200"
                    role="menuitem"
                    aria-label="Clear all saved configuration data"
                  >
                    <svg 
                      class="w-4 h-4 mr-3 text-gray-400" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    <div>
                      <div class="font-medium">Clear Saved Data</div>
                      <div class="text-xs text-gray-500">Reset all configurations</div>
                    </div>
                  </button>
                  
                  <div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 border-t bg-gray-50">
                    View Options
                  </div>
                  <button
                    @click="uiStore.toggleDebugInfo(); uiStore.showSettingsMenu = false"
                    class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center transition-colors duration-200"
                    role="menuitem"
                    :aria-label="(showDebugInfo ? 'Hide' : 'Show') + ' debug information panel'"
                  >
                    <svg 
                      class="w-4 h-4 mr-3 text-gray-400" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <div>
                      <div class="font-medium">{{ showDebugInfo ? 'Hide' : 'Show' }} Debug Info</div>
                      <div class="text-xs text-gray-500">Developer diagnostics</div>
                    </div>
                  </button>
                  
                  <a
                    href="https://docs.vllm.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center transition-colors duration-200"
                    @click="uiStore.showSettingsMenu = false"
                    role="menuitem"
                    aria-label="Open vLLM documentation in new tab"
                  >
                    <svg 
                      class="w-4 h-4 mr-3 text-gray-400" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                    <div>
                      <div class="font-medium">vLLM Documentation</div>
                      <div class="text-xs text-gray-500">External reference</div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <!-- Mobile Menu Button -->
          <button
            @click="uiStore.toggleMobileMenu()"
            class="lg:!hidden md:block sm:block block btn-professional p-2 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md shadow-sm"
            data-mobile-menu
            aria-label="Toggle mobile navigation menu"
            :aria-expanded="showMobileMenu"
          >
            <svg 
              class="w-6 h-6 text-gray-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path v-if="!showMobileMenu" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Menu -->
      <nav 
        v-if="showMobileMenu" 
        class="lg:hidden border-t border-white/20 glass-morphism" 
        data-mobile-menu-content
        role="navigation"
        aria-label="Mobile navigation menu"
      >
        <div class="pt-4 pb-6 space-y-1">
          <!-- Mobile Progress Indicator -->
          <div class="px-4 py-4 border-b border-white/10">
            <div class="flex items-center space-x-3 mb-3">
              <span class="text-sm font-semibold text-gray-700" id="mobile-progress-label">Setup Progress</span>
              <span class="text-sm font-medium text-gray-600" aria-live="polite">{{ Math.round(setupProgress) }}%</span>
            </div>
            <div 
              class="relative w-full" 
              role="progressbar" 
              :aria-valuenow="Math.round(setupProgress)" 
              aria-valuemin="0" 
              aria-valuemax="100" 
              aria-labelledby="mobile-progress-label"
            >
              <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  class="gradient-primary h-2 rounded-full transition-all duration-500 ease-out" 
                  :style="{ width: setupProgress + '%' }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Mobile Navigation Links -->
          <a
            href="#gpu-selection"
            @click="uiStore.showMobileMenu = false"
            :class="[
              'block px-4 py-3 text-base font-medium border-l-4 transition-all duration-200 mx-2 rounded-r-lg',
              configurationStep === 'gpu'
                ? 'text-blue-700 bg-blue-50 border-blue-500 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50 border-transparent'
            ]"
            :aria-current="configurationStep === 'gpu' ? 'step' : undefined"
            aria-label="GPU selection step"
          >
            <div class="flex items-center space-x-3">
              <svg 
                class="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect x="4" y="4" width="16" height="16" rx="2"/>
                <rect x="9" y="9" width="6" height="6"/>
                <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>
              </svg>
              <span>GPU</span>
            </div>
          </a>
          
          <a
            href="#model-selection"
            @click="uiStore.showMobileMenu = false"
            :class="[
              'block px-4 py-3 text-base font-medium border-l-4 transition-all duration-200 mx-2 rounded-r-lg',
              configurationStep === 'model'
                ? 'text-blue-700 bg-blue-50 border-blue-500 shadow-sm'
                : selectedGPUs.length > 0
                  ? 'text-gray-600 hover:text-gray-800 hover:bg-white/50 border-transparent'
                  : 'text-gray-400 border-transparent cursor-not-allowed opacity-50'
            ]"
            :aria-current="configurationStep === 'model' ? 'step' : undefined"
            :aria-disabled="selectedGPUs.length === 0"
            aria-label="Model selection step"
          >
            <div class="flex items-center space-x-3">
              <svg 
                class="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
              </svg>
              <span>Model</span>
            </div>
          </a>
          
          <a
            href="#configuration-results"
            @click="uiStore.showMobileMenu = false"
            :class="[
              'block px-4 py-3 text-base font-medium border-l-4 transition-all duration-200 mx-2 rounded-r-lg',
              configurationStep === 'complete'
                ? 'text-blue-700 bg-blue-50 border-blue-500 shadow-sm'
                : hasValidConfiguration
                  ? 'text-gray-600 hover:text-gray-800 hover:bg-white/50 border-transparent'
                  : 'text-gray-400 border-transparent cursor-not-allowed opacity-50'
            ]"
            :aria-current="configurationStep === 'complete' ? 'step' : undefined"
            :aria-disabled="!hasValidConfiguration"
            aria-label="Configuration results step"
          >
            <div class="flex items-center space-x-3">
              <svg 
                class="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M9 12h6M9 16h6M9 8h6"/>
                <rect x="3" y="4" width="18" height="16" rx="2"/>
              </svg>
              <span>Config</span>
            </div>
          </a>

          <!-- Mobile Action Buttons -->
          <div class="px-4 py-4 border-t border-white/10 space-y-3">
            <button
              v-if="hasValidConfiguration"
              @click="saveStateToStorage(); uiStore.showMobileMenu = false"
              class="w-full btn-professional px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center justify-center"
              aria-label="Save current configuration"
            >
              <svg 
                class="w-5 h-5 mr-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"/>
              </svg>
              <span class="text-sm font-medium">Save Configuration</span>
            </button>
            
            <button
              v-if="selectedGPUs.length > 0 || selectedModels.length > 0"
              @click="clearStoredState(); gpuStore.clearAllGPUs(); modelStore.clearAllModels(); uiStore.showMobileMenu = false"
              class="w-full btn-professional px-3 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 rounded-lg shadow-sm flex items-center justify-center"
              aria-label="Clear all selections"
            >
              <svg 
                class="w-5 h-5 mr-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              <span class="text-sm font-medium">Clear All</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  </header>
</template>

<style scoped>
/* Tailwind CSS classes handle the styling */
</style>
