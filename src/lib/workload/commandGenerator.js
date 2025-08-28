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

import { VLLM_PARAMETERS } from '../configs/optimizationConfigs.js'

// ================================
// COMMAND GENERATION CONSTANTS (imported from central config)
// ================================

// Re-export for backward compatibility
export { VLLM_PARAMETERS }

/**
 * Parameter mappings for command line generation
 */
export const PARAMETER_MAPPINGS = {
  model: { type: 'string', required: true, description: 'Model path or name' },
  'tensor-parallel-size': { type: 'number', description: 'Number of GPUs for tensor parallelism' },
  'gpu-memory-utilization': { type: 'number', min: 0, max: 1, description: 'GPU memory utilization' },
  'max-num-seqs': { type: 'number', min: 1, description: 'Maximum number of sequences' },
  'max-num-batched-tokens': { type: 'number', min: 1, description: 'Maximum batched tokens' },
  'max-model-len': { type: 'number', min: 1, description: 'Maximum model length' },
  'block-size': { type: 'number', min: 1, description: 'Block size for memory allocation' },
  quantization: { type: 'string', description: 'Quantization method' },
  'enable-chunked-prefill': { type: 'boolean', description: 'Enable chunked prefill' },
  'disable-log-stats': { type: 'boolean', description: 'Disable logging statistics' },
  host: { type: 'string', description: 'Host address' },
  port: { type: 'number', min: 1, max: 65535, description: 'Port number' },
  'api-key': { type: 'string', description: 'API key for authentication' },
}

// ================================
// COMMAND GENERATION TEMPLATES
// ================================

/**
 * Default command templates for different deployment scenarios
 */
