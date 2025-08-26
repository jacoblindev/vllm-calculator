/**
 * Optimization Configuration Constants for vLLM
 * 
 * This module centralizes all optimization configuration constants used across
 * different optimization strategies (throughput, latency, balanced, workload).
 * 
 * Key sections:
 * - Throughput optimization configs
 * - Latency optimization configs  
 * - Balanced optimization configs
 * - Workload type definitions
 * - Performance priority strategies
 * - vLLM parameter definitions
 * - Hardware-specific optimizations
 * 
 * References:
 * - vLLM documentation: https://docs.vllm.ai/en/latest/
 * - Optimization best practices
 * - Production deployment patterns
 */

// ===============================
// THROUGHPUT OPTIMIZATION CONFIGS
// ===============================

export const THROUGHPUT_OPTIMIZATION_CONFIGS = {
  // Default values for different scenarios
  cpu: {
    maxNumSeqsOffline: 256, // Default for offline inference
    maxNumSeqsOnline: 128, // Default for online serving
    maxNumBatchedTokensOffline: 4096, // Default for offline inference
    maxNumBatchedTokensOnline: 2048, // Default for online serving
  },
  gpu: {
    // For optimal throughput, especially with smaller models on large GPUs
    maxNumBatchedTokensOptimal: 8192, // Recommended for throughput
    maxNumSeqsOptimal: 256, // Higher seq count for better batching
  },
  
  // Memory utilization for throughput (higher than default)
  gpuMemoryUtilization: {
    conservative: 0.85,
    balanced: 0.90,
    aggressive: 0.95,
  },
  
  // Block sizes for KV cache
  blockSizes: [16, 32], // Typical values
  
  // Chunked prefill thresholds
  chunkedPrefillThreshold: 8192, // Enable for sequences longer than this
}

// ===============================
// LATENCY OPTIMIZATION CONFIGS
// ===============================

export const LATENCY_OPTIMIZATION_CONFIGS = {
  // Batch sizes for low latency (smaller batches)
  gpu: {
    maxNumSeqsOptimal: 32, // Lower concurrent sequences for faster processing
    maxNumBatchedTokensOptimal: 2048, // Smaller batched tokens to reduce prefill time
    maxNumSeqsMinimal: 8, // For ultra-low latency scenarios
    maxNumBatchedTokensMinimal: 512, // Minimal batching for lowest latency
  },
  
  // Memory utilization for latency (more conservative to avoid swapping)
  gpuMemoryUtilization: {
    conservative: 0.75, // Lower to avoid memory pressure
    balanced: 0.80,
    aggressive: 0.85, // Still conservative compared to throughput
  },
  
  // Chunked prefill settings for latency
  chunkedPrefillSize: 512, // Smaller chunks for lower TTFT
  disableChunkedPrefillThreshold: 4096, // Disable for shorter sequences
  
  // KV cache block sizes (smaller for better memory locality)
  kvCacheBlockSizes: [8, 16], // Smaller blocks for better cache efficiency
  
  // Speculation settings for latency
  speculation: {
    enableSpeculativeDecoding: true,
    speculativeDraftSteps: 2, // Conservative for latency
    speculativeRejectionSamplingSteps: 4,
  },
  
  // Engine arguments for latency optimization
  engineArgs: {
    enableChunkedPrefill: false, // Disabled by default for latency
    maxNumBatchedTokens: 2048, // Lower for faster processing
    blockSize: 8, // Smaller blocks for better cache
    swapSpace: 2, // Minimal swap for faster memory access
  },
}

// ===============================
// BALANCED OPTIMIZATION CONFIGS
// ===============================

