<template>
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-8">
    <div class="mb-10">
      <div class="flex items-start justify-between mb-6">
        <div class="flex-1">
          <h2 class="text-3xl font-semibold text-gray-900 mb-3">Model Selection</h2>
          <p class="text-gray-600 text-lg leading-relaxed">Choose language models with appropriate quantization settings for optimal performance and memory usage</p>
        </div>
        <div class="flex-shrink-0 ml-6">
          <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-900">{{ selectedModels.length }}</div>
              <div class="text-sm text-blue-700 font-medium">Selected</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Progress indicator -->
      <div v-if="selectedModels.length > 0" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          <span class="text-green-800 font-medium">
            Great! You've selected {{ selectedModels.length }} model{{ selectedModels.length > 1 ? 's' : '' }}. 
            <span v-if="uniqueQuantizations.length > 1" class="text-green-700">
              Using {{ uniqueQuantizations.length }} different quantization types.
            </span>
          </span>
        </div>
      </div>
    </div>

    <!-- Predefined Model Selection -->
    <div class="mb-10">
      <div class="mb-6">
        <h3 class="text-xl font-medium text-gray-900 mb-2">Available Models</h3>
        <p class="text-gray-500">Select from our curated list of high-performance language models</p>
      </div>

      <!-- Enhanced Filter and Bulk Actions -->
      <div v-if="!isLoading && !loadError && availableModels.length > 0" class="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-6">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <!-- Quantization Filter -->
          <div class="flex items-center space-x-4">
            <label for="quantization-filter" class="text-sm font-medium text-gray-700">Filter by Quantization:</label>
            <select 
              id="quantization-filter"
              v-model="quantizationFilter"
              class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              <option value="fp16">FP16</option>
              <option value="awq">AWQ</option>
              <option value="gptq">GPTQ</option>
              <option value="gguf">GGUF</option>
            </select>
          </div>

          <!-- Bulk Actions -->
          <div class="flex items-center space-x-3">
            <span class="text-sm font-medium text-gray-700">Bulk Actions:</span>
            <button
              @click="selectAllFiltered"
              :disabled="filteredModels.length === 0 || areAllFilteredSelected"
              class="px-3 py-2 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg transition-colors"
            >
              Select All{{ quantizationFilter ? ` (${quantizationFilter.toUpperCase()})` : '' }}
            </button>
            <button
              @click="clearAllFiltered"
              :disabled="selectedModels.length === 0"
              class="px-3 py-2 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>

        <!-- Selection Summary -->
        <div v-if="selectedModels.length > 0" class="mt-4 pt-4 border-t border-gray-300">
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600">
              <strong>{{ selectedModels.length }}</strong> model{{ selectedModels.length > 1 ? 's' : '' }} selected
              <span v-if="uniqueQuantizations.length > 1" class="text-amber-600 font-medium">
                ({{ uniqueQuantizations.length }} different quantization types)
              </span>
            </span>
            <span class="text-gray-600">
              Estimated memory factor: <strong>{{ (averageMemoryFactor * 100).toFixed(0) }}%</strong>
            </span>
          </div>
        </div>
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
      <div v-else-if="filteredModels.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div
          v-for="model in filteredModels"
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

      <!-- No Filtered Results -->
      <div v-else-if="availableModels.length > 0 && filteredModels.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No models match your filter</h3>
        <p class="text-gray-500 mb-4">
          No models found with <strong>{{ quantizationFilter.toUpperCase() }}</strong> quantization.
        </p>
        <button
          @click="quantizationFilter = ''"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
        >
          Clear Filter
        </button>
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
      <div class="mb-8">
        <h3 class="text-2xl font-semibold text-gray-900 mb-3">Add from Hugging Face</h3>
        <p class="text-gray-600 text-lg">Search and add models directly from the Hugging Face Hub with automatic configuration detection</p>
      </div>
      
      <!-- Enhanced Search Form -->
      <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 mb-6 border border-blue-200 shadow-sm">
        <div class="mb-6">
          <h4 class="text-lg font-semibold text-gray-900 mb-2">Automatic Model Detection</h4>
          <p class="text-gray-600">Enter a Hugging Face model ID and we'll automatically detect its configuration and quantization settings</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div class="md:col-span-6">
            <label for="hf-model-id" class="block text-sm font-semibold text-gray-900 mb-3">
              Hugging Face Model ID
              <span class="text-red-500">*</span>
              <button
                type="button"
                class="ml-2 inline-flex items-center text-gray-400 hover:text-gray-600"
                @click="showHFHelp = !showHFHelp"
                title="Click for help"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>
                </svg>
              </button>
            </label>
            
            <!-- HF Help tooltip -->
            <div v-if="showHFHelp" class="mb-3 p-4 bg-white border border-blue-200 rounded-lg text-sm shadow-sm">
              <p class="text-blue-800 font-medium mb-2">How to find the Model ID:</p>
              <ol class="text-blue-700 space-y-1 text-xs list-decimal list-inside">
                <li>Go to <a href="https://huggingface.co/models" target="_blank" class="text-blue-600 hover:underline font-medium">huggingface.co/models</a></li>
                <li>Search for your desired model</li>
                <li>Copy the path from the URL: <code class="bg-gray-100 px-1 rounded">owner/model-name</code></li>
              </ol>
              <div class="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                <p class="text-xs text-blue-800"><strong>Examples:</strong></p>
                <ul class="text-xs text-blue-700 mt-1 space-y-0.5">
                  <li>• <code>microsoft/DialoGPT-medium</code></li>
                  <li>• <code>meta-llama/Llama-2-7b-chat-hf</code></li>
                  <li>• <code>mistralai/Mistral-7B-Instruct-v0.1</code></li>
                </ul>
              </div>
            </div>
            
            <div class="relative">
              <input
                id="hf-model-id"
                v-model="hfModelId"
                type="text"
                placeholder="e.g., microsoft/DialoGPT-medium"
                :class="[
                  'w-full px-4 py-3 pr-12 border rounded-xl font-medium placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  hfError 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 hover:border-gray-400 bg-white'
                ]"
                @keypress.enter="fetchHuggingFaceModel"
                @input="clearHFError"
              />
              
              <!-- Input validation indicator -->
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                <svg v-if="hfModelId.includes('/') && hfModelId.length > 3" class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
                <svg v-else-if="hfModelId.length > 0" class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
              </div>
            </div>
            
            <div class="mt-2 flex items-start justify-between">
              <p class="text-xs text-gray-500">
                Find models at 
                <a href="https://huggingface.co/models" target="_blank" class="text-blue-600 hover:underline font-medium">
                  huggingface.co/models
                </a>
              </p>
              <p v-if="hfModelId.length > 0 && !hfModelId.includes('/')" class="text-xs text-amber-600 font-medium">
                Format: owner/model-name
              </p>
            </div>
          </div>
          
          <div class="md:col-span-3">
            <label for="hf-quantization" class="block text-sm font-semibold text-gray-900 mb-3">
              Preferred Quantization
              <button
                type="button"
                class="ml-2 inline-flex items-center text-gray-400 hover:text-gray-600"
                @click="showHFQuantHelp = !showHFQuantHelp"
                title="Click for help"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>
                </svg>
              </button>
            </label>
            
            <!-- HF Quantization help tooltip -->
            <div v-if="showHFQuantHelp" class="mb-3 p-3 bg-white border border-blue-200 rounded-lg text-sm shadow-sm">
              <p class="text-blue-800 font-medium mb-1">We'll try to auto-detect, but you can override:</p>
              <ul class="text-blue-700 space-y-1 text-xs">
                <li>• <strong>Auto-detect:</strong> Check model name/tags</li>
                <li>• <strong>FP16:</strong> Force full precision</li>
                <li>• <strong>AWQ/GPTQ:</strong> Force 4-bit if available</li>
              </ul>
            </div>
            
            <select
              id="hf-quantization"
              v-model="hfQuantization"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all duration-200 bg-white"
            >
              <option value="auto">🔍 Auto-detect (Recommended)</option>
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
                'w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm',
                !hfModelId.trim() || isLoadingHF
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500 hover:shadow-md active:shadow-lg transform hover:-translate-y-0.5'
              ]"
            >
              <span v-if="isLoadingHF" class="flex items-center justify-center">
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-white mr-2"></div>
                <span class="text-sm">Fetching...</span>
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
      <div class="mb-8">
        <h3 class="text-2xl font-semibold text-gray-900 mb-3">Manual Model Entry</h3>
        <p class="text-gray-600 text-lg mb-4">Add custom models with specific configurations when automatic detection isn't available</p>
        
        <!-- Step-by-step guidance -->
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-4 flex-1">
              <h4 class="text-lg font-semibold text-blue-900 mb-3">How to Find Model Information</h4>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div class="bg-white rounded-lg p-4 border border-blue-200">
                  <div class="flex items-center mb-2">
                    <span class="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full mr-2">1</span>
                    <span class="font-semibold text-blue-900">Model Name & Size</span>
                  </div>
                  <p class="text-gray-700 mb-2">Find the parameter count (e.g., "7B", "13B", "70B") in the model card title or description.</p>
                  <a href="https://huggingface.co/models" target="_blank" class="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                    Browse Models
                  </a>
                </div>
                <div class="bg-white rounded-lg p-4 border border-blue-200">
                  <div class="flex items-center mb-2">
                    <span class="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full mr-2">2</span>
                    <span class="font-semibold text-blue-900">Quantization</span>
                  </div>
                  <p class="text-gray-700 mb-2">Check for keywords like "AWQ", "GPTQ", "4-bit", "8-bit" in the model name or tags.</p>
                  <button @click="showQuantizationGuide = !showQuantizationGuide" class="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Quantization Guide
                  </button>
                </div>
                <div class="bg-white rounded-lg p-4 border border-blue-200">
                  <div class="flex items-center mb-2">
                    <span class="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full mr-2">3</span>
                    <span class="font-semibold text-blue-900">Model ID</span>
                  </div>
                  <p class="text-gray-700 mb-2">Copy the full repository path from the model page URL (e.g., "meta-llama/Llama-2-7b-hf").</p>
                  <div class="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                    huggingface.co/[owner]/[model-name]
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Quantization Selection Guide (toggleable) -->
        <div v-if="showQuantizationGuide" class="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <div class="flex items-start justify-between mb-4">
            <h4 class="text-lg font-semibold text-amber-900">Quantization Selection Guide</h4>
            <button @click="showQuantizationGuide = false" class="text-amber-600 hover:text-amber-800">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Quantization Comparison -->
            <div>
              <h5 class="font-semibold text-amber-900 mb-3">Performance vs Quality Trade-offs</h5>
              <div class="space-y-3">
                <div class="bg-white rounded-lg p-4 border border-amber-200">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-gray-900">FP16 (Full Precision)</span>
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Recommended for Research</span>
                  </div>
                  <div class="flex justify-between text-sm mb-2">
                    <div class="flex items-center">
                      <span class="text-gray-600 mr-2">Quality:</span>
                      <div class="flex space-x-0.5">
                        <div v-for="n in 5" :key="n" class="w-2 h-2 rounded-full bg-green-400"></div>
                      </div>
                    </div>
                    <div class="flex items-center">
                      <span class="text-gray-600 mr-2">Speed:</span>
                      <div class="flex space-x-0.5">
                        <div v-for="n in 2" :key="n" class="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <div v-for="n in 3" :key="n+2" class="w-2 h-2 rounded-full bg-gray-200"></div>
                      </div>
                    </div>
                  </div>
                  <p class="text-xs text-gray-600">Best quality, highest memory usage (100%)</p>
                </div>
                
                <div class="bg-white rounded-lg p-4 border border-amber-200">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-gray-900">AWQ 4-bit</span>
                    <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Recommended for Production</span>
                  </div>
                  <div class="flex justify-between text-sm mb-2">
                    <div class="flex items-center">
                      <span class="text-gray-600 mr-2">Quality:</span>
                      <div class="flex space-x-0.5">
                        <div v-for="n in 4" :key="n" class="w-2 h-2 rounded-full bg-green-400"></div>
                        <div class="w-2 h-2 rounded-full bg-gray-200"></div>
                      </div>
                    </div>
                    <div class="flex items-center">
                      <span class="text-gray-600 mr-2">Speed:</span>
                      <div class="flex space-x-0.5">
                        <div v-for="n in 4" :key="n" class="w-2 h-2 rounded-full bg-green-400"></div>
                        <div class="w-2 h-2 rounded-full bg-gray-200"></div>
                      </div>
                    </div>
                  </div>
                  <p class="text-xs text-gray-600">Excellent balance, ~25% memory usage</p>
                </div>
                
                <div class="bg-white rounded-lg p-4 border border-amber-200">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-gray-900">GPTQ 4-bit</span>
                    <span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">Alternative Option</span>
                  </div>
                  <div class="flex justify-between text-sm mb-2">
                    <div class="flex items-center">
                      <span class="text-gray-600 mr-2">Quality:</span>
                      <div class="flex space-x-0.5">
                        <div v-for="n in 4" :key="n" class="w-2 h-2 rounded-full bg-green-400"></div>
                        <div class="w-2 h-2 rounded-full bg-gray-200"></div>
                      </div>
                    </div>
                    <div class="flex items-center">
                      <span class="text-gray-600 mr-2">Speed:</span>
                      <div class="flex space-x-0.5">
                        <div v-for="n in 4" :key="n" class="w-2 h-2 rounded-full bg-green-400"></div>
                        <div class="w-2 h-2 rounded-full bg-gray-200"></div>
                      </div>
                    </div>
                  </div>
                  <p class="text-xs text-gray-600">Similar to AWQ, ~25% memory usage</p>
                </div>
              </div>
            </div>
            
            <!-- Use Case Recommendations -->
            <div>
              <h5 class="font-semibold text-amber-900 mb-3">Choose Based on Your Use Case</h5>
              <div class="space-y-3">
                <div class="bg-white rounded-lg p-4 border border-amber-200">
                  <div class="flex items-center mb-2">
                    <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                    <span class="font-medium text-blue-900">Research & Development</span>
                  </div>
                  <p class="text-sm text-gray-700 mb-2">Use <strong>FP16</strong> for maximum accuracy when fine-tuning or evaluating models.</p>
                  <div class="text-xs text-gray-600">✓ Highest quality results</div>
                </div>
                
                <div class="bg-white rounded-lg p-4 border border-amber-200">
                  <div class="flex items-center mb-2">
                    <svg class="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                    </svg>
                    <span class="font-medium text-green-900">Production Deployment</span>
                  </div>
                  <p class="text-sm text-gray-700 mb-2">Use <strong>AWQ 4-bit</strong> for the best balance of speed, quality, and memory efficiency.</p>
                  <div class="text-xs text-gray-600">✓ 75% memory savings ✓ Great performance</div>
                </div>
                
                <div class="bg-white rounded-lg p-4 border border-amber-200">
                  <div class="flex items-center mb-2">
                    <svg class="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    <span class="font-medium text-purple-900">High-Throughput Serving</span>
                  </div>
                  <p class="text-sm text-gray-700 mb-2">Use <strong>INT8</strong> or <strong>INT4</strong> for maximum speed when quality requirements are flexible.</p>
                  <div class="text-xs text-gray-600">✓ Fastest inference ✓ Lowest memory</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Manual Entry Form -->
      <div class="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-8 border border-gray-200 shadow-sm">
        <div class="mb-6">
          <h4 class="text-lg font-semibold text-gray-900 mb-2">Model Configuration</h4>
          <p class="text-gray-600">Fill in the details below to add your custom model</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <!-- Model Name with enhanced guidance -->
          <div class="md:col-span-4">
            <label for="manual-model-name" class="block text-sm font-semibold text-gray-900 mb-3">
              Model Name
              <span class="text-red-500">*</span>
              <button
                type="button"
                class="ml-2 inline-flex items-center text-gray-400 hover:text-gray-600"
                @click="showNameHelp = !showNameHelp"
                title="Click for help"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>
                </svg>
              </button>
            </label>
            
            <!-- Name help tooltip -->
            <div v-if="showNameHelp" class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p class="text-blue-800 font-medium mb-1">Choose a descriptive name:</p>
              <ul class="text-blue-700 space-y-1 text-xs">
                <li>• Include model family (e.g., "Llama", "Mistral")</li>
                <li>• Include size (e.g., "7B", "13B", "70B")</li>
                <li>• Include variant if applicable (e.g., "Chat", "Instruct")</li>
              </ul>
              <div class="mt-2 text-xs text-blue-600">
                <strong>Examples:</strong> "Llama 2 7B Chat", "Mistral 7B Instruct", "Custom GPT 13B"
              </div>
            </div>
            
            <input
              id="manual-model-name"
              v-model="manualModel.name"
              type="text"
              placeholder="e.g., Custom Llama 70B"
              :class="[
                'w-full px-4 py-3 border rounded-xl font-medium placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                manualModelNameError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 hover:border-gray-400 focus:bg-white'
              ]"
              @blur="validateManualModelName"
              @input="clearFieldError('name')"
            />
            
            <!-- Enhanced error display -->
            <div v-if="manualModelNameError" class="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-red-600 text-sm font-medium flex items-center">
                <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                {{ manualModelNameError }}
              </p>
              <p class="text-red-500 text-xs mt-1">💡 Tip: Use a unique, descriptive name that includes the model size</p>
            </div>
            
            <!-- Success indicator -->
            <div v-else-if="manualModel.name.trim() && !manualModelNameError" class="mt-2 flex items-center text-green-600 text-sm">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
              </svg>
              Looks good!
            </div>
          </div>
          
          <!-- Model Size with enhanced guidance -->
          <div class="md:col-span-3">
            <label for="manual-model-size" class="block text-sm font-semibold text-gray-900 mb-3">
              Model Size (Billion Parameters)
              <span class="text-red-500">*</span>
              <button
                type="button"
                class="ml-2 inline-flex items-center text-gray-400 hover:text-gray-600"
                @click="showSizeHelp = !showSizeHelp"
                title="Click for help"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>
                </svg>
              </button>
            </label>
            
            <!-- Size help tooltip -->
            <div v-if="showSizeHelp" class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p class="text-blue-800 font-medium mb-1">Common model sizes:</p>
              <ul class="text-blue-700 space-y-1 text-xs">
                <li>• <strong>7B:</strong> Fast, good for chatbots</li>
                <li>• <strong>13B:</strong> Balanced performance</li>
                <li>• <strong>30-35B:</strong> High quality</li>
                <li>• <strong>70B+:</strong> Best quality, needs more GPU memory</li>
              </ul>
            </div>
            
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
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 hover:border-gray-400 focus:bg-white'
              ]"
              @blur="validateManualModelSize"
              @input="clearFieldError('size')"
            />
            
            <!-- Enhanced error display -->
            <div v-if="manualModelSizeError" class="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-red-600 text-sm font-medium flex items-center">
                <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                {{ manualModelSizeError }}
              </p>
              <p class="text-red-500 text-xs mt-1">💡 Tip: Common sizes are 7, 13, 30, or 70 billion parameters</p>
            </div>
            
            <!-- Success indicator -->
            <div v-else-if="manualModel.size_billion > 0 && !manualModelSizeError" class="mt-2 flex items-center text-green-600 text-sm">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
              </svg>
              {{ getModelSizeCategory(manualModel.size_billion) }}
            </div>
          </div>
          
          <!-- Enhanced Quantization Selection -->
          <div class="md:col-span-3">
            <label for="manual-quantization" class="block text-sm font-semibold text-gray-900 mb-3">
              Quantization Method
              <span class="text-red-500">*</span>
              <button
                type="button"
                class="ml-2 inline-flex items-center text-gray-400 hover:text-gray-600"
                @click="showQuantizationHelp = !showQuantizationHelp"
                title="Click for help"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>
                </svg>
              </button>
            </label>
            
            <!-- Quantization help tooltip -->
            <div v-if="showQuantizationHelp" class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p class="text-blue-800 font-medium mb-1">Quick guide:</p>
              <ul class="text-blue-700 space-y-1 text-xs">
                <li>• <strong>FP16:</strong> Best quality (100% memory)</li>
                <li>• <strong>AWQ:</strong> Great balance (25% memory)</li>
                <li>• <strong>GPTQ:</strong> Similar to AWQ (25% memory)</li>
                <li>• <strong>INT8:</strong> Faster (50% memory)</li>
              </ul>
            </div>
            
            <select
              id="manual-quantization"
              v-model="manualModel.quantization"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all duration-200 bg-white"
              @change="updateManualMemoryFactor"
            >
              <option value="fp16">FP16 (Full Precision) - Best Quality</option>
              <option value="awq">AWQ 4-bit - Recommended</option>
              <option value="gptq">GPTQ 4-bit - Alternative</option>
              <option value="int8">INT8 8-bit - Balanced</option>
              <option value="int4">INT4 4-bit - Fastest</option>
            </select>
            
            <!-- Memory usage indicator -->
            <div class="mt-2 p-2 bg-white border border-gray-200 rounded-lg">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">Memory usage:</span>
                <div class="flex items-center space-x-2">
                  <span class="font-semibold text-gray-900">{{ Math.round(manualModel.memory_factor * 100) }}%</span>
                  <div class="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      class="h-2 rounded-full transition-all duration-300"
                      :class="getMemoryBarColor(manualModel.memory_factor)"
                      :style="{ width: `${manualModel.memory_factor * 100}%` }"
                    ></div>
                  </div>
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-1">{{ getQuantizationDescription(manualModel.quantization) }}</p>
            </div>
          </div>
          
          <!-- Enhanced Add Button -->
          <div class="md:col-span-2 flex items-end">
            <button
              @click="addManualModel"
              :disabled="!isManualModelValid || hasManualModelErrors"
              :class="[
                'w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm',
                !isManualModelValid || hasManualModelErrors
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 focus:ring-green-500 hover:shadow-md active:shadow-lg transform hover:-translate-y-0.5'
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

      <!-- Quantization Compatibility Warnings -->
      <div v-if="quantizationCompatibilityWarnings.length > 0" class="mb-6" data-testid="quantization-warnings">
        <div
          v-for="warning in quantizationCompatibilityWarnings"
          :key="warning.type"
          class="mb-3 p-4 border rounded-xl"
          :class="warning.severity === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'"
        >
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg v-if="warning.severity === 'error'" class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
              <svg v-else class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div class="ml-3 flex-1">
              <h4 class="text-sm font-semibold"
                  :class="warning.severity === 'error' ? 'text-red-900' : 'text-amber-900'">
                {{ warning.title }}
              </h4>
              <p class="mt-1 text-sm"
                 :class="warning.severity === 'error' ? 'text-red-700' : 'text-amber-700'">
                {{ warning.message }}
              </p>
            </div>
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
import { loadModelData, validateModel } from '../lib/dataLoader.js'
import { fetchModelInfo, detectQuantizationType, getQuantizationFactor } from '../lib/huggingfaceApi.js'
import { useLoadingWithRetry, useDataLoadingState } from '../composables/useLoadingState.js'

