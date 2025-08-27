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
</script>

<template>
  <!-- Hero Section -->
  <section class="text-center mb-8 sm:mb-12" v-if="applicationReady">
    <div class="max-w-4xl mx-auto px-2 sm:px-0">
      <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight">
        Optimize Your vLLM Deployment
      </h2>
      <p class="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 leading-relaxed">
        Configure optimal vLLM parameters for your GPU and model setup with intelligent recommendations
        based on throughput, latency, and balanced performance profiles.
      </p>
      
      <!-- Configuration Status -->
      <div class="flex justify-center mb-6 sm:mb-8">
        <div class="w-full max-w-2xl">
          <!-- Desktop Layout -->
          <div class="hidden sm:flex items-center space-x-4 bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-3">
            <div class="flex items-center space-x-2">
              <div class="flex items-center">
                <div :class="[
                  'w-3 h-3 rounded-full mr-2',
                selectedGPUs.length > 0 ? 'bg-green-500' : 'bg-gray-300'
              ]"></div>
                <span class="text-sm font-medium text-gray-700">GPU Selected</span>
              </div>
              <span class="text-gray-400">→</span>
              <div class="flex items-center">
                <div :class="[
                  'w-3 h-3 rounded-full mr-2',
                  selectedModels.length > 0 ? 'bg-green-500' : 'bg-gray-300'
                ]"></div>
                <span class="text-sm font-medium text-gray-700">Model Selected</span>
              </div>
              <span class="text-gray-400">→</span>
              <div class="flex items-center">
                <div :class="[
                  'w-3 h-3 rounded-full mr-2',
                  hasValidConfiguration ? 'bg-green-500' : 'bg-gray-300'
                ]"></div>
                <span class="text-sm font-medium text-gray-700">Ready to Configure</span>
              </div>
            </div>
          </div>

          <!-- Mobile Layout -->
          <div class="sm:hidden bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700">GPU Selected</span>
              <div :class="[
                'w-3 h-3 rounded-full',
                selectedGPUs.length > 0 ? 'bg-green-500' : 'bg-gray-300'
              ]"></div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700">Model Selected</span>
              <div :class="[
                'w-3 h-3 rounded-full',
                selectedModels.length > 0 ? 'bg-green-500' : 'bg-gray-300'
              ]"></div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700">Ready to Configure</span>
              <div :class="[
                'w-3 h-3 rounded-full',
                hasValidConfiguration ? 'bg-green-500' : 'bg-gray-300'
              ]"></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Enhanced State Dashboard -->
      <div v-if="stateAnalysis.isComplete" class="mb-6 sm:mb-8">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h4 class="text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Configuration Summary</h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div class="text-center">
              <div class="text-xl sm:text-2xl font-bold text-blue-600">{{ stateAnalysis.gpuCount }}</div>
              <div class="text-xs sm:text-sm text-gray-600">Total GPUs</div>
            </div>
            <div class="text-center">
              <div class="text-xl sm:text-2xl font-bold text-blue-600">{{ totalVRAM }}GB</div>
              <div class="text-xs sm:text-sm text-gray-600">Total VRAM</div>
            </div>
            <div class="text-center">
              <div class="text-xl sm:text-2xl font-bold text-blue-600">{{ stateAnalysis.modelCount }}</div>
              <div class="text-xs sm:text-sm text-gray-600">Models</div>
            </div>
            <div class="text-center">
              <div :class="[
                'text-xl sm:text-2xl font-bold',
                memoryPressure === 'low' ? 'text-green-600' :
                memoryPressure === 'moderate' ? 'text-yellow-600' :
                memoryPressure === 'high' ? 'text-orange-600' : 'text-red-600'
              ]">
                {{ Math.round(stateAnalysis.memoryEfficiency * 100) }}%
              </div>
              <div class="text-xs sm:text-sm text-gray-600">Memory Usage</div>
            </div>
          </div>
          
          <!-- Memory Pressure Indicator -->
          <div v-if="memoryPressure !== 'low'" class="mt-4 p-3 rounded-lg" :class="{
            'bg-yellow-50 border border-yellow-200': memoryPressure === 'moderate',
            'bg-orange-50 border border-orange-200': memoryPressure === 'high',
            'bg-red-50 border border-red-200': memoryPressure === 'critical'
          }">
            <div class="flex items-center">
              <svg class="w-5 h-5 mr-2" :class="{
                'text-yellow-600': memoryPressure === 'moderate',
                'text-orange-600': memoryPressure === 'high',
                'text-red-600': memoryPressure === 'critical'
              }" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              <span class="font-medium" :class="{
                'text-yellow-800': memoryPressure === 'moderate',
                'text-orange-800': memoryPressure === 'high',
                'text-red-800': memoryPressure === 'critical'
              }">
                {{ memoryPressure === 'moderate' ? 'Moderate' : 
                   memoryPressure === 'high' ? 'High' : 'Critical' }} Memory Pressure
              </span>
            </div>
          </div>
          
          <!-- VRAM Breakdown -->
          <div v-if="vramBreakdown" class="mt-4 sm:mt-6">
            <h5 class="text-sm sm:text-md font-medium text-gray-900 mb-3">VRAM Allocation Breakdown</h5>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3 text-sm">
              <div class="bg-blue-50 p-2 sm:p-3 rounded-lg border border-blue-200">
                <div class="font-medium text-blue-900 text-xs sm:text-sm">Model Weights</div>
                <div class="text-blue-700 text-sm sm:text-base font-semibold">{{ vramBreakdown.modelWeights?.toFixed(1) || '0.0' }}GB</div>
              </div>
              <div class="bg-green-50 p-2 sm:p-3 rounded-lg border border-green-200">
                <div class="font-medium text-green-900 text-xs sm:text-sm">KV Cache</div>
                <div class="text-green-700 text-sm sm:text-base font-semibold">{{ vramBreakdown.kvCache?.toFixed(1) || '0.0' }}GB</div>
              </div>
              <div class="bg-yellow-50 p-2 sm:p-3 rounded-lg border border-yellow-200">
                <div class="font-medium text-yellow-900 text-xs sm:text-sm">Activations</div>
                <div class="text-yellow-700 text-sm sm:text-base font-semibold">{{ vramBreakdown.activations?.toFixed(1) || '0.0' }}GB</div>
              </div>
              <div class="bg-red-50 p-2 sm:p-3 rounded-lg border border-red-200">
                <div class="font-medium text-red-900 text-xs sm:text-sm">System</div>
                <div class="text-red-700 text-sm sm:text-base font-semibold">{{ vramBreakdown.systemOverhead?.toFixed(1) || '0.0' }}GB</div>
              </div>
              <div class="bg-gray-50 p-2 sm:p-3 rounded-lg border border-gray-200">
                <div class="font-medium text-gray-900 text-xs sm:text-sm">Available</div>
                <div class="text-gray-700 text-sm sm:text-base font-semibold">{{ vramBreakdown.available?.toFixed(1) || '0.0' }}GB</div>
              </div>
            </div>
          </div>
          
          <!-- Quantization Recommendations -->
          <div v-if="quantizationRecommendations.length > 0" class="mt-4 sm:mt-6">
            <h5 class="text-sm sm:text-md font-medium text-gray-900 mb-3">Quantization Recommendations</h5>
            <div class="space-y-2">
              <div 
                v-for="rec in quantizationRecommendations" 
                :key="rec.modelName"
                class="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2 sm:space-y-0"
              >
                <div class="flex-1">
                  <div class="font-medium text-blue-900">{{ rec.modelName }}</div>
                  <div class="text-sm text-blue-700">{{ rec.reason }}</div>
                </div>
                <div class="text-left sm:text-right">
                  <div class="text-sm font-medium text-blue-900">
                    {{ rec.currentFormat }} → {{ rec.recommendedFormat }}
                  </div>
                  <div class="text-xs text-blue-700">
                    Save {{ rec.memorySavings?.toFixed(1) || '0.0' }}GB
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
