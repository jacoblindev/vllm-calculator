/**
 * Workload modules index
 * Exports all workload-related functions for easier importing
 */

export {
  generateVLLMCommand,
  generateDockerCommand,
  generateWorkloadCommand,
  validateCommandArguments,
  COMMAND_TEMPLATES,
  VLLM_PARAMETERS
} from './commandGenerator.js'

export {
  estimateModelArchitecture,
  calculateModelParameters,
  estimateLayerWiseMemory,
  getModelFamilySpecs,
  calculateVLLMMemoryUsage,
  MODEL_ARCHITECTURE_PRESETS,
  SUPPORTED_ARCHITECTURES
} from './modelArchitecture.js'

export {
  optimizeForWorkload,
  generateWorkloadConfiguration,
  analyzeWorkloadRequirements,
  calculateResourceRequirements,
  WORKLOAD_PROFILES
} from './workloadOptimizer.js'
