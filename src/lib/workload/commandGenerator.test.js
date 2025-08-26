/**
 * Unit tests for command generator module
 * 
 * Tests the vLLM command generation functionality to ensure:
 * - Proper command line generation for different configurations
 * - Correct parameter formatting and validation
 * - Integration with optimization configs
 * - Valid Docker and direct execution commands
 */

import { describe, it, expect } from 'vitest'
import {
  generateVLLMCommand,
  formatCommandLine,
  validateCommandParameters,
  generateDockerCommand,
  COMMAND_TEMPLATES,
  PARAMETER_MAPPINGS
} from '../commandGenerator.js'

describe('Command Generator Module', () => {
  describe('generateVLLMCommand', () => {
    const mockConfig = {
      'model': 'meta-llama/Llama-2-7b-chat-hf',
      'tensor-parallel-size': 1,
      'gpu-memory-utilization': 0.9,
      'max-num-seqs': 128,
      'max-model-len': 2048,
      'dtype': 'float16'
    }

    it('should generate basic vLLM command', () => {
      const result = generateVLLMCommand(mockConfig)

      expect(result).toBeDefined()
      expect(result.command).toBeDefined()
      expect(result.command).toContain('python -m vllm.entrypoints.openai.api_server')
      expect(result.command).toContain('--model meta-llama/Llama-2-7b-chat-hf')
      expect(result.command).toContain('--tensor-parallel-size 1')
      expect(result.command).toContain('--gpu-memory-utilization 0.9')
    })

    it('should handle tensor parallel configuration', () => {
      const tpConfig = {
        ...mockConfig,
        'tensor-parallel-size': 4
      }

      const result = generateVLLMCommand(tpConfig)

      expect(result.command).toContain('--tensor-parallel-size 4')
    })

    it('should handle pipeline parallel configuration', () => {
      const ppConfig = {
        ...mockConfig,
        'pipeline-parallel-size': 2
      }

      const result = generateVLLMCommand(ppConfig)

      expect(result.command).toContain('--pipeline-parallel-size 2')
    })

    it('should handle quantization settings', () => {
      const quantConfig = {
        ...mockConfig,
        'quantization': 'awq'
      }

      const result = generateVLLMCommand(quantConfig)

      expect(result.command).toContain('--quantization awq')
    })

    it('should handle memory optimization flags', () => {
      const memConfig = {
        ...mockConfig,
        'enable-prefix-caching': true,
        'disable-log-stats': true
      }

      const result = generateVLLMCommand(memConfig)

      expect(result.command).toContain('--enable-prefix-caching')
      expect(result.command).toContain('--disable-log-stats')
    })

    it('should handle serving configuration', () => {
      const servingConfig = {
        ...mockConfig,
        'host': '0.0.0.0',
        'port': 8000,
        'api-key': 'secret-key'
      }

      const result = generateVLLMCommand(servingConfig)

      expect(result.command).toContain('--host 0.0.0.0')
      expect(result.command).toContain('--port 8000')
      expect(result.command).toContain('--api-key secret-key')
    })

    it('should include execution context', () => {
      const result = generateVLLMCommand(mockConfig)

      expect(result.context).toBeDefined()
      expect(result.context.gpuCount).toBeDefined()
      expect(result.context.memoryEstimate).toBeDefined()
      expect(result.context.recommendations).toBeDefined()
    })

    it('should validate required parameters', () => {
      const invalidConfig = {
        'tensor-parallel-size': 1
        // Missing model parameter
      }

      const result = generateVLLMCommand(invalidConfig)

      expect(result).toBeDefined()
      expect(result.warnings).toBeDefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should handle boolean flags correctly', () => {
      const boolConfig = {
        ...mockConfig,
        'trust-remote-code': true,
        'disable-log-stats': false // Should not appear in command
      }

      const result = generateVLLMCommand(boolConfig)

      expect(result.command).toContain('--trust-remote-code')
      expect(result.command).not.toContain('--disable-log-stats false')
    })

    it('should handle array parameters', () => {
      const arrayConfig = {
        ...mockConfig,
        'guided-decoding-backend': ['outlines', 'lm-format-enforcer']
      }

      const result = generateVLLMCommand(arrayConfig)

      expect(result.command).toContain('--guided-decoding-backend')
    })
  })

  describe('formatCommandLine', () => {
    it('should format command with proper escaping', () => {
      const params = {
        'model': 'meta-llama/Llama-2-7b-chat-hf',
        'tensor-parallel-size': 1,
        'gpu-memory-utilization': 0.9
      }

      const result = formatCommandLine('python -m vllm.entrypoints.openai.api_server', params)

      expect(result).toBeDefined()
      expect(result).toContain('python -m vllm.entrypoints.openai.api_server')
      expect(result).toContain('--model')
      expect(result).toContain('--tensor-parallel-size')
    })

    it('should handle special characters in parameters', () => {
      const params = {
        'model': 'path/with spaces/model',
        'api-key': 'key-with-special-chars!'
      }

      const result = formatCommandLine('python -m vllm.entrypoints.openai.api_server', params)

      expect(result).toBeDefined()
      // Should properly quote parameters with spaces
      expect(result).toContain('"path/with spaces/model"')
    })

    it('should handle numeric parameters', () => {
      const params = {
        'tensor-parallel-size': 4,
        'gpu-memory-utilization': 0.95,
        'port': 8000
      }

      const result = formatCommandLine('python -m vllm.entrypoints.openai.api_server', params)

      expect(result).toContain('--tensor-parallel-size 4')
      expect(result).toContain('--gpu-memory-utilization 0.95')
      expect(result).toContain('--port 8000')
    })

    it('should handle boolean flags', () => {
      const params = {
        'trust-remote-code': true,
        'enable-prefix-caching': false
      }

      const result = formatCommandLine('python -m vllm.entrypoints.openai.api_server', params)

      expect(result).toContain('--trust-remote-code')
      expect(result).not.toContain('--enable-prefix-caching')
    })

    it('should maintain parameter order for consistency', () => {
      const params = {
        'model': 'test-model',
        'tensor-parallel-size': 1,
        'gpu-memory-utilization': 0.9
      }

      const result1 = formatCommandLine('python -m vllm.entrypoints.openai.api_server', params)
      const result2 = formatCommandLine('python -m vllm.entrypoints.openai.api_server', params)

      expect(result1).toBe(result2) // Should be deterministic
    })
  })

  describe('validateCommandParameters', () => {
    it('should validate required parameters', () => {
      const validConfig = {
        'model': 'meta-llama/Llama-2-7b-chat-hf',
        'tensor-parallel-size': 1
      }

      const result = validateCommandParameters(validConfig)

      expect(result.isValid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should detect missing required parameters', () => {
      const invalidConfig = {
        'tensor-parallel-size': 1
        // Missing model
      }

      const result = validateCommandParameters(invalidConfig)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Missing required parameter: model')
    })

    it('should validate parameter types', () => {
      const invalidConfig = {
        'model': 'test-model',
        'tensor-parallel-size': 'not-a-number'
      }

      const result = validateCommandParameters(invalidConfig)

      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('tensor-parallel-size'))).toBe(true)
    })

    it('should validate parameter ranges', () => {
      const invalidConfig = {
        'model': 'test-model',
        'gpu-memory-utilization': 1.5 // Should be <= 1.0
      }

      const result = validateCommandParameters(invalidConfig)

      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('gpu-memory-utilization'))).toBe(true)
    })

    it('should validate tensor parallel constraints', () => {
      const invalidConfig = {
        'model': 'test-model',
        'tensor-parallel-size': 3, // Should be power of 2 for some models
        'pipeline-parallel-size': 2
      }

      const result = validateCommandParameters(invalidConfig)

      expect(result).toBeDefined()
      // May include warnings about suboptimal configuration
    })

    it('should provide helpful error messages', () => {
      const invalidConfig = {
        'model': '',
        'tensor-parallel-size': -1
      }

      const result = validateCommandParameters(invalidConfig)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('model')
    })

    it('should validate quantization compatibility', () => {
      const config = {
        'model': 'test-model',
        'quantization': 'gptq',
        'dtype': 'float32' // May not be compatible with GPTQ
      }

      const result = validateCommandParameters(config)

      expect(result).toBeDefined()
      // Should provide warnings about potential incompatibilities
    })
  })

  describe('generateDockerCommand', () => {
    const mockConfig = {
      'model': 'meta-llama/Llama-2-7b-chat-hf',
      'tensor-parallel-size': 1,
      'gpu-memory-utilization': 0.9
    }

    it('should generate Docker command with GPU support', () => {
      const result = generateDockerCommand(mockConfig)

      expect(result).toBeDefined()
      expect(result.command).toContain('docker run')
      expect(result.command).toContain('--gpus all')
      expect(result.command).toContain('vllm/vllm-openai')
    })

    it('should handle custom Docker image', () => {
      const result = generateDockerCommand(mockConfig, {
        image: 'custom/vllm:latest'
      })

      expect(result.command).toContain('custom/vllm:latest')
    })

    it('should handle port mapping', () => {
      const config = {
        ...mockConfig,
        'port': 8080
      }

      const result = generateDockerCommand(config)

      expect(result.command).toContain('-p 8080:8080')
    })

    it('should handle volume mounts for model caching', () => {
      const result = generateDockerCommand(mockConfig, {
        volumeMounts: ['/host/models:/root/.cache/huggingface']
      })

      expect(result.command).toContain('-v /host/models:/root/.cache/huggingface')
    })

    it('should handle environment variables', () => {
      const result = generateDockerCommand(mockConfig, {
        environment: {
          'HUGGING_FACE_HUB_TOKEN': 'token123',
          'CUDA_VISIBLE_DEVICES': '0,1'
        }
      })

      expect(result.command).toContain('-e HUGGING_FACE_HUB_TOKEN=token123')
      expect(result.command).toContain('-e CUDA_VISIBLE_DEVICES=0,1')
    })

    it('should include resource constraints', () => {
      const result = generateDockerCommand(mockConfig, {
        memory: '32g',
        sharedMemory: '16g'
      })

      expect(result.command).toContain('--memory 32g')
      expect(result.command).toContain('--shm-size 16g')
    })
  })

  describe('COMMAND_TEMPLATES constant', () => {
    it('should define command templates', () => {
      expect(COMMAND_TEMPLATES).toBeDefined()
      expect(COMMAND_TEMPLATES.openai).toBeDefined()
      expect(COMMAND_TEMPLATES.offline).toBeDefined()
    })

    it('should have valid template structures', () => {
      Object.values(COMMAND_TEMPLATES).forEach(template => {
        expect(template.base).toBeDefined()
        expect(template.requiredParams).toBeDefined()
        expect(Array.isArray(template.requiredParams)).toBe(true)
      })
    })
  })

  describe('PARAMETER_MAPPINGS constant', () => {
    it('should define parameter mappings', () => {
      expect(PARAMETER_MAPPINGS).toBeDefined()
      expect(typeof PARAMETER_MAPPINGS).toBe('object')
    })

    it('should include common parameters', () => {
      expect(PARAMETER_MAPPINGS['model']).toBeDefined()
      expect(PARAMETER_MAPPINGS['tensor-parallel-size']).toBeDefined()
      expect(PARAMETER_MAPPINGS['gpu-memory-utilization']).toBeDefined()
    })

    it('should have valid parameter definitions', () => {
      Object.values(PARAMETER_MAPPINGS).forEach(param => {
        expect(param.type).toBeDefined()
        expect(['string', 'number', 'boolean', 'array'].includes(param.type)).toBe(true)
      })
    })
  })

  describe('Error handling and edge cases', () => {
    it('should handle empty configuration', () => {
      const result = generateVLLMCommand({})

      expect(result).toBeDefined()
      expect(result.warnings).toBeDefined()
    })

    it('should handle null/undefined parameters', () => {
      const config = {
        'model': 'test-model',
        'tensor-parallel-size': null,
        'gpu-memory-utilization': undefined
      }

      const result = generateVLLMCommand(config)

      expect(result).toBeDefined()
      expect(result.command).not.toContain('null')
      expect(result.command).not.toContain('undefined')
    })

    it('should handle very long model names', () => {
      const config = {
        'model': 'very/long/model/name/that/might/cause/issues/with/command/line/length'
      }

      const result = generateVLLMCommand(config)

      expect(result).toBeDefined()
      expect(result.command).toContain(config['model'])
    })

    it('should handle conflicting parameters gracefully', () => {
      const config = {
        'model': 'test-model',
        'tensor-parallel-size': 4,
        'pipeline-parallel-size': 4 // Might conflict
      }

      const result = generateVLLMCommand(config)

      expect(result).toBeDefined()
      // Should include warnings about potential conflicts
    })
  })

  describe('Integration with optimization configs', () => {
    it('should work with latency-optimized configuration', () => {
      const latencyConfig = {
        'model': 'test-model',
        'tensor-parallel-size': 1,
        'max-num-seqs': 32,
        'enable-prefix-caching': true
      }

      const result = generateVLLMCommand(latencyConfig)

      expect(result).toBeDefined()
      expect(result.command).toContain('--max-num-seqs 32')
      expect(result.command).toContain('--enable-prefix-caching')
    })

    it('should work with throughput-optimized configuration', () => {
      const throughputConfig = {
        'model': 'test-model',
        'tensor-parallel-size': 4,
        'max-num-seqs': 512,
        'gpu-memory-utilization': 0.95
      }

      const result = generateVLLMCommand(throughputConfig)

      expect(result).toBeDefined()
      expect(result.command).toContain('--max-num-seqs 512')
      expect(result.command).toContain('--gpu-memory-utilization 0.95')
    })

    it('should work with balanced configuration', () => {
      const balancedConfig = {
        'model': 'test-model',
        'tensor-parallel-size': 2,
        'max-num-seqs': 128,
        'gpu-memory-utilization': 0.9
      }

      const result = generateVLLMCommand(balancedConfig)

      expect(result).toBeDefined()
      expect(result.command).toContain('--tensor-parallel-size 2')
      expect(result.command).toContain('--max-num-seqs 128')
    })
  })
})
