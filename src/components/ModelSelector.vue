<template>
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-8">
    <div class="mb-8">
      <h2 class="text-3xl font-semibold text-gray-900 mb-2">Model Selection</h2>
      <p class="text-gray-600 text-lg">Choose language models with appropriate quantization settings</p>
    </div>

    <!-- Predefined Model Selection -->
    <div class="mb-10">
      <div class="mb-6">
        <h3 class="text-xl font-medium text-gray-900 mb-2">Available Models</h3>
        <p class="text-gray-500">Select from our curated list of high-performance language models</p>
      </div>
      
      <!-- Loading State -->
            <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-16">
        <div class="relative">
          <!-- Enhanced animated spinner -->
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mb-4"></div>
          <div class="absolute inset-0 animate-ping rounded-full h-12 w-12 border-4 border-blue-200 opacity-30"></div>
        </div>
        <div class="text-center">
          <p class="text-gray-900 font-semibold mb-2">Loading Model Data</p>
          <p class="text-gray-600 text-sm">Fetching available models and their configurations...</p>
          <div class="mt-4 flex items-center justify-center space-x-1">
            <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
            <!-- Error State -->
      <div v-else-if="loadError" class="bg-red-50 border border-red-200 rounded-xl p-8 mb-6">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <div class="ml-4 flex-1">
            <h3 class="text-lg font-semibold text-red-900 mb-2">Failed to Load Model Data</h3>
            <p class="text-red-700 mb-4">{{ loadError }}</p>
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="retryLoadModels"
                :disabled="isRetrying"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <svg v-if="isRetrying" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                {{ isRetrying ? 'Retrying...' : 'Retry Loading' }}
              </button>
              <button
                @click="useOfflineMode"
                class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Continue with Manual Entry
              </button>
            </div>
            <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p class="text-yellow-800 text-sm">
                <strong>Tip:</strong> You can still add models manually using the form below, or try refreshing your connection and retrying.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Model Grid -->
      <div v-else-if="availableModels.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div
          v-for="model in availableModels"
          :key="model.name"
          class="group relative border border-gray-200 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:border-blue-300 hover:shadow-md"
          :class="
            isModelSelected(model)
              ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-500 ring-opacity-20'
              : 'hover:bg-gray-50'
          "
          @click="toggleModel(model)"
        >
          <div class="mb-4">
            <div class="flex items-start justify-between mb-3">
              <h4 class="font-semibold text-gray-900 text-lg leading-tight">{{ model.name }}</h4>
              <div v-if="isModelSelected(model)" class="flex-shrink-0 ml-2">
                <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
            </div>
            
            <div class="space-y-3">
              <!-- Hugging Face ID -->
              <div class="flex items-center text-sm text-gray-600">
                <svg class="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clip-rule="evenodd"></path>
                </svg>
                <span class="font-mono text-xs truncate">{{ model.huggingface_id }}</span>
              </div>
              
              <!-- Enhanced Quantization Information -->
              <div class="bg-gray-50 rounded-lg p-3 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-700">Quantization:</span>
                  <div class="flex items-center space-x-2">
                    <span 
                      :class="[
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        getQuantizationColor(model.quantization)
                      ]"
                      :title="getQuantizationDescription(model.quantization)"
                    >
                      {{ model.quantization.toUpperCase() }}
                    </span>
                    <div 
                      class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help"
                      :title="getQuantizationDescription(model.quantization)"
                    >
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-700">Memory Usage:</span>
                  <div class="flex items-center space-x-2">
                    <span class="text-sm font-semibold text-gray-900">
                      {{ Math.round(model.memory_factor * 100) }}%
                    </span>
                    <div class="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        class="h-2 rounded-full transition-all duration-300"
                        :class="getMemoryBarColor(model.memory_factor)"
                        :style="{ width: `${model.memory_factor * 100}%` }"
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-700">Precision:</span>
                  <span class="text-sm text-gray-600">
                    {{ getQuantizationPrecision(model.quantization) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Performance Indicator -->
          <div class="pt-3 border-t border-gray-100">
            <div class="flex items-center justify-between text-sm mb-2">
              <span class="text-gray-500">Performance Impact:</span>
              <div class="flex items-center space-x-1">
                <span class="text-xs text-gray-500">Speed</span>
                <div class="flex space-x-0.5">
                  <div 
                    v-for="n in 5" 
                    :key="n"
                    class="w-1.5 h-3 rounded-sm"
                    :class="n <= getPerformanceRating(model.quantization).speed ? 'bg-green-400' : 'bg-gray-200'"
                  ></div>
                </div>
                <span class="text-xs text-gray-500 ml-2">Quality</span>
                <div class="flex space-x-0.5">
                  <div 
                    v-for="n in 5" 
                    :key="n"
                    class="w-1.5 h-3 rounded-sm"
                    :class="n <= getPerformanceRating(model.quantization).quality ? 'bg-blue-400' : 'bg-gray-200'"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Models Available -->
      <div v-else class="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
        <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p class="text-gray-500 font-medium">No model data available</p>
        <p class="text-gray-400 text-sm mt-1">Check Hugging Face integration below</p>
      </div>
    </div>

    <!-- Hugging Face Model Integration -->
    <div class="border-t border-gray-200 pt-10 mb-10">
      <div class="mb-6">
        <h3 class="text-xl font-medium text-gray-900 mb-2">Add from Hugging Face</h3>
        <p class="text-gray-500">Search and add models directly from the Hugging Face Hub</p>
      </div>
      
      <!-- Search Form -->
      <div class="bg-gray-50 rounded-xl p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div class="md:col-span-6">
            <label for="hf-model-id" class="block text-sm font-semibold text-gray-900 mb-3">
              Hugging Face Model ID
            </label>
            <input
              id="hf-model-id"
              v-model="hfModelId"
              type="text"
              placeholder="e.g., microsoft/DialoGPT-medium"
              :class="[
                'w-full px-4 py-3 border rounded-xl font-medium placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                hfError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 hover:border-gray-400'
              ]"
              @keypress.enter="fetchHuggingFaceModel"
            />
            <p class="text-xs text-gray-500 mt-2">
              Find models at 
              <a href="https://huggingface.co/models" target="_blank" class="text-blue-600 hover:underline font-medium">
                huggingface.co/models
              </a>
            </p>
          </div>
          
          <div class="md:col-span-3">
            <label for="hf-quantization" class="block text-sm font-semibold text-gray-900 mb-3">
              Preferred Quantization
            </label>
            <select
              id="hf-quantization"
              v-model="hfQuantization"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all duration-200"
            >
              <option value="auto">Auto-detect</option>
              <option value="fp16">FP16 (Full Precision)</option>
              <option value="awq">AWQ 4-bit</option>
              <option value="gptq">GPTQ 4-bit</option>
            </select>
          </div>
          
          <div class="md:col-span-3 flex items-end">
            <button
              @click="fetchHuggingFaceModel"
              :disabled="!hfModelId.trim() || isLoadingHF"
              :class="[
                'w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                !hfModelId.trim() || isLoadingHF
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm hover:shadow-md active:bg-blue-800'
              ]"
            >
              <span v-if="isLoadingHF" class="flex items-center justify-center">
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-white mr-2"></div>
                <span class="text-sm">Fetching Model Info...</span>
              </span>
              <span v-else class="flex items-center justify-center">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                Fetch Model
              </span>
            </button>
          </div>
        </div>
        
        <!-- HF Error Display -->
        <div v-if="hfError" class="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            <div class="flex-1">
              <h4 class="text-red-900 font-semibold mb-1">Model Fetch Failed</h4>
              <p class="text-red-700 text-sm mb-3">{{ hfError }}</p>
              <div class="flex flex-col sm:flex-row gap-2">
                <button
                  @click="retryHuggingFaceModel"
                  :disabled="isLoadingHF"
                  class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <svg v-if="isLoadingHF" class="animate-spin -ml-1 mr-1 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  {{ isLoadingHF ? 'Retrying...' : 'Retry' }}
                </button>
                <button
                  @click="switchToManualEntry"
                  class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                >
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  Add Manually
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- HF Success Display -->
        <div v-if="hfSuccess" class="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <p class="text-green-700 font-medium">{{ hfSuccess }}</p>
          </div>
        </div>
      </div>
      
      <!-- Fetched Model Preview -->
      <div v-if="fetchedModel" class="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h4 class="text-lg font-semibold text-blue-900 mb-2">{{ fetchedModel.name }}</h4>
            <p class="text-blue-700 text-sm font-mono">{{ fetchedModel.huggingface_id }}</p>
          </div>
          <button
            @click="addFetchedModel"
            class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add Model
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div class="bg-white rounded-lg p-3">
            <div class="text-gray-500 font-medium mb-1">Quantization</div>
            <div class="flex items-center">
              <span 
                :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2', getQuantizationColor(fetchedModel.quantization)]"
              >
                {{ fetchedModel.quantization.toUpperCase() }}
              </span>
              <span class="text-gray-600">{{ getQuantizationPrecision(fetchedModel.quantization) }}</span>
            </div>
          </div>
          
          <div class="bg-white rounded-lg p-3">
            <div class="text-gray-500 font-medium mb-1">Memory Usage</div>
            <div class="flex items-center">
              <span class="font-semibold text-gray-900">{{ Math.round(fetchedModel.memory_factor * 100) }}%</span>
              <div class="ml-2 w-16 bg-gray-200 rounded-full h-2">
                <div 
                  class="h-2 rounded-full"
                  :class="getMemoryBarColor(fetchedModel.memory_factor)"
                  :style="{ width: `${fetchedModel.memory_factor * 100}%` }"
                ></div>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg p-3">
            <div class="text-gray-500 font-medium mb-1">Performance</div>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-1">
                <span class="text-xs text-gray-500">Speed</span>
                <div class="flex space-x-0.5">
                  <div 
                    v-for="n in 5" 
                    :key="n"
                    class="w-1 h-2 rounded-sm"
                    :class="n <= getPerformanceRating(fetchedModel.quantization).speed ? 'bg-green-400' : 'bg-gray-200'"
                  ></div>
                </div>
              </div>
              <div class="flex items-center space-x-1">
                <span class="text-xs text-gray-500">Quality</span>
                <div class="flex space-x-0.5">
                  <div 
                    v-for="n in 5" 
                    :key="n"
                    class="w-1 h-2 rounded-sm"
                    :class="n <= getPerformanceRating(fetchedModel.quantization).quality ? 'bg-blue-400' : 'bg-gray-200'"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Manual Model Entry (Fallback) -->
    <div data-testid="manual-entry" class="border-t border-gray-200 pt-10 mb-10">
      <div class="mb-6">
        <h3 class="text-xl font-medium text-gray-900 mb-2">Manual Model Entry</h3>
        <p class="text-gray-500">Add custom models with specific configurations when automatic detection isn't available</p>
      </div>
      
      <!-- Manual Entry Form -->
      <div class="bg-gray-50 rounded-xl p-6">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <!-- Model Name -->
          <div class="md:col-span-4">
            <label for="manual-model-name" class="block text-sm font-semibold text-gray-900 mb-3">
              Model Name
            </label>
            <input
              id="manual-model-name"
              v-model="manualModel.name"
              type="text"
              placeholder="e.g., Custom Llama 70B"
              :class="[
                'w-full px-4 py-3 border rounded-xl font-medium placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                manualModelNameError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 hover:border-gray-400'
              ]"
              @blur="validateManualModelName"
            />
            <p v-if="manualModelNameError" class="text-red-600 text-sm font-medium mt-2 flex items-center">
              <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              {{ manualModelNameError }}
            </p>
          </div>
          
          <!-- Model Size -->
          <div class="md:col-span-3">
            <label for="manual-model-size" class="block text-sm font-semibold text-gray-900 mb-3">
              Model Size (Billion Parameters)
            </label>
            <input
              id="manual-model-size"
              v-model.number="manualModel.size_billion"
              type="number"
              placeholder="e.g., 70"
              min="0.1"
              max="1000"
              step="0.1"
              :class="[
                'w-full px-4 py-3 border rounded-xl font-medium placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                manualModelSizeError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 hover:border-gray-400'
              ]"
              @blur="validateManualModelSize"
            />
            <p v-if="manualModelSizeError" class="text-red-600 text-sm font-medium mt-2 flex items-center">
              <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              {{ manualModelSizeError }}
            </p>
          </div>
          
          <!-- Quantization -->
          <div class="md:col-span-3">
            <label for="manual-quantization" class="block text-sm font-semibold text-gray-900 mb-3">
              Quantization Method
            </label>
            <select
              id="manual-quantization"
              v-model="manualModel.quantization"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all duration-200"
              @change="updateManualMemoryFactor"
            >
              <option value="fp16">FP16 (Full Precision)</option>
              <option value="awq">AWQ 4-bit</option>
              <option value="gptq">GPTQ 4-bit</option>
              <option value="int8">INT8 8-bit</option>
              <option value="int4">INT4 4-bit</option>
            </select>
            <p class="text-xs text-gray-500 mt-2">
              Memory usage: {{ Math.round(manualModel.memory_factor * 100) }}%
            </p>
          </div>
          
          <!-- Add Button -->
          <div class="md:col-span-2 flex items-end">
            <button
              @click="addManualModel"
              :disabled="!isManualModelValid || hasManualModelErrors"
              :class="[
                'w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                !isManualModelValid || hasManualModelErrors
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 shadow-sm hover:shadow-md active:bg-green-800'
              ]"
            >
              <span class="flex items-center justify-center">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Add Model
              </span>
            </button>
          </div>
        </div>
        
        <!-- Optional Hugging Face ID -->
        <div class="mt-6 pt-6 border-t border-gray-200">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div class="md:col-span-8">
              <label for="manual-hf-id" class="block text-sm font-semibold text-gray-900 mb-3">
                Hugging Face ID (Optional)
              </label>
              <input
                id="manual-hf-id"
                v-model="manualModel.huggingface_id"
                type="text"
                placeholder="e.g., meta-llama/Llama-2-70b-hf"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl font-medium placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400"
              />
              <p class="text-xs text-gray-500 mt-2">
                Optional: Include the Hugging Face model ID for reference
              </p>
            </div>
            
            <div class="md:col-span-4 flex items-end">
              <button
                @click="clearManualForm"
                class="w-full py-3 px-6 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Clear Form
              </button>
            </div>
          </div>
        </div>
        
        <!-- Manual Model Error Display -->
        <div v-if="manualModelError" class="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>
            <p class="text-red-700 font-medium">{{ manualModelError }}</p>
          </div>
        </div>
        
        <!-- Manual Model Success Display -->
        <div v-if="manualModelSuccess" class="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <p class="text-green-700 font-medium">{{ manualModelSuccess }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected Models Summary -->
    <div v-if="selectedModels.length > 0" class="border-t border-gray-200 pt-10">
      <div class="mb-6">
        <h3 class="text-xl font-medium text-gray-900 mb-2">Selected Models</h3>
        <p class="text-gray-500">Review your model selection and quantization settings</p>
      </div>
      
      <!-- Model List -->
      <div class="space-y-3 mb-8">
        <div
          v-for="model in selectedModels"
          :key="model.name"
          class="group bg-gray-50 hover:bg-gray-100 rounded-xl p-6 transition-colors duration-200 border border-gray-200"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center mb-2">
                <h4 class="font-semibold text-gray-900 text-lg">{{ model.name }}</h4>
                <span v-if="model.custom" class="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Custom
                </span>
              </div>
              <div class="flex items-center text-gray-600 space-x-4">
                <div class="flex items-center">
                  <svg class="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clip-rule="evenodd"></path>
                  </svg>
                  <span class="font-medium">{{ model.quantization.toUpperCase() }}</span>
                  <span class="ml-1 text-sm text-gray-500">({{ getQuantizationPrecision(model.quantization) }})</span>
                </div>
                <div class="flex items-center">
                  <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                  </svg>
                  <span class="font-medium">{{ Math.round(model.memory_factor * 100) }}% memory</span>
                  <div class="ml-2 w-12 bg-gray-200 rounded-full h-1.5">
                    <div 
                      class="h-1.5 rounded-full"
                      :class="getMemoryBarColor(model.memory_factor)"
                      :style="{ width: `${model.memory_factor * 100}%` }"
                    ></div>
                  </div>
                </div>
                <div v-if="model.huggingface_id" class="flex items-center">
                  <span class="font-mono text-sm text-gray-500 truncate max-w-48">{{ model.huggingface_id }}</span>
                </div>
              </div>
            </div>
            <button 
              @click="removeModel(model)" 
              class="ml-6 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              title="Remove Model"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="text-center md:text-left">
            <div class="text-3xl font-bold text-blue-900">{{ selectedModels.length }}</div>
            <div class="text-blue-700 font-medium">Selected Model{{ selectedModels.length > 1 ? 's' : '' }}</div>
          </div>
          <div class="text-center md:text-left">
            <div class="text-3xl font-bold text-blue-900">{{ uniqueQuantizations.length }}</div>
            <div class="text-blue-700 font-medium">Quantization Type{{ uniqueQuantizations.length > 1 ? 's' : '' }}</div>
          </div>
        </div>
        <div v-if="uniqueQuantizations.length > 0" class="mt-4 pt-4 border-t border-blue-200">
          <div class="text-sm text-blue-700 font-medium mb-3">Quantization Methods Used:</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              v-for="quant in uniqueQuantizations" 
              :key="quant"
              class="bg-white rounded-lg p-4 border border-blue-200"
            >
              <div class="flex items-center justify-between mb-2">
                <span 
                  :class="['inline-flex items-center px-3 py-1 rounded-full text-sm font-medium', getQuantizationColor(quant)]"
                >
                  {{ quant.toUpperCase() }}
                </span>
                <span class="text-sm text-gray-600">{{ getQuantizationPrecision(quant) }}</span>
              </div>
              <p class="text-xs text-gray-600 leading-relaxed">{{ getQuantizationDescription(quant) }}</p>
              <div class="flex items-center justify-between mt-3 text-xs">
                <div class="flex items-center space-x-2">
                  <span class="text-gray-500">Speed:</span>
                  <div class="flex space-x-0.5">
                    <div 
                      v-for="n in 5" 
                      :key="n"
                      class="w-1 h-2 rounded-sm"
                      :class="n <= getPerformanceRating(quant).speed ? 'bg-green-400' : 'bg-gray-200'"
                    ></div>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="text-gray-500">Quality:</span>
                  <div class="flex space-x-0.5">
                    <div 
                      v-for="n in 5" 
                      :key="n"
                      class="w-1 h-2 rounded-sm"
                      :class="n <= getPerformanceRating(quant).quality ? 'bg-blue-400' : 'bg-gray-200'"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadModelData, validateModel, createCustomModel } from '../lib/dataLoader.js'
