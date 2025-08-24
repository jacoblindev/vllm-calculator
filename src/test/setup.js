import { expect, vi } from 'vitest'
import { config } from '@vue/test-utils'

// Global test configuration
global.expect = expect
global.vi = vi

// Mock Chart.js for testing
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
  BarElement: vi.fn(),
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
}))

// Mock vue-chartjs
vi.mock('vue-chartjs', () => ({
  Bar: {
    name: 'Bar',
    template: '<div data-testid="bar-chart">Bar Chart</div>',
    props: ['data', 'options'],
  },
}))

// Configure Vue Test Utils
config.global.stubs = {
  teleport: true,
}