export const BALANCED_OPTIMIZATION_CONFIGS = {
  // Moderate batch sizes for balanced performance
  gpu: {
    maxNumSeqsOptimal: 128, // Between throughput (256) and latency (32)
    maxNumBatchedTokensOptimal: 4096, // Between throughput (8192) and latency (2048)
    maxNumSeqsMinimal: 32, // For cost-optimized scenarios
    maxNumSeqsMaximal: 192, // For performance-focused balanced configs
  },
  
  // Memory utilization balances performance and reliability
  gpuMemoryUtilization: {
    conservative: 0.80, // Safe for production
    balanced: 0.85, // Good balance of performance and safety
    aggressive: 0.90, // Higher performance with more risk
  },
  
  // Chunked prefill settings for balanced workloads
  chunkedPrefillSize: 1024, // Moderate chunk size
  adaptiveChunkedPrefill: true, // Enable adaptive chunking
  chunkedPrefillThreshold: 4096, // Enable for longer sequences
  
  // Block sizes optimized for balance
  kvCacheBlockSizes: [16, 32], // Standard block sizes
  defaultBlockSize: 16, // Default for most scenarios
  
  // Speculation settings for balanced performance
  speculation: {
    enableSpeculativeDecoding: true,
    speculativeDraftSteps: 3, // Moderate speculation
    adaptiveSpeculation: true, // Adjust based on workload
  },
  
  // Resource allocation strategies
  resourceAllocation: {
    memoryBuffer: 0.15, // 15% buffer for stability
    computeUtilization: 0.85, // Target compute utilization
    networkBuffer: 0.1, // Network overhead buffer
  },
  
  // Quality vs performance trade-offs
  qualitySettings: {
    enablePrefixCaching: true, // Good for balanced workloads
    maxPrefixCacheSize: 1024, // Moderate cache size
    temperatureStability: 0.1, // Stable output quality
  },
  
  // Balanced optimization targets
  targets: {
    'general': { priority: 'balanced', memoryUtil: 0.85, maxSeqs: 128 },
    'web-api': { priority: 'latency-focused', memoryUtil: 0.80, maxSeqs: 96 },
    'multi-user': { priority: 'throughput-focused', memoryUtil: 0.90, maxSeqs: 160 },
    'cost-optimized': { priority: 'efficiency', memoryUtil: 0.85, maxSeqs: 64 },
    'production': { priority: 'reliability', memoryUtil: 0.80, maxSeqs: 96 },
  },
}

// ===============================
// WORKLOAD TYPE DEFINITIONS
// ===============================

export const WORKLOAD_TYPES = {
  chat: {
    name: 'Interactive Chat',
    description: 'Real-time conversational AI with users',
    characteristics: {
      averageInputLength: 256,
      averageOutputLength: 150,
      burstiness: 'high',
      latencyRequirement: 'low',
      throughputPriority: 'medium',
      contextLength: 'medium-to-long'
    },
    optimizations: {
      priority: 'latency',
      batchingStrategy: 'moderate',
      memoryStrategy: 'balanced',
      specialFeatures: ['prefix-caching', 'chunked-prefill']
    }
  },
  
  completion: {
    name: 'Text Completion',
    description: 'Batch text completion and generation tasks',
    characteristics: {
      averageInputLength: 512,
      averageOutputLength: 200,
      burstiness: 'medium',
      latencyRequirement: 'medium',
      throughputPriority: 'high',
      contextLength: 'variable'
    },
    optimizations: {
      priority: 'throughput',
      batchingStrategy: 'aggressive',
      memoryStrategy: 'efficient',
      specialFeatures: ['batching-optimization']
    }
  },
  
  'code-generation': {
    name: 'Code Generation',
    description: 'Programming assistance and code completion',
    characteristics: {
      averageInputLength: 400,
      averageOutputLength: 100,
      burstiness: 'medium',
      latencyRequirement: 'low',
      throughputPriority: 'medium',
      contextLength: 'long'
    },
    optimizations: {
      priority: 'quality',
      batchingStrategy: 'moderate',
      memoryStrategy: 'stable',
      specialFeatures: ['prefix-caching', 'longer-context']
    }
  },
  
  batch: {
    name: 'Batch Processing',
    description: 'Large-scale offline batch processing',
    characteristics: {
      averageInputLength: 800,
      averageOutputLength: 300,
      burstiness: 'low',
      latencyRequirement: 'relaxed',
      throughputPriority: 'very-high',
      contextLength: 'variable'
    },
    optimizations: {
      priority: 'throughput',
      batchingStrategy: 'maximum',
      memoryStrategy: 'aggressive',
      specialFeatures: ['high-batch-sizes', 'chunked-prefill']
    }
  },
  
  serving: {
    name: 'General API Serving',
    description: 'General-purpose API serving for various applications',
    characteristics: {
      averageInputLength: 400,
      averageOutputLength: 150,
      burstiness: 'medium',
      latencyRequirement: 'balanced',
      throughputPriority: 'balanced',
      contextLength: 'medium'
    },
    optimizations: {
      priority: 'balanced',
      batchingStrategy: 'balanced',
      memoryStrategy: 'balanced',
      specialFeatures: ['adaptive-batching']
    }
  },
  
  embedding: {
    name: 'Embedding Generation',
    description: 'Text embedding generation for similarity and search',
    characteristics: {
      averageInputLength: 300,
      averageOutputLength: 0, // No text output, just embeddings
      burstiness: 'high',
      latencyRequirement: 'medium',
      throughputPriority: 'very-high',
      contextLength: 'short-to-medium'
    },
    optimizations: {
      priority: 'throughput',
      batchingStrategy: 'maximum',
      memoryStrategy: 'efficient',
      specialFeatures: ['high-batch-sizes', 'no-generation']
    }
  }
}

