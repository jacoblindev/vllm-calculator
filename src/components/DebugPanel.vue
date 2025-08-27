<script setup>
// DebugPanel component for the vLLM Configuration Calculator
// Displays detailed debug information for development and troubleshooting

import { computed } from 'vue'

// Import Pinia stores
import { useGpuStore } from '../stores/gpuStore.js'
import { useModelStore } from '../stores/modelStore.js'
import { useConfigStore } from '../stores/configStore.js'
import { useUiStore } from '../stores/uiStore.js'

// Initialize stores
const gpuStore = useGpuStore()
const modelStore = useModelStore()
const configStore = useConfigStore()
const uiStore = useUiStore()

// Reactive references to store getters
const selectedGPUs = computed(() => gpuStore.selectedGPUs)
const selectedModels = computed(() => modelStore.selectedModels)
const totalVRAM = computed(() => gpuStore.totalVRAM)
const totalModelSize = computed(() => modelStore.totalModelSize)
const showDebugInfo = computed(() => uiStore.showDebugInfo)
const applicationReady = computed(() => uiStore.applicationReady)
const configurationStep = computed(() => configStore.configurationStep)
const setupProgress = computed(() => configStore.setupProgress)
const configurationHealth = computed(() => configStore.configurationHealth)
const memoryPressure = computed(() => configStore.memoryPressure)
const vramBreakdown = computed(() => configStore.vramBreakdown)
const stateAnalysis = computed(() => configStore.stateAnalysis)
const stateErrors = computed(() => configStore.stateErrors)
const quantizationRecommendations = computed(() => configStore.quantizationRecommendations)

// Debug console helper functions
const logDebugState = () => {
  console.log('vLLM Debug State:', {
    stateAnalysis: stateAnalysis.value,
    configurationHealth: configurationHealth.value,
    vramBreakdown: vramBreakdown.value,
    quantizationRecommendations: quantizationRecommendations.value
  })
}

const logSelections = () => {
  console.log('Selected GPUs:', selectedGPUs.value)
  console.log('Selected Models:', selectedModels.value)
}

const logConfigurations = () => {
  console.log('Configurations:', configStore.configurations)
}
</script>

