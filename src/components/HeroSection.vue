<script setup>
// Hero section component for the vLLM Configuration Calculator
// Displays main title, description, configuration status, and state dashboard

// Import Pinia stores
import { useGpuStore } from '../stores/gpuStore.js'
import { useModelStore } from '../stores/modelStore.js'
import { useConfigStore } from '../stores/configStore.js'
import { useUiStore } from '../stores/uiStore.js'
import { computed } from 'vue'

// Initialize stores
const gpuStore = useGpuStore()
const modelStore = useModelStore()
const configStore = useConfigStore()
const uiStore = useUiStore()

// Reactive references to store getters for template use
const selectedGPUs = computed(() => gpuStore.selectedGPUs)
const selectedModels = computed(() => modelStore.selectedModels)
const applicationReady = computed(() => uiStore.applicationReady)
const stateErrors = computed(() => uiStore.stateErrors)

// Configuration calculations from config store
const hasValidConfiguration = computed(() => configStore.hasValidConfiguration)
const totalVRAM = computed(() => gpuStore.totalVRAM)
const memoryPressure = computed(() => configStore.memoryPressure)
const vramBreakdown = computed(() => configStore.vramBreakdown)
const stateAnalysis = computed(() => configStore.stateAnalysis)
const quantizationRecommendations = computed(() => configStore.quantizationRecommendations)

// Safe formatter for VRAM values to prevent toFixed errors
const formatVRAM = (value) => {
  const numValue = typeof value === 'number' && !isNaN(value) ? value : 0
  return numValue.toFixed(1)
}
</script>