// ===============================
// PERFORMANCE PRIORITY STRATEGIES
// ===============================

export const PERFORMANCE_PRIORITIES = {
  latency: {
    name: 'Latency Optimized',
    batchSizeMultiplier: 0.5,
    memoryUtilization: 0.80,
    specialSettings: {
      'block-size': 8,
      'max-num-seqs': 32,
      'enable-chunked-prefill': false
    }
  },
  
  throughput: {
    name: 'Throughput Optimized',
    batchSizeMultiplier: 2.0,
    memoryUtilization: 0.95,
    specialSettings: {
      'block-size': 16,
      'max-num-seqs': 256,
      'enable-chunked-prefill': true
    }
  },
  
  balanced: {
    name: 'Balanced Performance',
    batchSizeMultiplier: 1.0,
    memoryUtilization: 0.85,
    specialSettings: {
      'block-size': 16,
      'max-num-seqs': 128,
      'enable-chunked-prefill': true
    }
  },
  
  quality: {
    name: 'Quality Optimized',
    batchSizeMultiplier: 0.8,
    memoryUtilization: 0.85,
    specialSettings: {
      'block-size': 16,
      'max-num-seqs': 64,
      'enforce-eager': false // Allow CUDA graphs for consistency
    }
  }
}

// ===============================
// VLLM PARAMETER DEFINITIONS
// ===============================

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
  
  // Parallelism
  'tensor-parallel-size': { type: 'number', description: 'Tensor parallelism degree' },
  'pipeline-parallel-size': { type: 'number', description: 'Pipeline parallelism degree' },
  'distributed-executor-backend': { type: 'string', options: ['ray', 'mp'], description: 'Distributed backend' },
  
  // KV cache and memory
  'block-size': { type: 'number', description: 'Token block size for KV cache' },
  'seed': { type: 'number', description: 'Random seed for reproducibility' },
  
  // Serving and API
  host: { type: 'string', description: 'Host to bind the server' },
  port: { type: 'number', description: 'Port number for the server' },
  'allow-credentials': { type: 'boolean', description: 'Allow credentials in CORS' },
  'allowed-origins': { type: 'array', description: 'Allowed origins for CORS' },
  'allowed-methods': { type: 'array', description: 'Allowed methods for CORS' },
  'allowed-headers': { type: 'array', description: 'Allowed headers for CORS' },
  
  // Logging and monitoring
  'disable-log-stats': { type: 'boolean', description: 'Disable logging statistics' },
  'disable-log-requests': { type: 'boolean', description: 'Disable logging requests' },
  'max-log-len': { type: 'number', description: 'Maximum length of log messages' },
  
  // Engine configuration
  'worker-use-ray': { type: 'boolean', description: 'Use Ray for workers' },
  'engine-use-ray': { type: 'boolean', description: 'Use Ray for engine' },
  'disable-custom-all-reduce': { type: 'boolean', description: 'Disable custom all-reduce kernels' },
  'tokenizer-pool-size': { type: 'number', description: 'Size of tokenizer pool' },
  'tokenizer-pool-type': { type: 'string', description: 'Type of tokenizer pool' },
  'tokenizer-pool-extra-config': { type: 'object', description: 'Extra config for tokenizer pool' },
  
  // Advanced features
  'enable-prefix-caching': { type: 'boolean', description: 'Enable prefix caching' },
  'disable-sliding-window': { type: 'boolean', description: 'Disable sliding window attention' },
  'use-v2-block-manager': { type: 'boolean', description: 'Use V2 block manager' },
  'num-lookahead-slots': { type: 'number', description: 'Number of lookahead slots' },
  'num-scheduler-steps': { type: 'number', description: 'Number of scheduler steps' },
  'multi-step-stream-outputs': { type: 'boolean', description: 'Enable multi-step streaming' },
  
  // Quantization specific
  'quantization-param-path': { type: 'string', description: 'Path to quantization parameters' },
  'device': { type: 'string', description: 'Device type (auto, cuda, cpu)' },
  'image-input-type': { type: 'string', description: 'Image input type for multimodal models' },
  'image-token-id': { type: 'number', description: 'Token ID for image tokens' },
  'image-input-shape': { type: 'string', description: 'Input shape for images' },
  'image-feature-size': { type: 'number', description: 'Size of image features' },
  
  // Chat and completion
  'served-model-name': { type: 'string', description: 'Model name used in API' },
  'chat-template': { type: 'string', description: 'Chat template to use' },
  'response-role': { type: 'string', description: 'Role for assistant responses' },
  'ssl-keyfile': { type: 'string', description: 'SSL key file path' },
  'ssl-certfile': { type: 'string', description: 'SSL certificate file path' },
  'ssl-ca-certs': { type: 'string', description: 'SSL CA certificates file path' },
  'ssl-cert-reqs': { type: 'number', description: 'SSL certificate requirements' },
  
  // Ray and distributed specific
  'ray-workers-use-nsight': { type: 'boolean', description: 'Use Nsight for Ray workers' },
  'num-gpu-blocks-override': { type: 'number', description: 'Override number of GPU blocks' },
  'num-cpu-blocks-override': { type: 'number', description: 'Override number of CPU blocks' },
  
  // Experimental and debugging
  'model-loader-extra-config': { type: 'object', description: 'Extra config for model loader' },
  'preemption-mode': { type: 'string', description: 'Preemption mode for sequences' },
}