// Props and emits
const emit = defineEmits(['update:selectedModels'])
const props = defineProps({
  selectedModels: {
    type: Array,
    default: () => [],
  },
})

// Loading state management
const { model: modelLoadingState, huggingface: hfLoadingState } = useDataLoadingState()
const {
  executeWithRetry,
  retryCount,
  lastError
} = useLoadingWithRetry('model-selector', {
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2
})

// Reactive data
const availableModels = ref([])
const selectedModels = ref(props.selectedModels)

// Enhanced multi-model selection features
const quantizationFilter = ref('')

// Error states for manual entry
const manualModelNameError = ref(null)
const manualModelSizeError = ref(null)
const manualModelError = ref(null)
const manualModelSuccess = ref(null)

// Hugging Face integration
const hfModelId = ref('')
const hfQuantization = ref('auto')
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

// UI state
const showQuantizationGuide = ref(false)
const showNameHelp = ref(false)
const showSizeHelp = ref(false)
const showQuantizationHelp = ref(false)
const showHFHelp = ref(false)
const showHFQuantHelp = ref(false)

// Computed properties for loading states
const isLoading = computed(() => modelLoadingState.isLoading.value)
const isLoadingHF = computed(() => hfLoadingState.isLoading.value)
const isRetrying = computed(() => retryCount.value > 0)

