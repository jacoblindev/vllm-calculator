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

// ================================
// COMMAND GENERATION TEMPLATES
// ================================

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
 * Generate a vLLM command string from configuration
 * @param {object} config - Configuration object
 * @param {object} options - Command generation options
 * @returns {string} Generated command string
 */
export function generateVLLMCommand(config, options = {}) {
  const {
    includeComments = false,
    includeOptional = true,
    format = 'shell', // 'shell' or 'python'
    pythonModule = 'vllm.entrypoints.openai.api_server'
  } = options

  if (!config.model) {
    throw new Error('Model parameter is required')
  }

  const args = []
  
  // Add model as positional argument for shell format
  if (format === 'shell') {
    args.push('vllm serve')
    args.push(config.model)
  } else {
    args.push(`python -m ${pythonModule}`)
    args.push(`--model ${config.model}`)
  }

  // Process all configuration parameters
  for (const [key, value] of Object.entries(config)) {
    if (key === 'model') continue // Already handled
    
    const paramString = formatParameter(key, value, includeComments)
    if (paramString) {
      args.push(paramString)
    }
  }

  return args.join(' ')
}

/**
 * Format a single parameter for command line
 * @param {string} key - Parameter name
 * @param {*} value - Parameter value
 * @param {boolean} includeComments - Whether to include comments
 * @returns {string} Formatted parameter string
 */
function formatParameter(key, value, includeComments = false) {
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
    paramString = `--${kebabKey} ${value}`
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
    ports = ['8000:8000'],
    volumes = [],
    environmentVars = {},
    additionalArgs = []
  } = dockerOptions

  const dockerArgs = [
    'docker run',
    '--gpus all',
    `-e CUDA_VISIBLE_DEVICES=0-${gpuCount - 1}`,
    ...ports.map(port => `-p ${port}`),
    ...volumes.map(volume => `-v ${volume}`),
    ...Object.entries(environmentVars).map(([key, value]) => `-e ${key}="${value}"`),
    ...additionalArgs,
    image
  ]

  // Generate vLLM command
  const vllmCommand = generateVLLMCommand(config, { format: 'python' })
  
  // Split the python command to get arguments
  const vllmArgs = vllmCommand.split(' ').slice(3) // Remove 'python -m module'
  
  dockerArgs.push('python', '-m', 'vllm.entrypoints.openai.api_server')
  dockerArgs.push(...vllmArgs)

  return dockerArgs.join(' ')
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