// ===============================
// HARDWARE-SPECIFIC OPTIMIZATIONS
// ===============================

export const HARDWARE_CONFIGS = {
  // GPU-specific optimizations
  gpuOptimizations: {
    A100: {
      memoryBandwidth: 1935, // GB/s
      recommendedBlockSize: 16,
      maxBatchSize: 256,
      tensorCoreOptimal: true,
      multiInstanceGPU: true,
    },
    H100: {
      memoryBandwidth: 3350, // GB/s
      recommendedBlockSize: 32,
      maxBatchSize: 512,
      tensorCoreOptimal: true,
      transformerEngine: true,
    },
    V100: {
      memoryBandwidth: 900, // GB/s
      recommendedBlockSize: 16,
      maxBatchSize: 128,
      tensorCoreOptimal: true,
      multiInstanceGPU: false,
    },
    RTX4090: {
      memoryBandwidth: 1008, // GB/s
      recommendedBlockSize: 16,
      maxBatchSize: 64,
      tensorCoreOptimal: true,
      multiInstanceGPU: false,
    },
  },
  
  // CPU-specific settings
  cpuOptimizations: {
    default: {
      numWorkers: 'auto',
      maxBatchSize: 32,
      prefetchFactor: 2,
    }
  },
  
  // Memory hierarchy optimizations
  memoryHierarchy: {
    l1CacheOptimal: 8192, // Optimal data size for L1 cache
    l2CacheOptimal: 65536, // Optimal data size for L2 cache
    ramOptimal: 1048576, // Optimal chunk size for RAM access
  },
}

// ===============================
// DEFAULT OPTIMIZATION PRESETS
// ===============================

export const OPTIMIZATION_PRESETS = {
  development: {
    name: 'Development',
    description: 'Optimized for development and debugging',
    config: {
      ...LATENCY_OPTIMIZATION_CONFIGS,
      maxNumSeqs: 8,
      gpuMemoryUtilization: 0.7,
      enableLogging: true,
      enforceEager: true,
    }
  },
  
  production: {
    name: 'Production',
    description: 'Balanced configuration for production workloads',
    config: {
      ...BALANCED_OPTIMIZATION_CONFIGS,
      maxNumSeqs: 128,
      gpuMemoryUtilization: 0.85,
      enableLogging: false,
      enableMetrics: true,
    }
  },
  
  highThroughput: {
    name: 'High Throughput',
    description: 'Maximized for throughput processing',
    config: {
      ...THROUGHPUT_OPTIMIZATION_CONFIGS,
      maxNumSeqs: 256,
      gpuMemoryUtilization: 0.95,
      enableChunkedPrefill: true,
    }
  },
  
  lowLatency: {
    name: 'Low Latency',
    description: 'Optimized for minimal response time',
    config: {
      ...LATENCY_OPTIMIZATION_CONFIGS,
      maxNumSeqs: 32,
      gpuMemoryUtilization: 0.75,
      enableChunkedPrefill: false,
    }
  },
}

// ===============================
// EXPORT ALL CONFIGURATIONS
// ===============================

export default {
  THROUGHPUT_OPTIMIZATION_CONFIGS,
  LATENCY_OPTIMIZATION_CONFIGS,
  BALANCED_OPTIMIZATION_CONFIGS,
  WORKLOAD_TYPES,
  PERFORMANCE_PRIORITIES,
  VLLM_PARAMETERS,
  HARDWARE_CONFIGS,
  OPTIMIZATION_PRESETS,
}
