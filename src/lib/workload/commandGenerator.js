/**
 * vLLM Command Generator Module
 * 
 * This module provides functions for generating vLLM command-line arguments
 * and complete command strings for different deployment scenarios.
 * 
 * Key features:
 * - Command string generation from configuration objects
 * - Support for all vLLM parameters and options
 * - Validation of command arguments
 * - Template generation for different deployment types
 * 
 * References:
 * - vLLM CLI documentation
 * - OpenAI API server parameters
 * - Deployment best practices
 */

// ================================
// COMMAND GENERATION CONSTANTS
// ================================

/**
 * vLLM parameter definitions and their types
 */
export const VLLM_PARAMETERS = {
  // Model and tokenizer
  model: { type: 'string', required: true, description: 'Model name or path' },
  tokenizer: { type: 'string', description: 'Tokenizer name or path' },
  'tokenizer-mode': { type: 'string', options: ['auto', 'slow'], description: 'Tokenizer mode' },
  'trust-remote-code': { type: 'boolean', description: 'Trust remote code in model' },
  'download-dir': { type: 'string', description: 'Directory to download and cache model weights' },
  'load-format': { type: 'string', options: ['auto', 'pt', 'safetensors', 'npcache', 'dummy'], description: 'Model weight loading format' },
  'revision': { type: 'string', description: 'Model revision (branch, tag, or commit)' },
  'code-revision': { type: 'string', description: 'Code revision for trust-remote-code' },
  
  // Model execution
  dtype: { type: 'string', options: ['auto', 'half', 'float16', 'bfloat16', 'float', 'float32'], description: 'Model data type' },
  'kv-cache-dtype': { type: 'string', options: ['auto', 'fp8', 'fp8_e5m2', 'fp8_e4m3'], description: 'KV cache data type' },
  quantization: { type: 'string', options: ['awq', 'gptq', 'squeezellm', 'fp8'], description: 'Quantization method' },
  'enforce-eager': { type: 'boolean', description: 'Disable CUDA graphs for debugging' },
  'max-context-len-to-capture': { type: 'number', description: 'Maximum context length for CUDA graphs' },
  
  // Memory and performance
  'gpu-memory-utilization': { type: 'number', min: 0.1, max: 1.0, description: 'GPU memory utilization fraction' },
  'swap-space': { type: 'string', description: 'CPU swap space size (e.g., 4GB)' },
  'cpu-offload-gb': { type: 'number', description: 'CPU offload memory in GB' },
  'max-num-batched-tokens': { type: 'number', description: 'Maximum batched tokens' },
  'max-num-seqs': { type: 'number', description: 'Maximum concurrent sequences' },
  'max-model-len': { type: 'number', description: 'Maximum model context length' },
  'max-seq-len-to-capture': { type: 'number', description: 'Maximum sequence length for CUDA graphs' },
  
  // Chunked prefill
  'enable-chunked-prefill': { type: 'boolean', description: 'Enable chunked prefill' },
  'max-chunked-prefill-tokens': { type: 'number', description: 'Maximum tokens in chunked prefill' },
  
  // Block management
  'block-size': { type: 'number', options: [8, 16, 32], description: 'KV cache block size' },
  'num-lookahead-slots': { type: 'number', description: 'Lookahead slots for speculative decoding' },
  'seed': { type: 'number', description: 'Random seed' },
  
  // Parallelism
  'tensor-parallel-size': { type: 'number', description: 'Tensor parallelism size' },
  'pipeline-parallel-size': { type: 'number', description: 'Pipeline parallelism size' },
  'distributed-executor-backend': { type: 'string', options: ['ray', 'mp'], description: 'Distributed backend' },
  
  // Server configuration
  host: { type: 'string', description: 'Server host address' },
  port: { type: 'number', description: 'Server port' },
  'uvloop': { type: 'boolean', description: 'Use uvloop event loop' },
  'allow-credentials': { type: 'boolean', description: 'Allow credentials in CORS' },
  'allowed-origins': { type: 'array', description: 'Allowed CORS origins' },
  'allowed-methods': { type: 'array', description: 'Allowed CORS methods' },
  'allowed-headers': { type: 'array', description: 'Allowed CORS headers' },
  
  // API configuration
  'api-key': { type: 'string', description: 'API key for authentication' },
  'served-model-name': { type: 'string', description: 'Model name in API responses' },
  'chat-template': { type: 'string', description: 'Chat template file path' },
  'response-role': { type: 'string', description: 'Response role in chat completions' },
  
  // Logging and monitoring
  'disable-log-stats': { type: 'boolean', description: 'Disable logging statistics' },
  'disable-log-requests': { type: 'boolean', description: 'Disable logging requests' },
  'max-log-len': { type: 'number', description: 'Maximum log entry length' },
  
  // Engine arguments
  'worker-use-ray': { type: 'boolean', description: 'Use Ray for workers' },
  'engine-use-ray': { type: 'boolean', description: 'Use Ray for engine' },
  'disable-custom-all-reduce': { type: 'boolean', description: 'Disable custom all-reduce kernels' },
  
  // Speculative decoding
  'speculative-model': { type: 'string', description: 'Speculative model name' },
  'num-speculative-tokens': { type: 'number', description: 'Number of speculative tokens' },
  'speculative-draft-tensor-parallel-size': { type: 'number', description: 'Draft model tensor parallel size' },
  
  // LoRA
  'enable-lora': { type: 'boolean', description: 'Enable LoRA adapters' },
  'lora-modules': { type: 'array', description: 'LoRA module configurations' },
  'max-lora-rank': { type: 'number', description: 'Maximum LoRA rank' },
  'max-loras': { type: 'number', description: 'Maximum number of LoRA adapters' },
  'max-cpu-loras': { type: 'number', description: 'Maximum CPU LoRA adapters' },
  
  // Prefix caching
  'enable-prefix-caching': { type: 'boolean', description: 'Enable prefix caching' },
  'disable-sliding-window': { type: 'boolean', description: 'Disable sliding window attention' },
}

