/**
 * Calculate VRAM usage for a model with given parameters
 * @param {number} modelSizeGB - Model size in GB
 * @param {number} quantizationFactor - Quantization factor (1 for FP16, 0.5 for 4-bit)
 * @param {number} batchSize - Batch size
 * @param {number} sequenceLength - Sequence length
 * @param {number} overheadFactor - Additional overhead factor (default 1.2)
 * @returns {number} Estimated VRAM usage in GB
 */
export function calculateVRAMUsage(
  modelSizeGB,
  quantizationFactor = 1,
  batchSize = 1,
  sequenceLength = 2048,
  overheadFactor = 1.2
) {
  if (modelSizeGB <= 0) {
    throw new Error('Model size must be positive')
  }

  const baseMemory = modelSizeGB * quantizationFactor
  const activationMemory = batchSize * sequenceLength * 0.001 // Simplified calculation
  const totalMemory = (baseMemory + activationMemory) * overheadFactor

  return Math.round(totalMemory * 100) / 100 // Round to 2 decimal places
}

/**
 * Check if a GPU has enough VRAM for a given configuration
 * @param {number} gpuVRAM - GPU VRAM in GB
 * @param {number} requiredVRAM - Required VRAM in GB
 * @returns {boolean} Whether GPU has enough VRAM
 */
export function canRunOnGPU(gpuVRAM, requiredVRAM) {
  return gpuVRAM >= requiredVRAM
}