const loadError = computed(() => {
  if (lastError.value) {
    const error = lastError.value
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
      return 'Network connection failed. Please check your internet connection and try again.'
    } else if (error.message.includes('timeout')) {
      return 'Request timed out. The server might be busy. Please try again in a moment.'
    } else {
      return error.message || 'Failed to load model data. Please try again.'
    }
  }
  return ''
})

const uniqueQuantizations = computed(() => {
  const quantizations = selectedModels.value.map(model => model.quantization)
  return [...new Set(quantizations)]
})

const isManualModelValid = computed(() => {
  const isValid = !!(manualModel.value.name.trim() &&
         manualModel.value.size_billion > 0 &&
         manualModel.value.quantization)
  return isValid
})

const hasManualModelErrors = computed(() => {
  return !!(manualModelNameError.value || manualModelSizeError.value)
})

// Enhanced computed properties for quantization awareness
const filteredModels = computed(() => {
  if (!quantizationFilter.value) return availableModels.value
  
  return availableModels.value.filter(model => {
    // Filter by actual quantization property
    return model.quantization === quantizationFilter.value
  })
})

const areAllFilteredSelected = computed(() => {
  return filteredModels.value.length > 0 && 
         filteredModels.value.every(model => selectedModels.value.some(selected => selected.name === model.name))
})

