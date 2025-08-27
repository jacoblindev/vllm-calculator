import { describe, it, expect } from 'vitest'
import {
  ValidationError,
  ConfigurationError, 
  MemoryError,
  Validators,
  VLLMValidators,
} from './validation.js'
import {
  calculateQuantizationFactor,
  calculateModelWeightsMemory,
} from './quantization.js'
import {
  calculateVRAMBreakdown,
} from './memory/vramBreakdown.js'
import {
  calculateBalancedOptimizedConfig,
} from './calculationEngine.js'

describe('Validation Framework', () => {
  describe('Custom Error Classes', () => {
    it('should create ValidationError with field and value', () => {
      const error = new ValidationError('Test error', 'testField', 'testValue')
      expect(error.name).toBe('ValidationError')
      expect(error.message).toBe('Test error')
      expect(error.field).toBe('testField')
      expect(error.value).toBe('testValue')
    })

    it('should create ConfigurationError with config', () => {
      const config = { test: true }
      const error = new ConfigurationError('Config error', config)
      expect(error.name).toBe('ConfigurationError')
      expect(error.message).toBe('Config error')
      expect(error.config).toBe(config)
    })

    it('should create MemoryError with memory values', () => {
      const error = new MemoryError('Memory error', 10, 8)
      expect(error.name).toBe('MemoryError')
      expect(error.message).toBe('Memory error')
      expect(error.required).toBe(10)
      expect(error.available).toBe(8)
    })
  })

  describe('Basic Validators', () => {
    describe('number validation', () => {
      it('should validate valid numbers', () => {
        expect(Validators.number(5.5)).toBe(5.5)
        expect(Validators.number(0)).toBe(0)
        expect(Validators.number(-10)).toBe(-10)
      })

      it('should validate numbers within range', () => {
        expect(Validators.number(5, 1, 10)).toBe(5)
        expect(Validators.number(1, 1, 10)).toBe(1)
        expect(Validators.number(10, 1, 10)).toBe(10)
      })

      it('should throw error for non-numbers', () => {
        expect(() => Validators.number('5')).toThrow(ValidationError)
        expect(() => Validators.number(null)).toThrow(ValidationError)
        expect(() => Validators.number(undefined)).toThrow(ValidationError)
        expect(() => Validators.number(NaN)).toThrow(ValidationError)
      })

      it('should throw error for numbers out of range', () => {
        expect(() => Validators.number(0, 1, 10)).toThrow(ValidationError)
        expect(() => Validators.number(11, 1, 10)).toThrow(ValidationError)
      })

      it('should include field name in error message', () => {
        try {
          Validators.number('invalid', 0, 100, 'testField')
        } catch (error) {
          expect(error.message).toContain('testField')
          expect(error.field).toBe('testField')
        }
      })
    })

    describe('positiveNumber validation', () => {
      it('should validate positive numbers', () => {
        expect(Validators.positiveNumber(5.5)).toBe(5.5)
        expect(Validators.positiveNumber(0.000001)).toBe(0.000001)
      })

      it('should throw error for zero and negative numbers', () => {
        expect(() => Validators.positiveNumber(0)).toThrow(ValidationError)
        expect(() => Validators.positiveNumber(-1)).toThrow(ValidationError)
      })
    })

    describe('positiveInteger validation', () => {
      it('should validate positive integers', () => {
        expect(Validators.positiveInteger(5)).toBe(5)
        expect(Validators.positiveInteger(1)).toBe(1)
      })

      it('should throw error for non-integers', () => {
        expect(() => Validators.positiveInteger(5.5)).toThrow(ValidationError)
        expect(() => Validators.positiveInteger(0)).toThrow(ValidationError)
        expect(() => Validators.positiveInteger(-1)).toThrow(ValidationError)
      })
    })

    describe('enum validation', () => {
      it('should validate allowed values', () => {
        const allowed = ['a', 'b', 'c']
        expect(Validators.enum('a', allowed)).toBe('a')
        expect(Validators.enum('b', allowed)).toBe('b')
      })

      it('should throw error for disallowed values', () => {
        const allowed = ['a', 'b', 'c']
        expect(() => Validators.enum('d', allowed)).toThrow(ValidationError)
        expect(() => Validators.enum('A', allowed)).toThrow(ValidationError)
      })
    })

    describe('string validation', () => {
      it('should validate non-empty strings', () => {
        expect(Validators.string('hello')).toBe('hello')
        expect(Validators.string('  hello  ')).toBe('hello') // trimmed
      })

      it('should throw error for empty/invalid strings', () => {
        expect(() => Validators.string('')).toThrow(ValidationError)
        expect(() => Validators.string('   ')).toThrow(ValidationError)
        expect(() => Validators.string(null)).toThrow(ValidationError)
        expect(() => Validators.string(123)).toThrow(ValidationError)
      })
    })

    describe('object validation', () => {
      it('should validate objects', () => {
        const obj = { a: 1, b: 2 }
        expect(Validators.object(obj)).toBe(obj)
      })

      it('should validate objects with required fields', () => {
        const obj = { a: 1, b: 2, c: 3 }
        expect(Validators.object(obj, ['a', 'b'])).toBe(obj)
      })

      it('should throw error for non-objects', () => {
        expect(() => Validators.object(null)).toThrow(ValidationError)
        expect(() => Validators.object([])).toThrow(ValidationError)
        expect(() => Validators.object('string')).toThrow(ValidationError)
      })

      it('should throw error for missing required fields', () => {
        const obj = { a: 1 }
        expect(() => Validators.object(obj, ['a', 'b'])).toThrow(ValidationError)
      })
    })
  })

  describe('vLLM-Specific Validators', () => {
    describe('quantizationFormat validation', () => {
      it('should validate supported quantization formats', () => {
        expect(VLLMValidators.quantizationFormat('fp16')).toBe('fp16')
        expect(VLLMValidators.quantizationFormat('FP16')).toBe('fp16') // normalized
        expect(VLLMValidators.quantizationFormat('awq')).toBe('awq')
        expect(VLLMValidators.quantizationFormat('gptq')).toBe('gptq')
      })

      it('should throw error for unsupported formats', () => {
        expect(() => VLLMValidators.quantizationFormat('unsupported')).toThrow(ValidationError)
        expect(() => VLLMValidators.quantizationFormat('')).toThrow(ValidationError)
        expect(() => VLLMValidators.quantizationFormat(null)).toThrow(ValidationError)
      })
    })

    describe('modelSpecs validation', () => {
      it('should validate valid model specs with modelSizeGB', () => {
        const specs = { modelSizeGB: 13.5 }
        expect(VLLMValidators.modelSpecs(specs)).toBe(specs)
      })

      it('should validate valid model specs with numParams', () => {
        const specs = { numParams: 7 }
        expect(VLLMValidators.modelSpecs(specs)).toBe(specs)
      })

      it('should validate valid model specs with architecture info', () => {
        const specs = {
          modelSizeGB: 13.5,
          layers: 32,
          hiddenSize: 4096,
          numHeads: 32
        }
        expect(VLLMValidators.modelSpecs(specs)).toBe(specs)
      })

      it('should throw error when neither modelSizeGB nor numParams provided', () => {
        expect(() => VLLMValidators.modelSpecs({})).toThrow(ValidationError)
      })

      it('should throw error for invalid sizes', () => {
        expect(() => VLLMValidators.modelSpecs({ modelSizeGB: -1 })).toThrow(ValidationError)
        expect(() => VLLMValidators.modelSpecs({ numParams: 0 })).toThrow(ValidationError)
        expect(() => VLLMValidators.modelSpecs({ modelSizeGB: 2000 })).toThrow(ValidationError) // too big
      })

      it('should throw error for invalid architecture parameters', () => {
        expect(() => VLLMValidators.modelSpecs({ modelSizeGB: 13.5, layers: -1 })).toThrow(ValidationError)
        expect(() => VLLMValidators.modelSpecs({ modelSizeGB: 13.5, hiddenSize: 0 })).toThrow(ValidationError)
        expect(() => VLLMValidators.modelSpecs({ modelSizeGB: 13.5, numHeads: -1 })).toThrow(ValidationError)
      })
    })

    describe('gpuSpecs validation', () => {
      it('should validate valid GPU specs', () => {
        const specs = { totalVRAMGB: 80, memoryBandwidthGBps: 1935 }
        expect(VLLMValidators.gpuSpecs(specs)).toBe(specs)
      })

      it('should throw error for invalid VRAM', () => {
        expect(() => VLLMValidators.gpuSpecs({ totalVRAMGB: -1 })).toThrow(ValidationError)
        expect(() => VLLMValidators.gpuSpecs({ totalVRAMGB: 2000 })).toThrow(ValidationError) // too big
      })

      it('should throw error for invalid memory bandwidth', () => {
        expect(() => VLLMValidators.gpuSpecs({ memoryBandwidthGBps: -1 })).toThrow(ValidationError)
        expect(() => VLLMValidators.gpuSpecs({ memoryBandwidthGBps: 20000 })).toThrow(ValidationError) // too big
      })
    })

    describe('sequenceLength validation', () => {
      it('should validate valid sequence lengths', () => {
        expect(VLLMValidators.sequenceLength(512)).toBe(512)
        expect(VLLMValidators.sequenceLength(2048)).toBe(2048)
      })

      it('should throw error for invalid sequence lengths', () => {
        expect(() => VLLMValidators.sequenceLength(0)).toThrow(ValidationError)
        expect(() => VLLMValidators.sequenceLength(-1)).toThrow(ValidationError)
        expect(() => VLLMValidators.sequenceLength(5.5)).toThrow(ValidationError)
        expect(() => VLLMValidators.sequenceLength(2000000)).toThrow(ValidationError) // too big
      })
    })

    describe('batchSize validation', () => {
      it('should validate valid batch sizes', () => {
        expect(VLLMValidators.batchSize(32)).toBe(32)
        expect(VLLMValidators.batchSize(1)).toBe(1)
      })

      it('should throw error for invalid batch sizes', () => {
        expect(() => VLLMValidators.batchSize(0)).toThrow(ValidationError)
        expect(() => VLLMValidators.batchSize(-1)).toThrow(ValidationError)
        expect(() => VLLMValidators.batchSize(5.5)).toThrow(ValidationError)
        expect(() => VLLMValidators.batchSize(20000)).toThrow(ValidationError) // too big
      })
    })

    describe('memoryRequirements validation', () => {
      it('should validate when memory is sufficient', () => {
        expect(VLLMValidators.memoryRequirements(10, 20)).toBe(true)
        expect(VLLMValidators.memoryRequirements(10, 10)).toBe(true) // exact match
      })

      it('should throw MemoryError when memory is insufficient', () => {
        expect(() => VLLMValidators.memoryRequirements(20, 10)).toThrow(MemoryError)
      })

      it('should throw ValidationError for invalid inputs', () => {
        expect(() => VLLMValidators.memoryRequirements(-1, 10)).toThrow(ValidationError)
        expect(() => VLLMValidators.memoryRequirements(10, -1)).toThrow(ValidationError)
      })
    })
  })

  describe('Function Integration Tests', () => {
    describe('calculateQuantizationFactor with validation', () => {
      it('should work with valid inputs', () => {
        const result = calculateQuantizationFactor('fp16')
        expect(result.format).toBe('fp16')
        expect(result.memoryFactor).toBeGreaterThan(0)
      })

      it('should normalize format case', () => {
        const result = calculateQuantizationFactor('FP16')
        expect(result.format).toBe('fp16')
      })

      it('should throw ValidationError for invalid format', () => {
        expect(() => calculateQuantizationFactor('invalid')).toThrow(ValidationError)
        expect(() => calculateQuantizationFactor('')).toThrow(ValidationError)
        expect(() => calculateQuantizationFactor(null)).toThrow(ValidationError)
      })

      it('should validate options parameter', () => {
        expect(() => calculateQuantizationFactor('fp16', 'invalid')).toThrow(ValidationError)
      })
    })

    describe('calculateModelWeightsMemory with validation', () => {
      it('should work with valid inputs', () => {
        const result = calculateModelWeightsMemory(7, 'fp16')
        expect(result.totalMemory).toBeGreaterThan(0)
        expect(result.quantization).toBe('fp16')
      })

      it('should throw ValidationError for invalid numParams', () => {
        expect(() => calculateModelWeightsMemory(0, 'fp16')).toThrow(ValidationError)
        expect(() => calculateModelWeightsMemory(-1, 'fp16')).toThrow(ValidationError)
        expect(() => calculateModelWeightsMemory('7', 'fp16')).toThrow(ValidationError)
      })

      it('should throw ValidationError for invalid quantization', () => {
        expect(() => calculateModelWeightsMemory(7, 'invalid')).toThrow(ValidationError)
      })
    })

    describe('calculateVRAMBreakdown with validation', () => {
      it('should work with valid modelSizeGB config', () => {
        const config = {
          totalVRAMGB: 80,
          modelSizeGB: 13.5,
          quantization: 'fp16',
          batchSize: 32,
          maxSeqLen: 2048,
          seqLen: 512
        }
        const result = calculateVRAMBreakdown(config)
        expect(result.summary.usedMemory).toBeGreaterThan(0)
      })

      it('should work with valid numParams config', () => {
        const config = {
          totalVRAMGB: 80,
          numParams: 7,
          quantization: 'fp16',
          batchSize: 32,
          maxSeqLen: 2048,
          seqLen: 512
        }
        const result = calculateVRAMBreakdown(config)
        expect(result.summary.usedMemory).toBeGreaterThan(0)
      })

      it('should throw ValidationError for missing config', () => {
        expect(() => calculateVRAMBreakdown()).toThrow(ValidationError)
        expect(() => calculateVRAMBreakdown(null)).toThrow(ValidationError)
        expect(() => calculateVRAMBreakdown('invalid')).toThrow(ValidationError)
      })

      it('should throw ValidationError for missing required fields', () => {
        expect(() => calculateVRAMBreakdown({})).toThrow(ValidationError)
        expect(() => calculateVRAMBreakdown({ totalVRAMGB: 80 })).toThrow(ValidationError)
        expect(() => calculateVRAMBreakdown({ modelSizeGB: 13.5 })).toThrow(ValidationError)
      })

      it('should throw ValidationError for invalid field values', () => {
        const baseConfig = {
          totalVRAMGB: 80,
          modelSizeGB: 13.5,
          quantization: 'fp16',
          batchSize: 32,
          maxSeqLen: 2048,
          seqLen: 512
        }

        expect(() => calculateVRAMBreakdown({ ...baseConfig, totalVRAMGB: -1 })).toThrow(ValidationError)
        expect(() => calculateVRAMBreakdown({ ...baseConfig, modelSizeGB: 0 })).toThrow(ValidationError)
        expect(() => calculateVRAMBreakdown({ ...baseConfig, quantization: 'invalid' })).toThrow(ValidationError)
        expect(() => calculateVRAMBreakdown({ ...baseConfig, batchSize: -1 })).toThrow(ValidationError)
        expect(() => calculateVRAMBreakdown({ ...baseConfig, maxSeqLen: 0 })).toThrow(ValidationError)
      })
    })

    describe('calculateBalancedOptimizedConfig with validation', () => {
      it('should work with structured params', () => {
        const params = {
          gpuSpecs: { totalVRAMGB: 80, memoryBandwidthGBps: 1935 },
          modelSpecs: { modelSizeGB: 13.5 },
          workloadSpecs: { balanceTarget: 'general' }
        }
        const result = calculateBalancedOptimizedConfig(params)
        expect(result.batchConfiguration).toBeDefined()
        expect(result.memoryConfiguration).toBeDefined()
      })

      it('should work with flat params', () => {
        const params = {
          modelSizeGB: 13.5,
          totalVRAMGB: 80,
          balanceTarget: 'general'
        }
        const result = calculateBalancedOptimizedConfig(params)
        expect(result.batchConfiguration).toBeDefined()
        expect(result.memoryConfiguration).toBeDefined()
      })

      it('should throw ValidationError for invalid params', () => {
        expect(() => calculateBalancedOptimizedConfig()).toThrow(ValidationError)
        expect(() => calculateBalancedOptimizedConfig(null)).toThrow(ValidationError)
        expect(() => calculateBalancedOptimizedConfig('invalid')).toThrow(ValidationError)
      })

      it('should throw ValidationError for flat params without model info', () => {
        const params = { totalVRAMGB: 80 }
        expect(() => calculateBalancedOptimizedConfig(params)).toThrow(ValidationError)
      })

      it('should throw ValidationError for invalid structured params', () => {
        const invalidGpuSpecs = {
          gpuSpecs: { totalVRAMGB: -1 },
          modelSpecs: { modelSizeGB: 13.5 }
        }
        expect(() => calculateBalancedOptimizedConfig(invalidGpuSpecs)).toThrow(ValidationError)

        const invalidModelSpecs = {
          gpuSpecs: { totalVRAMGB: 80 },
          modelSpecs: {} // missing required fields
        }
        expect(() => calculateBalancedOptimizedConfig(invalidModelSpecs)).toThrow(ValidationError)
      })
    })
  })

  describe('Error Message Quality', () => {
    it('should provide helpful error messages with field names', () => {
      try {
        Validators.positiveNumber(-1, 'myField')
      } catch (error) {
        expect(error.message).toContain('myField')
        expect(error.message).toContain('at least')
        expect(error.field).toBe('myField')
        expect(error.value).toBe(-1)
      }
    })

    it('should list supported quantization formats in error', () => {
      try {
        VLLMValidators.quantizationFormat('invalid')
      } catch (error) {
        expect(error.message).toContain('Supported formats')
        expect(error.message).toContain('fp16')
        expect(error.message).toContain('awq')
      }
    })

    it('should provide memory requirement details in MemoryError', () => {
      try {
        VLLMValidators.memoryRequirements(20, 10)
      } catch (error) {
        expect(error).toBeInstanceOf(MemoryError)
        expect(error.message).toContain('20')
        expect(error.message).toContain('10')
        expect(error.required).toBe(20)
        expect(error.available).toBe(10)
      }
    })
  })
})
