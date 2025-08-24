/**
 * Utility functions for loading GPU and model data
 */

/**
 * Load GPU data from static JSON file
 * @returns {Promise<Array>} Array of GPU objects with name and vram_gb
 */
export async function loadGPUData() {
  try {
    const response = await fetch('/data/gpus.json')
    if (!response.ok) {
      throw new Error(`Failed to load GPU data: ${response.status}`)
    }
    const gpus = await response.json()
    return gpus
  } catch (error) {
    console.error('Error loading GPU data:', error)
    // Return fallback data
    return [
      { name: "NVIDIA A100 (80GB)", vram_gb: 80 },
      { name: "NVIDIA H100 (80GB)", vram_gb: 80 },
      { name: "NVIDIA RTX 4090", vram_gb: 24 },
      { name: "NVIDIA V100 (32GB)", vram_gb: 32 }
    ]
  }
}

/**
 * Load model data from static JSON file
 * @returns {Promise<Array>} Array of model objects with quantization variants
 */
export async function loadModelData() {
  try {
    const response = await fetch('/data/models.json')
    if (!response.ok) {
      throw new Error(`Failed to load model data: ${response.status}`)
    }
    const models = await response.json()
    return models
  } catch (error) {
    console.error('Error loading model data:', error)
    // Return fallback data
    return [
      {
        name: "Llama 2 7B",
        hf_id: "meta-llama/Llama-2-7b-hf",
        size_gb: 13.5,
        quantization: "fp16",
        memory_factor: 1.0
      },
      {
        name: "Llama 2 13B",
        hf_id: "meta-llama/Llama-2-13b-hf",
        size_gb: 26.0,
        quantization: "fp16",
        memory_factor: 1.0
      }
    ]
  }
}

/**
 * Validate GPU configuration
 * @param {Object} gpu - GPU object to validate
 * @returns {boolean} Whether the GPU configuration is valid
 */
export function validateGPU(gpu) {
  if (!gpu) return false
  
  return (
    typeof gpu.name === 'string' &&
    gpu.name.trim().length > 0 &&
    typeof gpu.vram_gb === 'number' &&
    gpu.vram_gb > 0
  )
}

/**
 * Validate model configuration
 * @param {Object} model - Model object to validate
 * @returns {boolean} Whether the model configuration is valid
 */
export function validateModel(model) {
  return (
    model &&
    typeof model.name === 'string' &&
    model.name.trim().length > 0 &&
    typeof model.size_gb === 'number' &&
    model.size_gb > 0 &&
    typeof model.memory_factor === 'number' &&
    model.memory_factor > 0 &&
    model.memory_factor <= 1.0
  )
}

/**
 * Create a custom GPU object
 * @param {string} name - GPU name
 * @param {number} vramGB - VRAM in GB
 * @returns {Object} GPU object
 */
export function createCustomGPU(name, vramGB) {
  return {
    name: name.trim(),
    vram_gb: vramGB,
    custom: true
  }
}

/**
 * Create a custom model object
 * @param {string} name - Model name
 * @param {number} sizeGB - Model size in GB
 * @param {string} quantization - Quantization type
 * @param {number} memoryFactor - Memory factor for quantization
 * @returns {Object} Model object
 */
export function createCustomModel(name, sizeGB, quantization = 'fp16', memoryFactor = 1.0) {
  return {
    name: name.trim(),
    size_gb: sizeGB,
    quantization,
    memory_factor: memoryFactor,
    custom: true
  }
}