const selectedModelsInfo = computed(() => {
  return selectedModels.value
})

const quantizationCompatibilityWarnings = computed(() => {
  const warnings = []
  const selectedModelObjects = selectedModelsInfo.value
  
  if (selectedModelObjects.length > 1) {
    // Check for mixed quantization types
    const quantizationTypes = [...new Set(selectedModelObjects.map(model => model.quantization).filter(Boolean))]
    
    if (quantizationTypes.length > 1) {
      warnings.push({
        type: 'mixed-quantization',
        message: 'Mixed quantization types may have different memory requirements and performance characteristics.',
        severity: 'warning'
      })
    }
    
    // Check for memory size mismatches
    const memorySizes = selectedModelObjects.map(model => {
      const sizeMatch = model.name.match(/(\d+)B/i)
      return sizeMatch ? parseInt(sizeMatch[1]) : model.size_billion
    }).filter(size => size !== null && size !== undefined)
    
    if (memorySizes.length > 1) {
      const maxSize = Math.max(...memorySizes)
      const minSize = Math.min(...memorySizes)
      if (maxSize / minSize > 10) {
        warnings.push({
          type: 'memory-mismatch',
          message: 'Selected models have significantly different memory requirements. Consider grouping similar-sized models.',
          severity: 'info'
        })
      }
    }
  }
  
  return warnings
})

