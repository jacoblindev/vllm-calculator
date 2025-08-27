/**
 * Validation Framework for vLLM Calculator
 * 
 * This module provides comprehensive validation utilities for:
 * - Basic type validation (numbers, strings, objects, arrays)
 * - Domain-specific validation (GPU specs, model specs, quantization formats)
 * - Error handling and reporting
 * 
 * @module validation
 */

// Import quantization utilities for format validation
import { getSupportedQuantizationFormats } from './quantization.js'

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Custom error classes for validation failures
 */
export class ValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
    this.value = value
  }
}

export class ConfigurationError extends Error {
  constructor(message, config = null) {
    super(message)
    this.name = 'ConfigurationError'
    this.config = config
  }
}

export class MemoryError extends Error {
  constructor(message, required = null, available = null) {
    super(message)
    this.name = 'MemoryError'
    this.required = required
    this.available = available
  }
}

// ============================================================================
// BASIC TYPE VALIDATORS
// ============================================================================

/**
 * Basic type validation utilities
 */
export const Validators = {
  /**
   * Validate that value is a number within optional range
   */
  number(value, min = -Infinity, max = Infinity, fieldName = 'value') {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a valid number`, fieldName, value)
    }
    if (value < min) {
      throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName, value)
    }
    if (value > max) {
      throw new ValidationError(`${fieldName} must be at most ${max}`, fieldName, value)
    }
    return value
  },

  /**
   * Validate that value is a positive number
   */
  positiveNumber(value, fieldName = 'value') {
    return this.number(value, 0.000001, Infinity, fieldName)
  },

  /**
   * Validate that value is a positive integer
   */
  positiveInteger(value, fieldName = 'value') {
    if (!Number.isInteger(value) || value <= 0) {
      throw new ValidationError(`${fieldName} must be a positive integer`, fieldName, value)
    }
    return value
  },

  /**
   * Validate that value is one of the allowed values
   */
  enum(value, allowedValues, fieldName = 'value') {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(
        `${fieldName} must be one of: ${allowedValues.join(', ')}`, 
        fieldName, 
        value
      )
    }
    return value
  },

  /**
   * Validate that value is a non-empty string
   */
  string(value, fieldName = 'value') {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ValidationError(`${fieldName} must be a non-empty string`, fieldName, value)
    }
    return value.trim()
  },

  /**
   * Validate that value is an object with required fields
   */
  object(value, requiredFields = [], fieldName = 'value') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an object`, fieldName, value)
    }
    
    for (const field of requiredFields) {
      if (!(field in value)) {
        throw new ValidationError(
          `${fieldName} must have required field: ${field}`, 
          fieldName, 
          value
        )
      }
    }
    return value
  },

  /**
   * Validate that value is an array
   */
  array(value, fieldName = 'value') {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an array`, fieldName, value)
    }
    return value
  }
}

// ============================================================================
// DOMAIN-SPECIFIC VALIDATORS
// ============================================================================

/**
 * Domain-specific validation functions for vLLM
 */
export const VLLMValidators = {
  /**
   * Validate quantization format
   */
  quantizationFormat(format) {
    if (!format) {
      throw new ValidationError('Quantization format is required', 'quantization', format)
    }
    
    const normalizedFormat = format.toLowerCase()
    const supportedFormats = getSupportedQuantizationFormats()
    if (!supportedFormats.includes(normalizedFormat)) {
      throw new ValidationError(
        `Unsupported quantization format: ${format}. Supported formats: ${supportedFormats.join(', ')}`,
        'quantization',
        format
      )
    }
    return normalizedFormat
  },

  /**
   * Validate model specifications
   */
  modelSpecs(modelSpecs) {
    Validators.object(modelSpecs, [], 'modelSpecs')
    
    // Validate either modelSizeGB or numParams is provided
    if (!modelSpecs.modelSizeGB && !modelSpecs.numParams) {
      throw new ValidationError(
        'Either modelSizeGB or numParams must be provided',
        'modelSpecs',
        modelSpecs
      )
    }

    if (modelSpecs.modelSizeGB) {
      Validators.positiveNumber(modelSpecs.modelSizeGB, 'modelSpecs.modelSizeGB')
      // Realistic model size validation (1MB to 1TB)
      if (modelSpecs.modelSizeGB > 1000) {
        throw new ValidationError(
          'Model size exceeds realistic maximum (1TB)',
          'modelSpecs.modelSizeGB',
          modelSpecs.modelSizeGB
        )
      }
    }

    if (modelSpecs.numParams) {
      Validators.positiveNumber(modelSpecs.numParams, 'modelSpecs.numParams')
      // Realistic parameter count validation (1M to 10T parameters - raw count)
      if (modelSpecs.numParams > 10000000000000) { // 10T parameters
        throw new ValidationError(
          'Parameter count exceeds realistic maximum (10T parameters)',
          'modelSpecs.numParams',
          modelSpecs.numParams
        )
      }
    }

    if (modelSpecs.layers !== undefined) {
      Validators.positiveInteger(modelSpecs.layers, 'modelSpecs.layers')
      if (modelSpecs.layers > 1000) {
        throw new ValidationError(
          'Layer count exceeds realistic maximum (1000)',
          'modelSpecs.layers',
          modelSpecs.layers
        )
      }
    }

    if (modelSpecs.hiddenSize !== undefined) {
      Validators.positiveInteger(modelSpecs.hiddenSize, 'modelSpecs.hiddenSize')
      if (modelSpecs.hiddenSize > 100000) {
        throw new ValidationError(
          'Hidden size exceeds realistic maximum (100,000)',
          'modelSpecs.hiddenSize',
          modelSpecs.hiddenSize
        )
      }
    }

    if (modelSpecs.numHeads !== undefined) {
      Validators.positiveInteger(modelSpecs.numHeads, 'modelSpecs.numHeads')
      if (modelSpecs.numHeads > 1000) {
        throw new ValidationError(
          'Number of attention heads exceeds realistic maximum (1000)',
          'modelSpecs.numHeads',
          modelSpecs.numHeads
        )
      }
    }

    return modelSpecs
  },

  /**
   * Validate GPU specifications
   */
  gpuSpecs(gpuSpecs) {
    Validators.object(gpuSpecs, [], 'gpuSpecs')

    if (gpuSpecs.totalVRAMGB) {
      Validators.positiveNumber(gpuSpecs.totalVRAMGB, 'gpuSpecs.totalVRAMGB')
      // Realistic VRAM validation (1GB to 1TB)
      if (gpuSpecs.totalVRAMGB > 1000) {
        throw new ValidationError(
          'Total VRAM exceeds realistic maximum (1TB)',
          'gpuSpecs.totalVRAMGB',
          gpuSpecs.totalVRAMGB
        )
      }
    }

    if (gpuSpecs.memoryBandwidthGBps) {
      Validators.positiveNumber(gpuSpecs.memoryBandwidthGBps, 'gpuSpecs.memoryBandwidthGBps')
      // Realistic memory bandwidth validation (10 GB/s to 10TB/s)
      if (gpuSpecs.memoryBandwidthGBps > 10000) {
        throw new ValidationError(
          'Memory bandwidth exceeds realistic maximum (10TB/s)',
          'gpuSpecs.memoryBandwidthGBps',
          gpuSpecs.memoryBandwidthGBps
        )
      }
    }

    return gpuSpecs
  },

  /**
   * Validate sequence length parameters
   */
  sequenceLength(seqLen, fieldName = 'sequenceLength') {
    Validators.positiveInteger(seqLen, fieldName)
    if (seqLen > 1000000) {
      throw new ValidationError(
        `${fieldName} exceeds realistic maximum (1M tokens)`,
        fieldName,
        seqLen
      )
    }
    return seqLen
  },

  /**
   * Validate batch size parameters
   */
  batchSize(batchSize, fieldName = 'batchSize') {
    Validators.positiveInteger(batchSize, fieldName)
    if (batchSize > 10000) {
      throw new ValidationError(
        `${fieldName} exceeds realistic maximum (10,000)`,
        fieldName,
        batchSize
      )
    }
    return batchSize
  },

  /**
   * Validate memory requirements vs availability
   */
  memoryRequirements(requiredMemoryGB, availableMemoryGB) {
    Validators.positiveNumber(requiredMemoryGB, 'requiredMemoryGB')
    Validators.positiveNumber(availableMemoryGB, 'availableMemoryGB')
    
    if (requiredMemoryGB > availableMemoryGB) {
      throw new MemoryError(
        `Insufficient memory: requires ${requiredMemoryGB.toFixed(2)}GB but only ${availableMemoryGB.toFixed(2)}GB available`,
        requiredMemoryGB,
        availableMemoryGB
      )
    }
    
    return true
  }
}