<template>
  <!-- Hero Section -->
  <section class="text-center mb-8 sm:mb-12" v-if="applicationReady">
    <div class="max-w-5xl mx-auto px-2 sm:px-0">
      <!-- Main Hero Content -->
      <div class="relative">
        <div class="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 rounded-3xl -z-10"></div>
        <div class="py-12 sm:py-16 px-6 sm:px-8">
          <h2 class="heading-primary bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent component-spacing leading-tight">
            Optimize Your vLLM Deployment
          </h2>
          <p class="text-body-large component-spacing leading-relaxed max-w-4xl mx-auto">
            Configure optimal vLLM parameters for your GPU and model setup with intelligent recommendations
            based on throughput, latency, and balanced performance profiles.
          </p>
          
          <!-- Configuration Status Cards -->
          <div class="flex justify-center mb-8 sm:mb-10">
            <div class="w-full max-w-4xl">
              <!-- Desktop Layout -->
              <div class="hidden sm:flex items-center justify-center space-x-6">
                <div class="card-professional px-6 py-4 flex items-center space-x-4">
                  <div class="flex items-center space-x-3">
                    <div :class="[
                      'w-4 h-4 rounded-full shadow-sm animate-pulse-soft',
                      selectedGPUs.length > 0 ? 'bg-green-500' : 'bg-gray-300'
                    ]"></div>
                    <span class="text-caption text-emphasis">GPU Selected</span>
                  </div>
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                  <div class="flex items-center space-x-3">
                    <div :class="[
                      'w-4 h-4 rounded-full shadow-sm animate-pulse-soft',
                      selectedModels.length > 0 ? 'bg-green-500' : 'bg-gray-300'
                    ]"></div>
                    <span class="text-caption text-emphasis">Model Selected</span>
                  </div>
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                  <div class="flex items-center space-x-3">
                    <div :class="[
                      'w-4 h-4 rounded-full shadow-sm animate-pulse-soft',
                      hasValidConfiguration ? 'bg-green-500' : 'bg-gray-300'
                    ]"></div>
                    <span class="text-caption text-emphasis">Ready to Configure</span>
                  </div>
                </div>
              </div>

              <!-- Mobile Layout -->
              <div class="sm:hidden card-professional p-6 space-y-4">
                <div class="flex items-center justify-between">
                  <span class="text-caption text-emphasis">GPU Selected</span>
                  <div :class="[
                    'w-4 h-4 rounded-full shadow-sm animate-pulse-soft',
                    selectedGPUs.length > 0 ? 'bg-green-500' : 'bg-gray-300'
                  ]"></div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-caption text-emphasis">Model Selected</span>
                  <div :class="[
                    'w-4 h-4 rounded-full shadow-sm animate-pulse-soft',
                    selectedModels.length > 0 ? 'bg-green-500' : 'bg-gray-300'
                  ]"></div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-caption text-emphasis">Ready to Configure</span>
                  <div :class="[
                    'w-4 h-4 rounded-full shadow-sm animate-pulse-soft',
                    hasValidConfiguration ? 'bg-green-500' : 'bg-gray-300'
                  ]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Enhanced State Dashboard -->
      <div v-if="stateAnalysis.isComplete" class="mb-8 sm:mb-10">
        <div class="card-professional p-6 sm:p-8">
          <div class="flex items-center justify-center mb-6 sm:mb-8">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 gradient-success rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <h4 class="heading-secondary">Configuration Summary</h4>
            </div>
          </div>
          
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 component-spacing">
            <div class="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
              <div class="heading-tertiary text-blue-600 tight-spacing">{{ stateAnalysis.gpuCount }}</div>
              <div class="text-caption text-blue-800">Total GPUs</div>
            </div>
            <div class="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
              <div class="heading-tertiary text-green-600 tight-spacing">{{ totalVRAM }}GB</div>
              <div class="text-caption text-green-800">Total VRAM</div>
            </div>
            <div class="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
              <div class="heading-tertiary text-purple-600 tight-spacing">{{ stateAnalysis.modelCount }}</div>
              <div class="text-caption text-purple-800">Models</div>
            </div>
            <div class="text-center p-4 rounded-xl border" :class="{
              'bg-gradient-to-br from-green-50 to-green-100 border-green-200': memoryPressure === 'low',
              'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200': memoryPressure === 'moderate',
              'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200': memoryPressure === 'high',
              'bg-gradient-to-br from-red-50 to-red-100 border-red-200': memoryPressure === 'critical'
            }">
              <div :class="[
                'heading-tertiary tight-spacing',
                memoryPressure === 'low' ? 'text-green-600' :
                memoryPressure === 'moderate' ? 'text-yellow-600' :
                memoryPressure === 'high' ? 'text-orange-600' : 'text-red-600'
              ]">
                {{ Math.round(stateAnalysis.memoryEfficiency * 100) }}%
              </div>
              <div :class="[
                'text-caption',
                memoryPressure === 'low' ? 'text-green-800' :
                memoryPressure === 'moderate' ? 'text-yellow-800' :
                memoryPressure === 'high' ? 'text-orange-800' : 'text-red-800'
              ]">Memory Usage</div>
            </div>
          </div>
          
          <!-- Memory Pressure Indicator -->
          <div v-if="memoryPressure !== 'low'" class="mb-8 p-4 rounded-xl" :class="{
            'bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200': memoryPressure === 'moderate',
            'bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200': memoryPressure === 'high',
            'bg-gradient-to-r from-red-50 to-red-100 border border-red-200': memoryPressure === 'critical'
          }">
            <div class="flex items-center justify-center">
              <svg class="w-6 h-6 mr-3" :class="{
                'text-yellow-600': memoryPressure === 'moderate',
                'text-orange-600': memoryPressure === 'high',
                'text-red-600': memoryPressure === 'critical'
              }" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              <span class="font-semibold text-lg" :class="{
                'text-yellow-800': memoryPressure === 'moderate',
                'text-orange-800': memoryPressure === 'high',
                'text-red-800': memoryPressure === 'critical'
              }">
                {{ memoryPressure === 'moderate' ? 'Moderate' : 
                   memoryPressure === 'high' ? 'High' : 'Critical' }} Memory Pressure Detected
              </span>
            </div>
          </div>
          
          <!-- VRAM Breakdown -->
          <div v-if="vramBreakdown" class="mb-8">
            <h5 class="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">VRAM Allocation Breakdown</h5>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <div class="card-professional p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300">
                <div class="font-semibold text-blue-900 text-sm mb-2">Model Weights</div>
                <div class="text-blue-700 text-xl font-bold">{{ formatVRAM(vramBreakdown.modelWeights) }}GB</div>
              </div>
              <div class="card-professional p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300">
                <div class="font-semibold text-green-900 text-sm mb-2">KV Cache</div>
                <div class="text-green-700 text-xl font-bold">{{ formatVRAM(vramBreakdown.kvCache) }}GB</div>
              </div>
              <div class="card-professional p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:shadow-lg transition-all duration-300">
                <div class="font-semibold text-yellow-900 text-sm mb-2">Activations</div>
                <div class="text-yellow-700 text-xl font-bold">{{ formatVRAM(vramBreakdown.activations) }}GB</div>
              </div>
              <div class="card-professional p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-all duration-300">
                <div class="font-semibold text-red-900 text-sm mb-2">System</div>
                <div class="text-red-700 text-xl font-bold">{{ formatVRAM(vramBreakdown.systemOverhead) }}GB</div>
              </div>
              <div class="card-professional p-4 bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:shadow-lg transition-all duration-300">
                <div class="font-semibold text-gray-900 text-sm mb-2">Available</div>
                <div class="text-gray-700 text-xl font-bold">{{ formatVRAM(vramBreakdown.available) }}GB</div>
              </div>
            </div>
          </div>
          
          <!-- Quantization Recommendations -->
          <div v-if="quantizationRecommendations.length > 0">
            <h5 class="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">Quantization Recommendations</h5>
            <div class="space-y-3">
              <div 
                v-for="rec in quantizationRecommendations" 
                :key="rec.modelName"
                class="card-professional p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:shadow-lg transition-all duration-300"
              >
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <div class="flex-1">
                    <div class="font-bold text-blue-900 text-lg">{{ rec.modelName }}</div>
                    <div class="text-blue-700">{{ rec.reason }}</div>
                  </div>
                  <div class="text-left sm:text-right">
                    <div class="font-bold text-blue-900 text-lg">
                      {{ rec.currentFormat }} → {{ rec.recommendedFormat }}
                    </div>
                    <div class="text-blue-700 font-medium">
                      Save {{ rec.memorySavings?.toFixed(1) || '0.0' }}GB VRAM
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Tailwind CSS classes handle the styling */
</style>
