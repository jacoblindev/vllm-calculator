# vLLM Configuration Calculator

An interactive web application for estimating vLLM configuration parameters and GPU memory usage for LLM inference workloads. Built with Vue 3, Vite, Tailwind CSS, and Chart.js.

## Features

- GPU selection (predefined and custom)
- Model selection (predefined, Hugging Face API, manual entry)
- Quantization support (FP16, AWQ, GPTQ)
- VRAM usage breakdown and chart visualization
- Three configuration recommendations: throughput, latency, balanced
- Copy-to-clipboard for CLI commands
- Accessibility and responsive design
- Automated testing and CI/CD with GitHub Actions

## Getting Started

### Prerequisites

- Node.js >= 20.19.4 (see `.nvmrc`)

### Install dependencies

```sh
npm ci
```

### Development server

```sh
npm run dev
```

### Build for production

```sh
npm run build
```

### Preview production build

```sh
npm run preview
```

### Run tests

```sh
npm test           # All tests in watch mode
npm run test:run   # Run tests once (CI)
npm run test:ui    # Vitest web UI
npm run test:coverage # Coverage report
```

### Lint and format

```sh
npm run lint        # Auto-fix lint errors
npm run lint:check  # Check lint errors
npm run format      # Format code
npm run format:check # Check formatting
```

## Deployment

Automated deployment to GitHub Pages via GitHub Actions. See `.github/workflows/deploy.yml`.

## Documentation

- See `docs/` for technical notes and PRD
- See `src/components/` for UI components
- See `src/lib/` for calculation logic

## License

MIT
