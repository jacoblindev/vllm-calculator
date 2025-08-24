/**
 * Utility functions for interacting with Hugging Face Hub API
 */

const HF_API_BASE = 'https://huggingface.co'

/**
 * Fetch model information from Hugging Face Hub
 * @param {string} modelId - The model ID (e.g., "microsoft/DialoGPT-medium")
 * @returns {Promise<Object>} Model information including config and files
 */
export async function fetchModelInfo(modelId) {
  try {
    // First try to get the model config
    const configResponse = await fetch(`${HF_API_BASE}/api/models/${modelId}`)
    
    if (!configResponse.ok) {
      throw new Error(`Failed to fetch model info: ${configResponse.status}`)
    }
    
    const modelInfo = await configResponse.json()
    
    // Try to get additional config details
    const configDetailsResponse = await fetch(`${HF_API_BASE}/${modelId}/raw/main/config.json`)
    let configDetails = null
    
    if (configDetailsResponse.ok) {
      configDetails = await configDetailsResponse.json()
    }
    
    return {
      ...modelInfo,
      config: configDetails,
      success: true
    }
  } catch (error) {
    console.warn('Failed to fetch model info from HF API:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Extract model size from model info
 * @param {Object} modelInfo - Model information from HF API
 * @returns {number|null} Model size in billions of parameters
 */
export function extractModelSize(modelInfo) {
  if (!modelInfo.success || !modelInfo.config) {
    return null
  }
  
  const config = modelInfo.config
  
  // Common patterns for model size detection
  if (config.n_parameters) {
    return config.n_parameters / 1e9 // Convert to billions
  }
  
  if (config.num_parameters) {
    return config.num_parameters / 1e9
  }
  
  // Try to extract from model name patterns
  const modelName = modelInfo.modelId || modelInfo.id || ''
  const sizeMatch = modelName.match(/(\d+(?:\.\d+)?)[bB]/i)
  
  if (sizeMatch) {
    return parseFloat(sizeMatch[1])
  }
  
  return null
}

/**
 * Detect quantization type from model info
 * @param {Object} modelInfo - Model information from HF API
 * @returns {string} Quantization type: 'fp16', 'awq', 'gptq', or 'unknown'
 */
export function detectQuantizationType(modelInfo) {
  if (!modelInfo.success) {
    return 'unknown'
  }
  
  const modelName = (modelInfo.modelId || modelInfo.id || '').toLowerCase()
  const tags = modelInfo.tags || []
  
  // Check tags first
  if (tags.includes('awq')) return 'awq'
  if (tags.includes('gptq')) return 'gptq'
  if (tags.includes('ggml') || tags.includes('gguf')) return 'ggml'
  
  // Check model name patterns
  if (modelName.includes('awq')) return 'awq'
  if (modelName.includes('gptq')) return 'gptq'
  if (modelName.includes('ggml') || modelName.includes('gguf')) return 'ggml'
  
  // Default to fp16 for most models
  return 'fp16'
}

/**
 * Get quantization factor for memory calculations
 * @param {string} quantizationType - Type of quantization
 * @returns {number} Memory factor (1.0 = full precision, 0.5 = 4-bit, etc.)
 */
export function getQuantizationFactor(quantizationType) {
  const factors = {
    'fp32': 1.0,
    'fp16': 1.0,
    'awq': 0.5,    // 4-bit quantization
    'gptq': 0.5,   // 4-bit quantization
    'ggml': 0.5,   // Typically 4-bit
    'gguf': 0.5,   // Typically 4-bit
    'unknown': 1.0 // Default to full precision for safety
  }
  
  return factors[quantizationType] || 1.0
}