const averageMemoryFactor = computed(() => {
  if (selectedModelsInfo.value.length === 0) return 1
  
  // Calculate average memory factor based on selected models
  let totalFactor = 0
  selectedModelsInfo.value.forEach(model => {
    // Use explicit memory_factor if available, otherwise calculate from quantization
    const factor = model.memory_factor !== undefined 
      ? model.memory_factor 
      : getQuantizationFactor(model.quantization || 'fp16')
    totalFactor += factor
  })
  
  return totalFactor / selectedModelsInfo.value.length
})

// Methods
const loadModels = async () => {
  try {
    availableModels.value = await executeWithRetry(
      () => loadModelData(),
      `Loading model data${retryCount.value > 0 ? ` (Attempt ${retryCount.value + 1})` : ''}...`
    )
  } catch (error) {
    console.error('Failed to load model data after retries:', error)
    // Error is handled by the computed loadError property
  }
}

const retryLoadModels = async () => {
  await loadModels()
}

const useOfflineMode = () => {
  // Clear error and allow manual entry
  // User can still add models manually
  if (lastError.value) {
    lastError.value = null
  }
  availableModels.value = []
}

const fetchHuggingFaceModel = async () => {
  if (!hfModelId.value.trim()) return
  
  hfLoadingState.startLoading('Fetching model information from Hugging Face...')
  hfError.value = ''
  hfSuccess.value = ''
  
  try {
    const result = await fetchModelInfo(hfModelId.value)
    
    if (result.success) {
      const modelName = result.name || hfModelId.value.split('/').pop()
      const detectedQuantization = hfQuantization.value === 'auto' 
        ? detectQuantizationType(result) 
        : hfQuantization.value
      
      fetchedModel.value = {
        name: modelName,
        huggingface_id: hfModelId.value,
        quantization: detectedQuantization,
        memory_factor: getQuantizationFactor(detectedQuantization),
        size_billion: extractModelSize(modelName),
        custom: true
      }
      
      hfSuccess.value = `Successfully fetched model: ${modelName}`
    } else {
      hfError.value = result.error || 'Failed to fetch model information'
    }
  } catch (error) {
    console.error('Failed to fetch model info from HF API:', error)
    
    if (error.message.includes('not found') || error.message.includes('404')) {
      hfError.value = 'Model not found. Please check the model ID and try again.'
    } else if (error.message.includes('timeout') || error.message.includes('network')) {
      hfError.value = 'Network timeout. Please check your connection and try again.'
    } else {
      hfError.value = error.message || 'Failed to fetch model. Please try again.'
    }
  } finally {
    hfLoadingState.stopLoading()
  }
}

