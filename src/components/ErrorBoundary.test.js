import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ErrorBoundary from './ErrorBoundary.vue'

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
  },
  writable: true,
})

// Test component that works normally
const NormalComponent = {
  template: '<div>Normal content</div>'
}

describe('ErrorBoundary.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: {
        reload: vi.fn()
      },
      writable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Normal Operation', () => {
    it('should render slot content when no error occurs', () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: NormalComponent
        }
      })

      expect(wrapper.text()).toContain('Normal content')
      expect(wrapper.find('.min-h-screen').exists()).toBe(false)
    })

    it('should not show error state initially', () => {
      const wrapper = mount(ErrorBoundary)
      
      expect(wrapper.vm.hasError).toBe(false)
      expect(wrapper.text()).not.toContain('Something went wrong')
    })
  })

  describe('Props Configuration', () => {
    it('should accept fallback message prop', () => {
      const wrapper = mount(ErrorBoundary, {
        props: {
          fallbackMessage: 'Custom fallback message'
        }
      })

      expect(wrapper.props('fallbackMessage')).toBe('Custom fallback message')
    })

    it('should accept showDetails prop', () => {
      const wrapper = mount(ErrorBoundary, {
        props: {
          showDetails: true
        }
      })

      expect(wrapper.props('showDetails')).toBe(true)
    })

    it('should accept showReportButton prop', () => {
      const wrapper = mount(ErrorBoundary, {
        props: {
          showReportButton: true
        }
      })

      expect(wrapper.props('showReportButton')).toBe(true)
    })
  })

  describe('Exposed Methods', () => {
    it('should expose resetError method', () => {
      const wrapper = mount(ErrorBoundary)
      expect(typeof wrapper.vm.resetError).toBe('function')
    })

    it('should have hasError property', () => {
      const wrapper = mount(ErrorBoundary)
      expect(typeof wrapper.vm.hasError).toBe('boolean')
    })
  })

  describe('User Experience', () => {
    it('should have proper component structure', () => {
      const wrapper = mount(ErrorBoundary)
      expect(wrapper.exists()).toBe(true)
    })

    it('should handle slot content properly', () => {
      const wrapper = mount(ErrorBoundary, {
        slots: {
          default: '<div class="test-content">Test content</div>'
        }
      })

      expect(wrapper.find('.test-content').exists()).toBe(true)
      expect(wrapper.text()).toContain('Test content')
    })
  })
})
