# Task List: vLLM Configuration Calculator

## Relevant Files

- `vite.config.js` - Vite build configuration for Vue.js SPA with Vitest testing setup
- `tailwind.config.js` - Tailwind CSS configuration file
- `.nvmrc` - Node.js version specification for project consistency
- `src/main.js` - Vue.js application entry point
- `src/App.vue` - Main application component and layout
- `src/test/setup.js` - Vitest global test setup and mocking configuration
- `src/components/GPUSelector.vue` - GPU selection component with predefined and custom options
- `src/components/GPUSelector.test.js` - Unit tests for GPU selector component
- `src/components/ModelSelector.vue` - Model selection component with Hugging Face integration
- `src/components/ModelSelector.test.js` - Unit tests for model selector component
- `src/components/ConfigurationOutput.vue` - Component displaying the three recommendation sets
- `src/components/ConfigurationOutput.test.js` - Unit tests for configuration output component
- `src/components/VRAMChart.vue` - Chart.js visualization component for VRAM usage
- `src/components/VRAMChart.test.js` - Unit tests for VRAM chart component
- `src/lib/calculationEngine.js` - Core vLLM parameter calculation logic
- `src/lib/calculationEngine.test.js` - Unit tests for calculation engine
- `src/lib/huggingfaceApi.js` - Utility functions for Hugging Face API integration
- `src/lib/huggingfaceApi.test.js` - Unit tests for Hugging Face API utilities
- `src/lib/dataLoader.js` - Utility functions for loading GPU and model data
- `src/lib/dataLoader.test.js` - Unit tests for data loader utilities
- `public/index.html` - Main HTML template
- `.github/workflows/deploy.yml` - GitHub Actions workflow for deployment
- `README.md` - Project documentation

### Notes

- Unit tests should be placed alongside the code files they are testing in the same directory
- Use `npm test` to run all tests in watch mode
- Use `npm run test:run` to run tests once (CI/CD)
- Use `npm run test:ui` to open Vitest web UI for debugging
- Use `npm run test:coverage` to generate coverage reports
- Use `npm run dev` to start the development server
- Use `npm run build` to build the production version
- Node.js 20.19.4+ is required (specified in .nvmrc and package.json engines)

### Technical Implementation Notes

- **Tailwind CSS v4**: Using modern CSS-first approach without PostCSS dependencies
- **Vitest**: Chosen over Jest for better Vite integration and modern testing features
- **Chart.js Mocking**: Chart.js components are properly mocked in test setup for component testing
- **Node Version Management**: .nvmrc file ensures consistent Node.js version across development environments

## Tasks

- [x] 1.0 Project Setup and Infrastructure
  - [x] 1.1 Initialize Vue.js project with Vite
  - [x] 1.2 Install and configure Tailwind CSS
  - [x] 1.3 Install Chart.js and Vue Chart.js integration
  - [x] 1.4 Set up Vitest testing framework
  - [x] 1.5 Create basic project structure and directories
  - [x] 1.6 Configure ESLint and Prettier for code quality
- [x] 2.0 Core Calculation Engine Development
  - [x] 2.1 Research and implement vLLM memory calculation formulas
  - [x] 2.2 Implement quantization factor calculations for different formats (FP16, AWQ, GPTQ)
  - [x] 2.3 Create calculation functions for throughput-optimized configurations
  - [x] 2.4 Create calculation functions for latency-optimized configurations
  - [x] 2.5 Create calculation functions for balanced configurations
  - [x] 2.6 Implement VRAM breakdown calculations (model weights, KV cache, swap, reserved) with quantization support
  - [x] 2.7 Add parameter validation and error handling
  - [x] 2.8 Write comprehensive unit tests for all calculation functions including quantization scenarios
- [x] 3.0 GPU Selection Component Development
  - [x] 3.1 Create GPU selector component with predefined list integration
  - [x] 3.2 Implement quantity selection for each GPU type
  - [x] 3.3 Add custom GPU input functionality with VRAM specification
  - [x] 3.4 Implement GPU selection validation and error states
  - [x] 3.5 Style component according to design specifications
  - [x] 3.6 Write unit tests for GPU selector component
- [x] 4.0 Model Selection Component Development
  - [x] 4.1 Create model selector component with predefined list integration including quantization variants
  - [x] 4.2 Implement clear display of quantization information and memory factors
  - [x] 4.3 Implement Hugging Face API integration for custom model fetching with quantization detection
  - [x] 4.4 Create fallback manual entry form for model specifications including quantization options
  - [x] 4.5 Add loading states and error handling for API calls
  - [x] 4.6 Implement multi-model selection functionality with quantization awareness
  - [x] 4.7 Style component and add user guidance for manual entry and quantization selection
  - [x] 4.8 Write unit tests for model selector component including quantization scenarios
- [x] 5.0 Configuration Output Component Development
  - [x] 5.1 Create component to display three recommendation sets (throughput, latency, balanced)
  - [x] 5.2 Implement parameter explanations for each vLLM setting
  - [x] 5.3 Add copy-to-clipboard functionality for command strings
  - [x] 5.4 Create tabbed or card-based layout for easy comparison
  - [x] 5.5 Style output component with clear visual hierarchy
  - [x] 5.6 Write unit tests for configuration output component
- [x] 6.0 VRAM Visualization Component Development
  - [x] 6.1 Set up Chart.js integration with Vue.js
  - [x] 6.2 Create stacked bar chart for VRAM usage breakdown
  - [x] 6.3 Implement dynamic chart updates based on configuration changes
  - [x] 6.4 Add chart labels and legends for clarity
  - [x] 6.5 Style charts to match application design
  - [x] 6.6 Write unit tests for VRAM chart component
- [x] 7.0 Main Application Integration and Layout
  - [x] 7.1 Create main App.vue component with overall layout
  - [x] 7.2 Implement state management for GPU and model selections
  - [x] 7.3 Connect calculation engine to UI components
  - [x] 7.4 Add application header and navigation elements
  - [x] 7.5 Implement responsive layout for different screen sizes
  - [x] 7.6 Add loading states and error boundaries
- [ ] 8.0 UI/UX Polish and Responsive Design
  - [x] 8.1 Refine component styling for professional appearance
  - [x] 8.2 Implement responsive design for mobile and tablet views
  - [x] 8.3 Add micro-interactions and smooth transitions
  - [ ] 8.4 Optimize typography and spacing throughout application
  - [ ] 8.5 Conduct accessibility audit and implement improvements
  - [ ] 8.6 Add application favicon and meta tags
- [ ] 9.0 Testing and Quality Assurance
  - [ ] 9.1 Write integration tests for complete user workflows
  - [ ] 9.2 Perform cross-browser testing
  - [ ] 9.3 Test with various GPU and model combinations including quantized variants
  - [ ] 9.4 Validate calculation accuracy against known vLLM configurations with different quantization formats
  - [ ] 9.5 Performance testing and optimization
  - [ ] 9.6 Final bug fixes and edge case handling
- [ ] 10.0 Deployment and CI/CD Setup
  - [ ] 10.1 Create GitHub Actions workflow for automated building
  - [ ] 10.2 Configure deployment to GitHub Pages
  - [ ] 10.3 Set up automated testing in CI pipeline
  - [ ] 10.4 Configure build optimization for production
  - [ ] 10.5 Update README with usage instructions and documentation
  - [ ] 10.6 Verify production deployment and conduct final testing