<template>
  <!-- Debug Information Panel -->
  <section v-if="showDebugInfo" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-16">
    <div class="bg-gray-900 text-white rounded-xl p-4 sm:p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base sm:text-lg font-bold">Debug Information</h3>
        <button
          @click="uiStore.toggleDebugInfo()"
          class="text-gray-400 hover:text-white transition-colors p-1"
          title="Close debug panel"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <!-- State Analysis -->
        <div>
          <h4 class="text-sm font-bold text-blue-400 mb-2">State Analysis</h4>
          <div class="bg-gray-800 p-3 sm:p-4 rounded-lg text-xs sm:text-sm space-y-1 sm:space-y-2">
            <div><span class="text-gray-400">Configuration Step:</span> {{ configurationStep }}</div>
            <div><span class="text-gray-400">Setup Progress:</span> {{ Math.round(setupProgress) }}%</div>
            <div><span class="text-gray-400">Application Ready:</span> {{ applicationReady }}</div>
            <div><span class="text-gray-400">Memory Pressure:</span> 
              <span :class="{
                'text-green-400': memoryPressure === 'low',
                'text-yellow-400': memoryPressure === 'moderate',
                'text-orange-400': memoryPressure === 'high',
                'text-red-400': memoryPressure === 'critical'
              }">{{ memoryPressure }}</span>
            </div>
            <div><span class="text-gray-400">Configuration Health:</span> 
              <span :class="{
                'text-green-400': configurationHealth.status === 'healthy',
                'text-yellow-400': configurationHealth.status === 'warning',
                'text-red-400': configurationHealth.status === 'critical'
              }">{{ configurationHealth.status }}</span>
            </div>
          </div>
        </div>

        <!-- Hardware Summary -->
        <div>
          <h4 class="text-sm font-bold text-green-400 mb-2">Hardware Summary</h4>
          <div class="bg-gray-800 p-3 sm:p-4 rounded-lg text-xs sm:text-sm space-y-1 sm:space-y-2">
            <div><span class="text-gray-400">Total GPUs:</span> {{ stateAnalysis.gpuCount }}</div>
            <div><span class="text-gray-400">Total VRAM:</span> {{ totalVRAM }}GB</div>
            <div><span class="text-gray-400">Selected Models:</span> {{ stateAnalysis.modelCount }}</div>
            <div><span class="text-gray-400">Total Model Size:</span> {{ totalModelSize }}GB</div>
            <div><span class="text-gray-400">Memory Efficiency:</span> {{ (stateAnalysis.memoryEfficiency * 100).toFixed(1) }}%</div>
            <div><span class="text-gray-400">Estimated Cost:</span> ${{ stateAnalysis.estimatedCost.toFixed(2) }}/hr</div>
          </div>
        </div>

        <!-- VRAM Breakdown -->
        <div v-if="vramBreakdown">
          <h4 class="text-sm font-bold text-purple-400 mb-2">VRAM Breakdown</h4>
          <div class="bg-gray-800 p-3 sm:p-4 rounded-lg text-xs sm:text-sm space-y-1 sm:space-y-2">
            <div><span class="text-gray-400">Model Weights:</span> {{ vramBreakdown.modelWeights.toFixed(1) }}GB</div>
            <div><span class="text-gray-400">KV Cache:</span> {{ vramBreakdown.kvCache.toFixed(1) }}GB</div>
            <div><span class="text-gray-400">Activations:</span> {{ vramBreakdown.activations.toFixed(1) }}GB</div>
            <div><span class="text-gray-400">System Overhead:</span> {{ vramBreakdown.systemOverhead.toFixed(1) }}GB</div>
            <div><span class="text-gray-400">Available:</span> 
              <span :class="vramBreakdown.available > 5 ? 'text-green-400' : vramBreakdown.available > 2 ? 'text-yellow-400' : 'text-red-400'">
                {{ vramBreakdown.available.toFixed(1) }}GB
              </span>
            </div>
          </div>
        </div>

        <!-- State Errors -->
        <div v-if="stateErrors.length > 0">
          <h4 class="text-sm font-bold text-red-400 mb-2">State Errors</h4>
          <div class="bg-gray-800 p-3 sm:p-4 rounded-lg text-xs sm:text-sm space-y-1">
            <div v-for="error in stateErrors" :key="error.id" class="text-red-300">
              {{ error.message }}
            </div>
          </div>
        </div>

        <!-- Quantization Recommendations -->
        <div v-if="quantizationRecommendations.length > 0" class="md:col-span-2">
          <h4 class="text-sm font-bold text-yellow-400 mb-2">Quantization Recommendations</h4>
          <div class="bg-gray-800 p-4 rounded-lg text-sm space-y-2">
            <div v-for="rec in quantizationRecommendations" :key="rec.modelName" class="border-l-2 border-yellow-400 pl-3">
              <div class="text-white font-medium">{{ rec.modelName }}</div>
              <div class="text-gray-400">{{ rec.currentFormat }} → {{ rec.recommendedFormat }}</div>
              <div class="text-green-400">Memory Savings: {{ rec.memorySavings.toFixed(1) }}GB</div>
              <div class="text-yellow-400">Quality Impact: {{ rec.qualityImpact }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Browser Console Helpers -->
      <div class="mt-6 pt-4 border-t border-gray-700">
        <p class="text-xs text-gray-400 mb-2">
          Browser Console: Access <code class="bg-gray-800 px-1 rounded">window.vllmDebug</code> for calculation functions and state inspection.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            @click="logDebugState"
            class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
          >
            Log State
          </button>
          <button
            @click="logSelections"
            class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium transition-colors"
          >
            Log Selections
          </button>
          <button
            @click="logConfigurations"
            class="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-medium transition-colors"
          >
            Log Configs
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Tailwind CSS classes handle the styling */
</style>