export const COMMAND_TEMPLATES = {
  openai: {
    base: 'python -m vllm.entrypoints.openai.api_server',
    requiredParams: ['model'],
    host: '0.0.0.0',
    port: 8000,
    'gpu-memory-utilization': 0.90,
    'disable-log-requests': true,
    'disable-log-stats': false,
    'max-log-len': 100
  },
  
  offline: {
    base: 'python -m vllm.entrypoints.offline_inference',
    requiredParams: ['model'],
    'gpu-memory-utilization': 0.85,
    'max-model-len': 2048,
    'disable-log-stats': true
  },
  
  development: {
    base: 'python -m vllm.entrypoints.openai.api_server',
    requiredParams: ['model'],
    host: '127.0.0.1',
    port: 8000,
    'gpu-memory-utilization': 0.85,
    'disable-log-requests': false,
    'max-log-len': 200
  },
  
  production: {
    base: 'python -m vllm.entrypoints.openai.api_server',
    requiredParams: ['model'],
    host: '0.0.0.0',
    port: 8000,
    'gpu-memory-utilization': 0.90,
    'disable-log-requests': true,
    'disable-log-stats': false,
    'max-log-len': 100
  },
  
  debugging: {
    base: 'python -m vllm.entrypoints.openai.api_server',
    requiredParams: ['model'],
    host: '127.0.0.1',
    port: 8000,
    'gpu-memory-utilization': 0.75,
    'enforce-eager': true,
    'disable-log-requests': false,
    'disable-log-stats': false,
    'max-log-len': 500
  },
  
  'high-throughput': {
    base: 'python -m vllm.entrypoints.openai.api_server',
    requiredParams: ['model'],
    host: '0.0.0.0',
    port: 8000,
    'gpu-memory-utilization': 0.95,
    'max-num-seqs': 256,
    'max-num-batched-tokens': 8192,
    'enable-chunked-prefill': true,
    'disable-log-requests': true
  },
  
  'low-latency': {
    base: 'python -m vllm.entrypoints.openai.api_server',
    requiredParams: ['model'],
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
 * Generate a vLLM command string from configuration
 * @param {object} config - Configuration object
 * @param {object} options - Command generation options
 * @returns {string} Generated command string
 */
export function generateVLLMCommand(config, options = {}) {
  const {
    includeComments = false,
    includeOptional = true,
    format = 'python', // 'python', 'docker', 'compose'
    pythonModule = 'vllm.entrypoints.openai.api_server'
  } = options

  const warnings = []

  // Ensure model is present
  if (!config.model) {
    warnings.push('Missing required parameter: model. Command generation may fail.')
    config = { ...config, model: 'placeholder-model' }
  }

  // Build argument list
  const args = []
  const paramList = Object.entries(config).filter(([key]) => key !== 'model')

  if (format === 'docker') {
    args.push('docker run --gpus all --rm -p 8000:8000 vllm/vllm-openai')
    args.push(`--model ${config.model}`)
    paramList.forEach(([key, value]) => {
      args.push(`--${key.replace(/_/g, '-')} ${value}`)
    })
  } else if (format === 'compose') {
    // Compose service snippet
    const compose = [
      'services:',
      '  vllm:',
      '    image: vllm/vllm-openai',
      '    deploy:',
      '      resources:',
      '        reservations:',
      '          devices:',
      '            - driver: nvidia',
      '              count: all',
      '              capabilities: [gpu]',
      '    ports:',
      '      - "8000:8000"',
      '    command: >'
    ]
    let cmd = `      --model ${config.model}`
    paramList.forEach(([key, value]) => {
      cmd += ` \\\n        --${key.replace(/_/g, '-')} ${value}`
    })
    compose.push(cmd)
    return {
      command: compose.join('\n'),
      warnings,
      context: {}
    }
  } else {
    // Default: python
    args.push(`python -m ${pythonModule}`)
    args.push(`--model ${config.model}`)
    paramList.forEach(([key, value]) => {
      args.push(`--${key.replace(/_/g, '-')} ${value}`)
    })
  }

  return {
    command: args.join(' '),
    warnings,
    context: {}
  }
}

/**
 * Format a single parameter for command line
 * @param {string} key - Parameter name
 * @param {*} value - Parameter value
 * @param {boolean} includeComments - Whether to include comments
 * @returns {string} Formatted parameter string
 */
export function formatParameter(key, value, includeComments = false) {
  // Convert camelCase to kebab-case
  const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
  
  if (value === undefined || value === null) {
    return ''
  }

  let paramString = ''
  
  if (typeof value === 'boolean') {
    if (value) {
      paramString = `--${kebabKey}`
    }
  } else if (Array.isArray(value)) {
    if (value.length > 0) {
      paramString = `--${kebabKey} ${value.join(',')}`
    }
  } else {
    // Quote the value if it contains spaces or special characters
    const stringValue = String(value)
    const quotedValue = stringValue.includes(' ') || stringValue.includes('!') || stringValue.includes('$') 
      ? `"${stringValue}"` 
      : stringValue
    paramString = `--${kebabKey} ${quotedValue}`
  }

  // Add comments if requested and parameter exists in definitions
  if (includeComments && VLLM_PARAMETERS[kebabKey]) {
    paramString += ` # ${VLLM_PARAMETERS[kebabKey].description}`
  }

  return paramString
}

/**
 * Generate configuration from template
 * @param {string} templateName - Name of the template to use
 * @param {object} overrides - Configuration overrides
 * @returns {object} Generated configuration
 */
export function generateConfiguration(templateName, overrides = {}) {
  if (!COMMAND_TEMPLATES[templateName]) {
    throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(COMMAND_TEMPLATES).join(', ')}`)
  }

  const template = { ...COMMAND_TEMPLATES[templateName] }
  return { ...template, ...overrides }
}

/**
 * Generate complete deployment configuration
 * @param {object} params - Generation parameters
 * @returns {object} Complete configuration object
 */
export function generateDeploymentConfig(params) {
  const {
    model,
    deploymentType = 'production',
    gpuMemoryGB,
    maxSequenceLength = 2048,
    expectedTPS = 10,
    customConfig = {}
  } = params

  const baseConfig = deploymentType in COMMAND_TEMPLATES 
    ? { ...COMMAND_TEMPLATES[deploymentType] }
    : { ...COMMAND_TEMPLATES.production }

  // Add model
  baseConfig.model = model

  // Calculate memory utilization based on available GPU memory
  if (gpuMemoryGB) {
    const utilizationFactor = deploymentType === 'production' ? 0.90 : 0.85
    baseConfig['gpu-memory-utilization'] = Math.min(0.95, utilizationFactor)
  }

  // Set sequence length
  baseConfig['max-model-len'] = maxSequenceLength

  // Estimate batch size based on expected throughput
  if (expectedTPS) {
    const estimatedBatchSize = Math.min(256, Math.max(16, expectedTPS * 2))
    baseConfig['max-num-seqs'] = estimatedBatchSize
  }

  // Apply custom configurations
  return { ...baseConfig, ...customConfig }
}

/**
 * Validate command configuration
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result with isValid and errors
 */
export function validateConfiguration(config) {
  const errors = []
  const warnings = []

  // Check required parameters
  if (!config.model) {
    errors.push('Model parameter is required')
  }

  // Validate parameter types and values
  for (const [key, value] of Object.entries(config)) {
    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    
    if (VLLM_PARAMETERS[kebabKey]) {
      const result = validateParameter(kebabKey, value, VLLM_PARAMETERS[kebabKey])
      if (!result.isValid) {
        errors.push(`${key}: ${result.error}`)
      }
      if (result.warning) {
        warnings.push(`${key}: ${result.warning}`)
      }
    }
  }

  // Check parameter compatibility
  if (config['tensor-parallel-size'] && config['pipeline-parallel-size']) {
    const totalParallelism = config['tensor-parallel-size'] * config['pipeline-parallel-size']
    if (totalParallelism > 8) {
      warnings.push('High parallelism may impact performance on smaller models')
    }
  }

  if (config['gpu-memory-utilization'] && config['gpu-memory-utilization'] > 0.95) {
    warnings.push('GPU memory utilization above 95% may cause OOM errors')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate a single parameter
 * @param {string} paramName - Parameter name
 * @param {*} value - Parameter value
 * @param {object} paramDef - Parameter definition
 * @returns {object} Validation result
 */
function validateParameter(paramName, value, paramDef) {
  const result = { isValid: true, error: null, warning: null }

  // Check required parameters
  if (paramDef.required && (value === undefined || value === null)) {
    result.isValid = false
    result.error = 'Required parameter is missing'
    return result
  }

  if (value === undefined || value === null) {
    return result
  }

  // Type validation
  switch (paramDef.type) {
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        result.isValid = false
        result.error = 'Must be a valid number'
      }
      break
    
    case 'boolean':
      if (typeof value !== 'boolean') {
        result.isValid = false
        result.error = 'Must be a boolean value'
      }
      break
    
    case 'string':
      if (typeof value !== 'string') {
        result.isValid = false
        result.error = 'Must be a string'
      } else if (paramDef.options && !paramDef.options.includes(value)) {
        result.isValid = false
        result.error = `Must be one of: ${paramDef.options.join(', ')}`
      }
      break
    
    case 'array':
      if (!Array.isArray(value)) {
        result.isValid = false
        result.error = 'Must be an array'
      }
      break
  }

  // Range validation for numbers
  if (paramDef.type === 'number' && result.isValid) {
    if (paramDef.min !== undefined && value < paramDef.min) {
      result.isValid = false
      result.error = `Must be at least ${paramDef.min}`
    }
    if (paramDef.max !== undefined && value > paramDef.max) {
      result.isValid = false
      result.error = `Must be at most ${paramDef.max}`
    }
  }

  return result
}

/**
 * Generate Docker command for vLLM deployment
 * @param {object} config - Configuration object
 * @param {object} dockerOptions - Docker-specific options
 * @returns {string} Docker command string
 */
export function generateDockerCommand(config, dockerOptions = {}) {
  const {
    image = 'vllm/vllm-openai:latest',
    gpuCount = 1,
    ports = [],
    volumes = [],
    volumeMounts = [],
    environmentVars = {},
    environment = {},
    additionalArgs = [],
    memory,
    sharedMemory
  } = dockerOptions

  const dockerArgs = [
    'docker run',
    '--gpus all',
    `-e CUDA_VISIBLE_DEVICES=0-${gpuCount - 1}`
  ]

  // Handle port mapping - check config first, then options
  if (config.port) {
    dockerArgs.push(`-p ${config.port}:${config.port}`)
  } else if (ports.length > 0) {
    dockerArgs.push(...ports.map(port => `-p ${port}`))
  } else {
    dockerArgs.push('-p 8000:8000')
  }

  // Handle volume mounts
  dockerArgs.push(...volumes.map(volume => `-v ${volume}`))
  dockerArgs.push(...volumeMounts.map(volume => `-v ${volume}`))

  // Handle environment variables from both sources
  const allEnvVars = { ...environmentVars, ...environment }
  dockerArgs.push(...Object.entries(allEnvVars).map(([key, value]) => `-e ${key}=${value}`))

  // Handle resource constraints
  if (memory) {
    dockerArgs.push(`--memory ${memory}`)
  }
  if (sharedMemory) {
    dockerArgs.push(`--shm-size ${sharedMemory}`)
  }

  dockerArgs.push(...additionalArgs)
  dockerArgs.push(image)

  // Generate vLLM command
  const vllmResult = generateVLLMCommand(config, { format: 'python' })
  
  // Split the python command to get arguments
  const vllmArgs = vllmResult.command.split(' ').slice(3) // Remove 'python -m module'
  
  dockerArgs.push('python', '-m', 'vllm.entrypoints.openai.api_server')
  dockerArgs.push(...vllmArgs)

  const commandString = dockerArgs.join(' ')

  // Return object with command as expected by tests
  return {
    command: commandString,
    context: vllmResult.context
  }
}

/**
 * Generate Kubernetes YAML configuration
 * @param {object} config - vLLM configuration
 * @param {object} k8sOptions - Kubernetes-specific options
 * @returns {string} Kubernetes YAML configuration
 */
export function generateKubernetesConfig(config, k8sOptions = {}) {
  const {
    name = 'vllm-deployment',
    namespace = 'default',
    replicas = 1,
    image = 'vllm/vllm-openai:latest',
    resources = {
      requests: { 'nvidia.com/gpu': 1, memory: '8Gi', cpu: '2' },
      limits: { 'nvidia.com/gpu': 1, memory: '16Gi', cpu: '4' }
    },
    service = { type: 'ClusterIP', port: 8000 }
  } = k8sOptions

  const vllmArgs = generateVLLMCommand(config, { format: 'python' })
    .split(' ')
    .slice(3) // Remove 'python -m module'

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
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: vllm
        image: ${image}
        command: ["python", "-m", "vllm.entrypoints.openai.api_server"]
        args: ${JSON.stringify(vllmArgs, null, 10).replace(/"/g, '"')}
        ports:
        - containerPort: 8000
        resources:
          requests:
            nvidia.com/gpu: ${resources.requests['nvidia.com/gpu']}
            memory: ${resources.requests.memory}
            cpu: ${resources.requests.cpu}
          limits:
            nvidia.com/gpu: ${resources.limits['nvidia.com/gpu']}
            memory: ${resources.limits.memory}
            cpu: ${resources.limits.cpu}
        env:
        - name: CUDA_VISIBLE_DEVICES
          value: "0"
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}-service
  namespace: ${namespace}
spec:
  selector:
    app: ${name}
  ports:
  - protocol: TCP
    port: ${service.port}
    targetPort: 8000
  type: ${service.type}
`

  return yaml.trim()
}

// ================================
// ADDITIONAL EXPORTED FUNCTIONS FOR TEST COMPATIBILITY
// ================================

/**
 * Format command line from base command and parameters
 * @param {string} baseCommand - Base command string
 * @param {object} params - Parameters to format
 * @returns {string} Complete command line
 */
export function formatCommandLine(baseCommand, params) {
  const args = [baseCommand]
  
  for (const [key, value] of Object.entries(params)) {
    const paramString = formatParameter(key, value)
    if (paramString) {
      args.push(paramString)
    }
  }
  
  return args.join(' ')
}

/**
 * Validate command parameters
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result
 */
export function validateCommandParameters(config) {
  const errors = []
  const warnings = []
  
  // Check required parameters
  if (!config.model) {
    errors.push('Missing required parameter: model')
  }
  
  // Validate parameter types and ranges
  for (const [key, value] of Object.entries(config)) {
    const mapping = PARAMETER_MAPPINGS[key]
    if (mapping) {
      try {
        validateParameterValue(key, value, mapping)
      } catch (error) {
        errors.push(error.message)
      }
    }
  }
  
  // Check tensor parallel constraints
  if (config['tensor-parallel-size'] && config['tensor-parallel-size'] > 8) {
    warnings.push('Large tensor parallel sizes may cause memory issues')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validatedParams: Object.keys(config).filter(key => PARAMETER_MAPPINGS[key])
  }
}

/**
 * Validate a single parameter value
 * @param {string} key - Parameter key
 * @param {*} value - Parameter value
 * @param {object} mapping - Parameter mapping definition
 */
function validateParameterValue(key, value, mapping) {
  if (mapping.required && (value === undefined || value === null)) {
    throw new Error(`Required parameter ${key} is missing`)
  }
  
  if (value === undefined || value === null) return
  
  if (mapping.type === 'number') {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`Parameter ${key} must be a number`)
    }
    if (mapping.min !== undefined && value < mapping.min) {
      throw new Error(`Parameter ${key} must be >= ${mapping.min}`)
    }
    if (mapping.max !== undefined && value > mapping.max) {
      throw new Error(`Parameter ${key} must be <= ${mapping.max}`)
    }
  } else if (mapping.type === 'string') {
    if (typeof value !== 'string') {
      throw new Error(`Parameter ${key} must be a string`)
    }
  } else if (mapping.type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new Error(`Parameter ${key} must be a boolean`)
    }
  }
}