import { fetchModelInfo, detectQuantizationType, getQuantizationFactor } from '../lib/huggingfaceApi.js'

// Props and emits
const emit = defineEmits(['update:selectedModels'])
const props = defineProps({
  selectedModels: {
    type: Array,
    default: () => [],
  },
})

// Reactive data
const availableModels = ref([])
const selectedModels = ref(props.selectedModels)

// Loading and error states
const isLoading = ref(false)
const loadError = ref('')
const isRetrying = ref(false)
const retryCount = ref(0)
const maxRetries = 3

// Hugging Face integration
const hfModelId = ref('')
const hfQuantization = ref('auto')
const isLoadingHF = ref(false)
const hfError = ref('')
const hfSuccess = ref('')
const fetchedModel = ref(null)

// Manual model entry
const manualModel = ref({
  name: '',
  size_billion: null,
  quantization: 'fp16',
  memory_factor: 1.0,
  huggingface_id: ''
})
const manualModelNameError = ref(null)
const manualModelSizeError = ref(null)
const manualModelError = ref(null)
const manualModelSuccess = ref(null)

// Computed properties
const uniqueQuantizations = computed(() => {
  const quantizations = selectedModels.value.map(model => model.quantization)
  return [...new Set(quantizations)]
})

const isManualModelValid = computed(() => {
  return manualModel.value.name.trim() &&
         manualModel.value.size_billion > 0 &&
         manualModel.value.quantization
})

