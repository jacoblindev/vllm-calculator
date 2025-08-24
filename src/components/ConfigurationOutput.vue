<template>
  <div class="bg-white rounded-lg shadow-lg p-6">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">vLLM Configuration Recommendations</h2>

    <div v-if="!hasConfiguration" class="text-center py-12 text-gray-500">
      <p class="text-lg">Select GPUs and models to see configuration recommendations</p>
    </div>

    <div v-else class="space-y-6">
      <!-- Configuration Tabs -->
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <button
            v-for="config in configurations"
            :key="config.type"
            @click="activeTab = config.type"
            :class="[
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === config.type
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
          >
            {{ config.title }}
          </button>
        </nav>
      </div>

      <!-- Active Configuration Display -->
      <div v-for="config in configurations" :key="config.type" v-show="activeTab === config.type">
        <div class="mb-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-2">{{ config.title }}</h3>
          <p class="text-gray-600">{{ config.description }}</p>
        </div>

        <!-- Parameters Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div v-for="param in config.parameters" :key="param.name" class="border rounded-lg p-4">
            <div class="flex justify-between items-start mb-2">
              <h4 class="font-medium text-gray-900">{{ param.name }}</h4>
              <code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{{ param.value }}</code>
            </div>
            <p class="text-sm text-gray-600">{{ param.explanation }}</p>
          </div>
        </div>

        <!-- Command Line -->
        <div class="border-t pt-6">
          <div class="flex justify-between items-center mb-3">
            <h4 class="font-medium text-gray-900">Command Line</h4>
            <button
              @click="copyCommand(config.command)"
              class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              {{ copiedCommand === config.command ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <div class="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
            <code class="font-mono text-sm whitespace-pre-wrap">{{ config.command }}</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { calculateVRAMUsage } from '../lib/calculationEngine.js'

// Props
const props = defineProps({
  selectedGPUs: {
    type: Array,
    default: () => [],
  },
  selectedModels: {
    type: Array,
    default: () => [],
  },
})

// Reactive data
const activeTab = ref('throughput')
const copiedCommand = ref('')

// Computed properties
const hasConfiguration = computed(
  () => props.selectedGPUs.length > 0 && props.selectedModels.length > 0
)

const totalVRAM = computed(() =>
  props.selectedGPUs.reduce((total, sel) => total + sel.gpu.vram * sel.quantity, 0)
)

const totalModelSize = computed(() =>
  props.selectedModels.reduce((total, model) => total + (model.size || 0), 0)
)

const configurations = computed(() => {
  if (!hasConfiguration.value) return []

  const remainingVRAM = totalVRAM.value - totalModelSize.value
  const baseMemoryUtilization = Math.min(
    0.9,
    Math.max(0.5, totalModelSize.value / totalVRAM.value + 0.1)
  )

  const configs = [
    {
      type: 'throughput',
      title: 'Maximum Throughput',
      description:
        'Optimized for handling the highest number of concurrent requests and maximum token generation.',
      parameters: [
        {
          name: '--gpu-memory-utilization',
          value: Math.min(0.95, baseMemoryUtilization + 0.1).toFixed(2),
          explanation: 'High memory utilization to maximize concurrent processing capacity.',
        },
        {
          name: '--max-model-len',
          value: '2048',
          explanation: 'Shorter sequences to allow more concurrent requests and higher throughput.',
        },
        {
          name: '--max-num-seqs',
          value: Math.max(32, Math.floor(remainingVRAM / 2)).toString(),
          explanation: 'High concurrent sequence limit to maximize parallel processing.',
        },
        {
          name: '--max-num-batched-tokens',
          value: Math.max(8192, Math.floor(remainingVRAM * 1024)).toString(),
          explanation: 'Large batch size to maximize GPU utilization and throughput.',
        },
        {
          name: '--block-size',
          value: '16',
          explanation:
            'Larger block size for efficient memory allocation in high-throughput scenarios.',
        },
        {
          name: '--swap-space',
          value: Math.max(4, Math.floor(totalVRAM.value * 0.1)).toString(),
          explanation:
            'Generous swap space to handle peak memory usage during high throughput periods.',
        },
      ],
    },
    {
      type: 'latency',
      title: 'Minimum Latency',
      description: 'Optimized for fastest response times and lowest latency per request.',
      parameters: [
        {
          name: '--gpu-memory-utilization',
          value: Math.max(0.7, baseMemoryUtilization - 0.1).toFixed(2),
          explanation:
            'Conservative memory utilization to ensure consistent performance and low latency.',
        },
        {
          name: '--max-model-len',
          value: '4096',
          explanation:
            'Longer sequences supported while maintaining low latency for individual requests.',
        },
        {
          name: '--max-num-seqs',
          value: Math.max(8, Math.floor(remainingVRAM / 4)).toString(),
          explanation: 'Lower concurrent sequences to minimize context switching and latency.',
        },
        {
          name: '--max-num-batched-tokens',
          value: Math.max(2048, Math.floor(remainingVRAM * 512)).toString(),
          explanation: 'Smaller batches for faster processing and reduced waiting time.',
        },
        {
          name: '--block-size',
          value: '8',
          explanation:
            'Smaller block size for more granular memory management and faster allocation.',
        },
        {
          name: '--swap-space',
          value: Math.max(2, Math.floor(totalVRAM.value * 0.05)).toString(),
          explanation: 'Minimal swap space to reduce memory management overhead.',
        },
      ],
    },
    {
      type: 'balanced',
      title: 'Balanced Performance',
      description:
        'Balanced configuration providing good throughput while maintaining reasonable latency.',
      parameters: [
        {
          name: '--gpu-memory-utilization',
          value: baseMemoryUtilization.toFixed(2),
          explanation:
            'Balanced memory utilization for optimal resource usage without overcommitment.',
        },
        {
          name: '--max-model-len',
          value: '3072',
          explanation: 'Moderate sequence length balancing memory usage and capability.',
        },
        {
          name: '--max-num-seqs',
          value: Math.max(16, Math.floor(remainingVRAM / 3)).toString(),
          explanation: 'Moderate concurrent sequences for balanced performance.',
        },
        {
          name: '--max-num-batched-tokens',
          value: Math.max(4096, Math.floor(remainingVRAM * 768)).toString(),
          explanation: 'Medium batch size balancing throughput and latency.',
        },
        {
          name: '--block-size',
          value: '12',
          explanation: 'Medium block size for balanced memory management efficiency.',
        },
        {
          name: '--swap-space',
          value: Math.max(3, Math.floor(totalVRAM.value * 0.075)).toString(),
          explanation: 'Reasonable swap space for handling moderate memory pressure.',
        },
      ],
    },
  ]

  // Add commands to each configuration
  configs.forEach(config => {
    config.command = generateCommandForConfig(config)
  })

  return configs
})

// Methods
function generateCommandForConfig(config) {
  if (!hasConfiguration.value) return ''

  const modelPath = props.selectedModels[0]?.hf_id || props.selectedModels[0]?.name || 'MODEL_PATH'

  let cmd = `python -m vllm.entrypoints.openai.api_server \\\n`
  cmd += `  --model ${modelPath} \\\n`

  config.parameters.forEach(param => {
    cmd += `  ${param.name} ${param.value} \\\n`
  })

  // Add tensor parallel if multiple GPUs
  const totalGPUs = props.selectedGPUs.reduce((total, sel) => total + sel.quantity, 0)
  if (totalGPUs > 1) {
    cmd += `  --tensor-parallel-size ${totalGPUs} \\\n`
  }

  cmd += `  --host 0.0.0.0 \\\n`
  cmd += `  --port 8000`

  return cmd
}

async function copyCommand(command) {
  try {
    await navigator.clipboard.writeText(command)
    copiedCommand.value = command
    setTimeout(() => {
      copiedCommand.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy command:', error)
  }
}

// Watch for changes to reset active tab
watch(
  () => [props.selectedGPUs, props.selectedModels],
  () => {
    if (hasConfiguration.value) {
      activeTab.value = 'throughput'
    }
  },
  { deep: true }
)
</script>