const retryHuggingFaceModel = async () => {
  await fetchHuggingFaceModel()
}

// Helper methods
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
    gguf: { speed: 4, quality: 3 }
  }
  return ratings[quantization.toLowerCase()] || { speed: 3, quality: 3 }
}

const getModelSizeCategory = (size) => {
  if (size < 3) return 'Small model (good for testing)'
  if (size < 10) return 'Standard size (good balance)'
  if (size < 20) return 'Large model (high quality)'
  if (size < 50) return 'Very large (excellent quality)'
  if (size < 100) return 'Enterprise scale (best quality)'
  return 'Massive model (specialized hardware needed)'
}

const extractModelSize = (name) => {
  // Try to extract size from model name
  const sizeMatch = name.match(/(\d+\.?\d*)B/i)
  if (sizeMatch) {
    return parseFloat(sizeMatch[1])
  }
  return 7 // Default fallback
}

const clearFieldError = (fieldName) => {
  if (fieldName === 'name') {
    manualModelNameError.value = null
  } else if (fieldName === 'size') {
    manualModelSizeError.value = null
  }
}

const clearHFError = () => {
  hfError.value = ''
}

const switchToManualEntry = () => {
  // Pre-fill manual entry with HF data
  if (hfModelId.value) {
    const modelParts = hfModelId.value.split('/')
    manualModel.value.name = modelParts[modelParts.length - 1] || 'model'
    manualModel.value.huggingface_id = hfModelId.value
  }
  
  // Clear HF error and reset state
  clearHFError()
  fetchedModel.value = null
  hfSuccess.value = false
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

// Bulk selection methods
const selectAllFiltered = () => {
  filteredModels.value.forEach(model => {
    if (!selectedModels.value.some(selected => selected.name === model.name)) {
      // Use the actual model from the filtered list, not a new object
      addModel(model)
    }
  })
}

const clearAllFiltered = () => {
  const filteredModelNames = filteredModels.value.map(model => model.name)
  selectedModels.value = selectedModels.value.filter(selected => 
    !filteredModelNames.includes(selected.name)
  )
  emit('update:selectedModels', selectedModels.value)
}

// Lifecycle
onMounted(() => {
  loadModels()
})
</script>