const hasManualModelErrors = computed(() => {
  return manualModelNameError.value || manualModelSizeError.value
})

// Methods
const getQuantizationColor = (quantization) => {
  const colors = {
    fp16: 'bg-blue-100 text-blue-800',
    awq: 'bg-green-100 text-green-800',
    gptq: 'bg-purple-100 text-purple-800',
    int8: 'bg-orange-100 text-orange-800',
    int4: 'bg-red-100 text-red-800',
  }
  return colors[quantization.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

const getQuantizationDescription = (quantization) => {
  const descriptions = {
    fp16: 'Full precision 16-bit floating point - highest quality, full memory usage',
    awq: 'Activation-aware Weight Quantization - 4-bit weights with minimal quality loss',
    gptq: 'GPTQ Post-training Quantization - 4-bit compression with good performance',
    int8: '8-bit integer quantization - balanced speed and quality',
    int4: '4-bit integer quantization - maximum speed, lower quality',
  }
  return descriptions[quantization.toLowerCase()] || 'Custom quantization method'
}

const getQuantizationPrecision = (quantization) => {
  const precisions = {
    fp16: '16-bit float',
    awq: '4-bit (AWQ)',
    gptq: '4-bit (GPTQ)', 
    int8: '8-bit integer',
    int4: '4-bit integer',
  }
  return precisions[quantization.toLowerCase()] || 'Custom'
}

const getMemoryBarColor = (factor) => {
  if (factor >= 0.8) return 'bg-red-400'
  if (factor >= 0.5) return 'bg-yellow-400'
  return 'bg-green-400'
}

const getPerformanceRating = (quantization) => {
  const ratings = {
    fp16: { speed: 2, quality: 5 },
    awq: { speed: 4, quality: 4 },
    gptq: { speed: 4, quality: 4 },
    int8: { speed: 3, quality: 3 },
    int4: { speed: 5, quality: 2 },
  }
  return ratings[quantization.toLowerCase()] || { speed: 3, quality: 3 }
}

const loadModels = async () => {
  isLoading.value = true
  loadError.value = ''
  
  try {
    availableModels.value = await loadModelData()
    retryCount.value = 0 // Reset retry count on success
  } catch (error) {
    console.error('Failed to load model data:', error)
    const isNetworkError = error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')
    const isTimeoutError = error.message.includes('timeout')
    
    if (isNetworkError) {
      loadError.value = 'Network connection failed. Please check your internet connection and try again.'
    } else if (isTimeoutError) {
      loadError.value = 'Request timed out. The server might be busy. Please try again in a moment.'
    } else {
      loadError.value = error.message || 'Failed to load model data. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}

const retryLoadModels = async () => {
  if (retryCount.value >= maxRetries) {
    loadError.value = `Maximum retry attempts (${maxRetries}) reached. Please check your connection or try again later.`
    return
  }
  
  isRetrying.value = true
  retryCount.value++
  
  // Add exponential backoff delay
  const delay = Math.min(1000 * Math.pow(2, retryCount.value - 1), 5000)
  await new Promise(resolve => setTimeout(resolve, delay))
  
  try {
    await loadModels()
  } finally {
    isRetrying.value = false
  }
}

const useOfflineMode = () => {
  loadError.value = ''
  availableModels.value = []
  // Focus on manual entry section
  const manualEntrySection = document.querySelector('[data-testid="manual-entry"]')
  if (manualEntrySection) {
    manualEntrySection.scrollIntoView({ behavior: 'smooth' })
  }
}

const isModelSelected = (model) => {
  return selectedModels.value.some(selected => selected.name === model.name)
}

const toggleModel = (model) => {
  if (isModelSelected(model)) {
    removeModel(model)
  } else {
    addModel(model)
  }
}

const addModel = (model) => {
  if (!validateModel(model)) {
    console.error('Invalid model configuration:', model)
    return
  }
  
  // Check if model already exists
  if (isModelSelected(model)) {
    return
  }
  
  selectedModels.value.push({ ...model })
  emit('update:selectedModels', selectedModels.value)
}

const removeModel = (model) => {
  selectedModels.value = selectedModels.value.filter(selected => selected.name !== model.name)
  emit('update:selectedModels', selectedModels.value)
}

// Hugging Face integration methods
const fetchHuggingFaceModel = async () => {
  if (!hfModelId.value.trim()) return

  isLoadingHF.value = true
  hfError.value = ''
  hfSuccess.value = ''
  fetchedModel.value = null

  try {
    const modelInfo = await fetchModelInfo(hfModelId.value.trim())

    if (modelInfo.success) {
      // Auto-detect quantization if set to auto
      const detectedQuantization = hfQuantization.value === 'auto' 
        ? detectQuantizationType(modelInfo)
        : hfQuantization.value

      // Create model object
      const model = {
        name: modelInfo.id || hfModelId.value.trim(),
        huggingface_id: hfModelId.value.trim(),
        quantization: detectedQuantization,
        memory_factor: getQuantizationFactor(detectedQuantization),
        custom: true,
        hf_fetched: true
      }

      fetchedModel.value = model
      hfSuccess.value = `Successfully fetched model information. Detected quantization: ${detectedQuantization.toUpperCase()}`
      
    } else {
      // Provide user-friendly error messages based on the error type
      const errorMsg = modelInfo.error || 'Unknown error'
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        hfError.value = `Model "${hfModelId.value.trim()}" not found on Hugging Face. Please check the model ID and try again.`
      } else if (errorMsg.includes('rate limit')) {
        hfError.value = 'Rate limit exceeded. Please wait a moment and try again.'
      } else if (errorMsg.includes('timeout')) {
        hfError.value = 'Request timed out. Please check your connection and try again.'
      } else {
        hfError.value = `Failed to fetch model information: ${errorMsg}`
      }
    }
  } catch (error) {
    console.error('Error fetching HF model:', error)
    hfError.value = 'Network error while fetching model. Please check your connection and try again.'
  } finally {
    isLoadingHF.value = false
  }
}

const addFetchedModel = () => {
  if (!fetchedModel.value) return
  
  addModel(fetchedModel.value)
  
  // Reset form
  hfModelId.value = ''
  hfQuantization.value = 'auto'
  fetchedModel.value = null
  hfSuccess.value = ''
  hfError.value = ''
}

const clearHFForm = () => {
  hfModelId.value = ''
  hfQuantization.value = 'auto'
  fetchedModel.value = null
  hfSuccess.value = ''
  hfError.value = ''
}

const retryHuggingFaceModel = async () => {
  await fetchHuggingFaceModel()
}

const switchToManualEntry = () => {
  // Pre-fill manual entry with HF model ID if available
  if (hfModelId.value.trim()) {
    manualModel.value.name = hfModelId.value.trim().split('/').pop() || hfModelId.value.trim()
    manualModel.value.huggingface_id = hfModelId.value.trim()
  }
  
  // Clear HF error
  hfError.value = ''
  
  // Focus on manual entry section
  const manualEntrySection = document.querySelector('[data-testid="manual-entry"]')
  if (manualEntrySection) {
    manualEntrySection.scrollIntoView({ behavior: 'smooth' })
  }
}

// Manual model entry methods
const validateManualModelName = () => {
  const name = manualModel.value.name.trim()
  
  if (!name) {
    manualModelNameError.value = 'Model name is required'
    return false
  }
  
  if (name.length < 3) {
    manualModelNameError.value = 'Model name must be at least 3 characters'
    return false
  }
  
  // Check for duplicate names
  const isDuplicate = selectedModels.value.some(model => 
    model.name.toLowerCase() === name.toLowerCase()
  )
  
  if (isDuplicate) {
    manualModelNameError.value = 'A model with this name already exists'
    return false
  }
  
  manualModelNameError.value = null
  return true
}

const validateManualModelSize = () => {
  const size = manualModel.value.size_billion
  
  if (!size || size <= 0) {
    manualModelSizeError.value = 'Model size must be greater than 0'
    return false
  }
  
  if (size > 1000) {
    manualModelSizeError.value = 'Model size seems unusually large (>1000B)'
    return false
  }
  
  manualModelSizeError.value = null
  return true
}

const updateManualMemoryFactor = () => {
  manualModel.value.memory_factor = getQuantizationFactor(manualModel.value.quantization)
}

const addManualModel = () => {
  // Clear previous feedback
  manualModelError.value = null
  manualModelSuccess.value = null
  
  // Validate all fields
  const isNameValid = validateManualModelName()
  const isSizeValid = validateManualModelSize()
  
  if (!isNameValid || !isSizeValid) {
    manualModelError.value = 'Please fix the validation errors above'
    return
  }
  
  try {
    // Create model object
    const model = {
      name: manualModel.value.name.trim(),
      size_billion: Number(manualModel.value.size_billion),
      quantization: manualModel.value.quantization,
      memory_factor: manualModel.value.memory_factor,
      huggingface_id: manualModel.value.huggingface_id.trim() || undefined,
      source: 'manual'
    }
    
    // Validate model
    if (!validateModel(model)) {
      manualModelError.value = 'Invalid model configuration. Please check all fields.'
      return
    }
    
    // Add model
    addModel(model)
    
    // Show success message
    manualModelSuccess.value = `Model "${model.name}" added successfully!`
    
    // Clear form after delay
    setTimeout(() => {
      clearManualForm()
    }, 2000)
    
  } catch (error) {
    console.error('Error adding manual model:', error)
    manualModelError.value = 'Failed to add model. Please try again.'
  }
}

const clearManualForm = () => {
  manualModel.value = {
    name: '',
    size_billion: null,
    quantization: 'fp16',
    memory_factor: 1.0,
    huggingface_id: ''
  }
  manualModelNameError.value = null
  manualModelSizeError.value = null
  manualModelError.value = null
  manualModelSuccess.value = null
}

// Lifecycle
onMounted(() => {
  loadModels()
})
</script>