/**
 * Default command templates for different deployment scenarios
 */
export const COMMAND_TEMPLATES = {
  development: {
    host: '127.0.0.1',
    port: 8000,
    'gpu-memory-utilization': 0.85,
    'disable-log-requests': false,
    'max-log-len': 200
  },
  
  production: {
    host: '0.0.0.0',
    port: 8000,
    'gpu-memory-utilization': 0.90,
    'disable-log-requests': true,
    'disable-log-stats': false,
    'max-log-len': 100
  },
  
  debugging: {
    host: '127.0.0.1',
    port: 8000,
    'gpu-memory-utilization': 0.75,
    'enforce-eager': true,
    'disable-log-requests': false,
    'disable-log-stats': false,
    'max-log-len': 500
  },
  
  'high-throughput': {
    host: '0.0.0.0',
    port: 8000,
    'gpu-memory-utilization': 0.95,
    'max-num-seqs': 256,
    'max-num-batched-tokens': 8192,
    'enable-chunked-prefill': true,
    'disable-log-requests': true
  },
  
  'low-latency': {
    host: '0.0.0.0',
    port: 8000,
    'gpu-memory-utilization': 0.80,
    'max-num-seqs': 32,
    'max-num-batched-tokens': 2048,
    'block-size': 8,
    'disable-log-requests': true
  }
}

// ================================
// COMMAND GENERATION FUNCTIONS
// ================================

/**
 * Generate vLLM command string from configuration arguments
 * @param {object} args - vLLM arguments object
 * @param {object} options - Generation options
 * @param {string} options.entrypoint - vLLM entrypoint ('api_server', 'offline_inference')
 * @param {boolean} options.includeComments - Include parameter descriptions as comments
 * @param {boolean} options.multiline - Format as multiline command
 * @returns {string} Complete vLLM command
 */
export function generateVLLMCommand(args, options = {}) {
  const {
    entrypoint = 'api_server',
    includeComments = false,
    multiline = false
  } = options

  // Validate entrypoint
  const validEntrypoints = ['api_server', 'offline_inference', 'openai.api_server']
  if (!validEntrypoints.some(ep => entrypoint.includes(ep))) {
    throw new Error(`Invalid entrypoint: ${entrypoint}. Valid options: ${validEntrypoints.join(', ')}`)
  }

  // Start with base command
  let command = entrypoint === 'api_server' || entrypoint.includes('api_server') 
    ? 'python -m vllm.entrypoints.openai.api_server'
    : 'python -m vllm.entrypoints.offline_inference'
  
  const parts = []
  
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue
    
    // Convert camelCase to kebab-case
    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    
    // Validate parameter if it exists in our definitions
    if (VLLM_PARAMETERS[kebabKey]) {
      const paramDef = VLLM_PARAMETERS[kebabKey]
      const validationResult = validateParameter(kebabKey, value, paramDef)
      if (!validationResult.isValid) {
        console.warn(`Invalid parameter ${kebabKey}: ${validationResult.error}`)
      }
    }
    
    let paramString = ''
    
    if (value === true) {
      paramString = `--${kebabKey}`
    } else if (value === false) {
      // Skip false boolean values
      continue
    } else if (Array.isArray(value)) {
      paramString = `--${kebabKey} ${value.join(' ')}`
    } else {
      paramString = `--${kebabKey} ${value}`
    }
    
    // Add comment if requested
    if (includeComments && VLLM_PARAMETERS[kebabKey]) {
      paramString += ` # ${VLLM_PARAMETERS[kebabKey].description}`
    }
    
    parts.push(paramString)
  }
  
  if (multiline) {
    return command + ' \\\n  ' + parts.join(' \\\n  ')
  } else {
    return command + (parts.length > 0 ? ' ' + parts.join(' ') : '')
  }
}

