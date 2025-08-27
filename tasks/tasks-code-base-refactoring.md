# Task List: Code Base Refactoring

## Relevant Files

### Core Application & State

* `package.json` - To add `pinia` and `pinia-plugin-persistedstate` dependencies.
* `src/main.js` - To install and configure the Pinia plugin.
* `src/App.vue` - To be heavily refactored, removing business logic and simplifying the template to use new layout components.

### State Management (Pinia Stores)

* `src/stores/` - New directory for all Pinia stores.
* `src/stores/gpuStore.js` - New store to manage GPU selections.
* `src/stores/modelStore.js` - New store to manage model selections.
* `src/stores/configStore.js` - New store to handle all derived calculations and configuration results.
* `src/stores/uiStore.js` - New store for UI state (e.g., menus, modals).
* `src/stores/gpuStore.test.js` - Unit tests for the GPU store.
* `src/stores/modelStore.test.js` - Unit tests for the model store.
* `src/stores/configStore.test.js` - Unit tests for the config store.

### Core Logic (Refactoring `calculationEngine`)

* `src/lib/calculationEngine.js` - To be refactored into a smaller orchestrator file.
* `src/lib/calculationEngine.test.js` - To be updated to reflect the new structure.
* `src/lib/memory/vramBreakdown.js` - New module for VRAM calculation logic.
* `src/lib/memory/vramBreakdown.test.js` - Unit tests for the new VRAM module.
* `src/lib/memory/kvCache.js` - New module for KV cache memory calculations.
* `src/lib/memory/kvCache.test.js` - Unit tests for KV cache module.
* `src/lib/memory/activations.js` - New module for activation memory calculations.
* `src/lib/memory/activations.test.js` - Unit tests for activation memory module.
* `src/lib/memory/systemOverhead.js` - New module for system overhead calculations.
* `src/lib/memory/systemOverhead.test.js` - Unit tests for system overhead module.
* `src/lib/optimization/throughputOptimization.js` - New module for throughput optimization strategies.
* `src/lib/optimization/throughputOptimization.test.js` - Unit tests for throughput optimization.
* `src/lib/optimization/latencyOptimization.js` - New module for latency optimization strategies.
* `src/lib/optimization/latencyOptimization.test.js` - Unit tests for latency optimization.
* `src/lib/optimization/balancedOptimization.js` - New module for balanced optimization strategies.
* `src/lib/optimization/balancedOptimization.test.js` - Unit tests for balanced optimization.
* `src/lib/workload/workloadOptimizer.js` - New module for workload-specific optimizations.
* `src/lib/workload/workloadOptimizer.test.js` - Unit tests for workload optimizer.
* `src/lib/workload/commandGenerator.js` - New module for vLLM command generation.
* `src/lib/workload/commandGenerator.test.js` - Unit tests for command generator.
* `src/lib/workload/modelArchitecture.js` - New module for model architecture estimation.
* `src/lib/workload/modelArchitecture.test.js` - Unit tests for model architecture.
* `src/lib/configs/optimizationConfigs.js` - New module for optimization configuration constants.
* `src/lib/configs/optimizationConfigs.test.js` - Unit tests for optimization configs.
* `src/lib/quantization.js` - New module for quantization logic.
* `src/lib/quantization.test.js` - Unit tests for the new quantization module.
* `src/lib/validation.js` - New module for input validation logic.
* `src/lib/validation.test.js` - Unit tests for the new validation module.

### Components (Refactoring & Decomposition)

* `src/components/GPUSelector.vue` - To be refactored to use the Pinia store.
* `src/components/GPUSelector.test.js` - To be updated for Pinia integration.
* `src/components/ModelSelector.vue` - To be refactored to use the Pinia store.
* `src/components/ModelSelector.test.js` - To be updated for Pinia integration.
* `src/components/ConfigurationOutput.vue` - To be refactored to read from the Pinia store.
* `src/components/VRAMChart.vue` - To be refactored to read from the Pinia store.
* `src/components/layout/` - New directory for layout components.
* `src/components/layout/TheHeader.vue` - New component for the site header.
* `src/components/layout/TheFooter.vue` - New component for the site footer.
* `src/components/HeroSection.vue` - New component for the introductory section.
* `src/components/ConfigurationSummary.vue` - New component for the results dashboard.
* `src/components/DebugPanel.vue` - New component for the debugging section.

## Notes

* Unit tests should be placed alongside the code files they are testing in the same directory.
* Use `npm test` to run all tests in watch mode.
* Use `npm run test:coverage` to generate coverage reports.

## Tasks

* [x] 1.0 Refactor Large Files for Maintainability
  * [x] 1.1 Audit `src/lib/calculationEngine.js` for logical domains (VRAM, quantization, validation).
  * [x] 1.2 Extract VRAM breakdown logic to `src/lib/memory/vramBreakdown.js`.
  * [x] 1.3 Extract quantization logic to `src/lib/quantization.js`.
  * [x] 1.4 Extract validation logic to `src/lib/validation.js`.
  * [x] 1.5 Update imports and references across the codebase.
  * [x] 1.6 Add or update unit tests for each new module.
  * [x] 1.7 Further extract optimization strategies from `src/lib/calculationEngine.js` into focused modules.
    * [x] 1.7.1 Extract memory calculation functions to `src/lib/memory/` (kvCache.js, activations.js, systemOverhead.js).
    * [x] 1.7.2 Extract throughput optimization logic to `src/lib/optimization/throughputOptimization.js`.
    * [x] 1.7.3 Extract latency optimization logic to `src/lib/optimization/latencyOptimization.js`. **COMPLETE**
    * [x] 1.7.4 Extract balanced optimization logic to `src/lib/optimization/balancedOptimization.js`.
    * [x] 1.7.5 Extract workload management to `src/lib/workload/` (workloadOptimizer.js, commandGenerator.js, modelArchitecture.js).
    * [x] 1.7.6 Extract configuration constants to `src/lib/configs/optimizationConfigs.js`.
    * [x] 1.7.7 Refactor `src/lib/calculationEngine.js` to be a lightweight orchestrator (~400 lines).
    * [x] 1.7.8 Update all imports and add comprehensive unit tests for new modules.

* [x] 2.0 Review and Optimize Test Coverage
  * [x] 2.1 Audit existing tests for duplication and relevance.
  * [x] 2.2 Group related tests and remove unnecessary edge cases.
  * [x] 2.3 Ensure all new modules have focused unit tests.
  * [x] 2.4 Add integration tests for critical user flows (GPU/model selection → config output).
  * [x] 2.5 Update test documentation and coverage reporting.

* [ ] 3.0 Implement Pinia and Refactor Components for State Management
  * [x] 3.1 Install Pinia and configure it in `src/main.js`.
  * [x] 3.2 Create Pinia stores (e.g., `useGpuStore`, `useModelStore`, `useConfigStore`) to manage global state.
  * [x] 3.3 Move state logic (e.g., `selectedGPUs`, `selectedModels`) and computed properties (e.g., `configurations`, `vramBreakdown`) from `App.vue` into the appropriate Pinia stores.
  * [ ] 3.4 Refactor `GPUSelector.vue` and `ModelSelector.vue` to use Pinia actions for state changes.
  * [ ] 3.5 Refactor `ConfigurationOutput.vue` and `VRAMChart.vue` to read data directly from Pinia getters.
  * [ ] 3.6 Remove old state management logic and prop drilling from all refactored components.
  * [ ] 3.7 Add unit tests for Pinia stores and update component tests.
  * [ ] 3.8 Implement state persistence for Pinia stores to replace the old `localStorage` logic (e.g., using `pinia-plugin-persistedstate`).

* [ ] 4.0 Decompose App.vue into Smaller, Focused Components
  * [ ] 4.1 Create `src/components/layout/TheHeader.vue` and move the header, navigation, and menu logic into it.
  * [ ] 4.2 Create `src/components/layout/TheFooter.vue` for the application footer.
  * [ ] 4.3 Create `src/components/HeroSection.vue` for the main title and description.
  * [ ] 4.4 Create `src/components/ConfigurationSummary.vue` to display the summary dashboard (VRAM breakdown, memory pressure, etc.).
  * [ ] 4.5 Create `src/components/DebugPanel.vue` to encapsulate the debug information section.
  * [ ] 4.6 Update `App.vue` to use these new layout and UI components, drastically
  