/**
 * Generate command from template
 * @param {string} templateName - Template name
 * @param {object} overrides - Template overrides
 * @param {object} options - Generation options
 * @returns {string} Generated command
 */
export function generateFromTemplate(templateName, overrides = {}, options = {}) {
  if (!COMMAND_TEMPLATES[templateName]) {
    throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(COMMAND_TEMPLATES).join(', ')}`)
  }
  
  const template = { ...COMMAND_TEMPLATES[templateName] }
  const args = { ...template, ...overrides }
  
  return generateVLLMCommand(args, options)
}

/**
 * Generate configuration object from requirements
 * @param {object} requirements - Deployment requirements
 * @returns {object} vLLM configuration object
 */
export function generateConfiguration(requirements) {
  const {
    deploymentType = 'production',
    modelPath,
    gpuCount = 1,
    maxSequences = 128,
    maxSequenceLength = 2048,
    memoryUtilization = 0.90,
    quantization,
    enableFeatures = [],
    customSettings = {}
  } = requirements

  // Start with template
  const baseConfig = deploymentType in COMMAND_TEMPLATES 
    ? { ...COMMAND_TEMPLATES[deploymentType] }
    : { ...COMMAND_TEMPLATES.production }

  // Core configuration
  const config = {
    ...baseConfig,
    model: modelPath || 'MODEL_PATH',
    'max-num-seqs': maxSequences,
    'max-model-len': maxSequenceLength,
    'gpu-memory-utilization': memoryUtilization,
    ...customSettings
  }

  // Multi-GPU configuration
  if (gpuCount > 1) {
    config['tensor-parallel-size'] = gpuCount
  }

  // Quantization
  if (quantization && quantization !== 'fp16') {
    config.quantization = quantization
  }

  // Feature flags
  enableFeatures.forEach(feature => {
    switch (feature) {
      case 'chunked-prefill':
        config['enable-chunked-prefill'] = true
        config['max-chunked-prefill-tokens'] = Math.min(maxSequenceLength / 2, 2048)
        break
      case 'prefix-caching':
        config['enable-prefix-caching'] = true
        break
      case 'lora':
        config['enable-lora'] = true
        config['max-loras'] = 16
        break
      case 'speculative':
        config['num-speculative-tokens'] = 5
        break
      default:
        console.warn(`Unknown feature: ${feature}`)
    }
  })

  return config
}

// ================================
// COMMAND VALIDATION
// ================================

/**
 * Validate a single parameter
 * @param {string} key - Parameter key
 * @param {any} value - Parameter value
 * @param {object} definition - Parameter definition
 * @returns {object} Validation result
 */
function validateParameter(key, value, definition) {
  const { type, options, min, max, required } = definition

  if (required && (value === undefined || value === null)) {
    return { isValid: false, error: 'Required parameter is missing' }
  }

  if (value === undefined || value === null) {
    return { isValid: true }
  }

  // Type validation
  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' }
      }
      if (options && !options.includes(value)) {
        return { isValid: false, error: `Must be one of: ${options.join(', ')}` }
      }
      break

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { isValid: false, error: 'Must be a number' }
      }
      if (min !== undefined && value < min) {
        return { isValid: false, error: `Must be at least ${min}` }
      }
      if (max !== undefined && value > max) {
        return { isValid: false, error: `Must be at most ${max}` }
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { isValid: false, error: 'Must be a boolean' }
      }
      break

    case 'array':
      if (!Array.isArray(value)) {
        return { isValid: false, error: 'Must be an array' }
      }
      break
  }

  return { isValid: true }
}

/**
 * Validate complete command configuration
 * @param {object} config - Command configuration
 * @returns {object} Validation result with errors and warnings
 */
export function validateConfiguration(config) {
  const errors = []
  const warnings = []

  // Required parameters
  if (!config.model) {
    errors.push('Model path is required')
  }

  // Parameter validation
  for (const [key, value] of Object.entries(config)) {
    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    
    if (VLLM_PARAMETERS[kebabKey]) {
      const result = validateParameter(kebabKey, value, VLLM_PARAMETERS[kebabKey])
      if (!result.isValid) {
        errors.push(`${kebabKey}: ${result.error}`)
      }
    }
  }

  // Cross-parameter validation
  if (config['max-num-seqs'] && config['max-num-batched-tokens']) {
    if (config['max-num-batched-tokens'] < config['max-num-seqs']) {
      warnings.push('max-num-batched-tokens should typically be >= max-num-seqs')
    }
  }

  if (config['tensor-parallel-size'] && config['pipeline-parallel-size']) {
    warnings.push('Using both tensor and pipeline parallelism - ensure sufficient GPUs')
  }

  if (config['gpu-memory-utilization'] && config['gpu-memory-utilization'] > 0.95) {
    warnings.push('Very high GPU memory utilization may cause OOM errors')
  }

  // Performance recommendations
  if (config['enable-chunked-prefill'] && !config['max-chunked-prefill-tokens']) {
    warnings.push('Consider setting max-chunked-prefill-tokens when enabling chunked prefill')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations: generateConfigRecommendations(config)
  }
}

/**
 * Generate configuration recommendations
 * @param {object} config - Configuration object
 * @returns {string[]} List of recommendations
 */
function generateConfigRecommendations(config) {
  const recommendations = []

  // Memory optimization
  if (!config['swap-space'] && config['gpu-memory-utilization'] < 0.85) {
    recommendations.push('Consider adding swap space for better memory utilization')
  }

  // Performance optimization
  if (!config['enable-chunked-prefill'] && config['max-model-len'] > 4096) {
    recommendations.push('Enable chunked prefill for better handling of long sequences')
  }

  if (!config['enable-prefix-caching'] && config['max-num-seqs'] > 32) {
    recommendations.push('Consider enabling prefix caching for improved efficiency with similar prompts')
  }

  // Production settings
  if (config.host === '0.0.0.0' && !config['api-key']) {
    recommendations.push('Consider adding API key authentication for production deployment')
  }

  return recommendations
}

// ================================
// DEPLOYMENT HELPERS
// ================================

/**
 * Generate Docker command for vLLM deployment
 * @param {object} config - vLLM configuration
 * @param {object} dockerOptions - Docker-specific options
 * @returns {string} Docker command
 */
export function generateDockerCommand(config, dockerOptions = {}) {
  const {
    image = 'vllm/vllm-openai:latest',
    gpuCount = 1,
    sharedMemorySize = '4g',
    volumeMounts = [],
    environmentVars = {},
    containerName = 'vllm-server'
  } = dockerOptions

  const vllmCommand = generateVLLMCommand(config)
  
  let dockerCommand = `docker run -d --name ${containerName}`
  
  // GPU support
  if (gpuCount === 'all') {
    dockerCommand += ' --gpus all'
  } else {
    dockerCommand += ` --gpus ${gpuCount}`
  }
  
  // Shared memory
  dockerCommand += ` --shm-size=${sharedMemorySize}`
  
  // Port mapping
  if (config.port) {
    dockerCommand += ` -p ${config.port}:${config.port}`
  }
  
  // Volume mounts
  volumeMounts.forEach(mount => {
    dockerCommand += ` -v ${mount.host}:${mount.container}`
  })
  
  // Environment variables
  Object.entries(environmentVars).forEach(([key, value]) => {
    dockerCommand += ` -e ${key}=${value}`
  })
  
  dockerCommand += ` ${image} ${vllmCommand.replace('python -m vllm.entrypoints.openai.api_server', '')}`
  
  return dockerCommand
}

/**
 * Generate Kubernetes deployment YAML
 * @param {object} config - vLLM configuration
 * @param {object} k8sOptions - Kubernetes-specific options
 * @returns {string} Kubernetes YAML
 */
export function generateKubernetesYAML(config, k8sOptions = {}) {
  const {
    name = 'vllm-deployment',
    namespace = 'default',
    replicas = 1,
    image = 'vllm/vllm-openai:latest',
    resources = {},
    nodeSelector = {}
  } = k8sOptions

  const vllmArgs = Object.entries(config)
    .filter(([key, value]) => value !== false && value !== undefined)
    .map(([key, value]) => {
      const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      if (value === true) return `--${kebabKey}`
      return `--${kebabKey}=${value}`
    })

  const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: vllm
  template:
    metadata:
      labels:
        app: vllm
    spec:
      containers:
      - name: vllm
        image: ${image}
        command: ["python", "-m", "vllm.entrypoints.openai.api_server"]
        args:
${vllmArgs.map(arg => `          - "${arg}"`).join('\n')}
        ports:
        - containerPort: ${config.port || 8000}
        resources:
${resources.requests ? `          requests:\n${Object.entries(resources.requests).map(([k, v]) => `            ${k}: ${v}`).join('\n')}` : ''}
${resources.limits ? `          limits:\n${Object.entries(resources.limits).map(([k, v]) => `            ${k}: ${v}`).join('\n')}` : ''}
${Object.keys(nodeSelector).length > 0 ? `      nodeSelector:\n${Object.entries(nodeSelector).map(([k, v]) => `        ${k}: ${v}`).join('\n')}` : ''}
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}-service
  namespace: ${namespace}
spec:
  selector:
    app: vllm
  ports:
  - port: ${config.port || 8000}
    targetPort: ${config.port || 8000}
  type: ClusterIP
`.trim()

  return yaml
}
