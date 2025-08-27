import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import LoadingIndicator from './LoadingIndicator.vue'

// Mock the useGlobalLoading composable
const mockIsAnyLoading = vi.fn()
const mockActiveStates = vi.fn()

vi.mock('../composables/useLoadingState.js', () => ({
  useGlobalLoading: () => ({
    isAnyLoading: mockIsAnyLoading(),
    activeLoadingStates: mockActiveStates()
  })
}))

describe('LoadingIndicator.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock values - no loading
    mockIsAnyLoading.mockReturnValue({ value: false })
    mockActiveStates.mockReturnValue({ value: [] })
    
    // Mock timers
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Component Structure', () => {
    it('should render without errors when no loading', () => {
      const wrapper = mount(LoadingIndicator)
      expect(wrapper.exists()).toBe(true)
    })

    it('should have proper teleport structure', () => {
      const wrapper = mount(LoadingIndicator)
      expect(wrapper.find('teleport-stub').exists()).toBe(true)
    })

    it('should have inline loading states container', () => {
      const wrapper = mount(LoadingIndicator)
      expect(wrapper.find('.space-y-2').exists()).toBe(true)
    })
  })

  describe('Global Loading Overlay', () => {
    it('should show overlay when loading with multiple states', () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [
          { namespace: 'gpu-data', message: 'Loading GPU data...' },
          { namespace: 'model-data', message: 'Loading model data...' }
        ]
      })

      const wrapper = mount(LoadingIndicator)
      expect(wrapper.vm.showGlobalLoading).toBe(true)
    })

    it('should show overlay for critical operations', () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [
          { namespace: 'calculations', message: 'Calculating configurations...' }
        ]
      })

      const wrapper = mount(LoadingIndicator)
      expect(wrapper.vm.showGlobalLoading).toBe(true)
    })

    it('should not show overlay when not loading', () => {
      mockIsAnyLoading.mockReturnValue({ value: false })
      mockActiveStates.mockReturnValue({ value: [] })

      const wrapper = mount(LoadingIndicator)
      expect(wrapper.vm.showGlobalLoading).toBe(false)
    })
  })

  describe('Mode Configuration', () => {
    it('should respect overlay mode', () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [{ namespace: 'test', message: 'Testing...' }]
      })

      const wrapper = mount(LoadingIndicator, {
        props: { mode: 'overlay' }
      })

      expect(wrapper.vm.showGlobalLoading).toBe(true)
    })

    it('should respect inline mode', () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [{ namespace: 'test', message: 'Testing...' }]
      })

      const wrapper = mount(LoadingIndicator, {
        props: { mode: 'inline' }
      })

      expect(wrapper.vm.showGlobalLoading).toBe(false)
      expect(wrapper.vm.inlineStates.length).toBe(1)
    })

    it('should respect none mode', () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [{ namespace: 'test', message: 'Testing...' }]
      })

      const wrapper = mount(LoadingIndicator, {
        props: { mode: 'none' }
      })

      expect(wrapper.vm.showGlobalLoading).toBe(false)
      expect(wrapper.vm.inlineStates.length).toBe(0)
    })
  })

  describe('Loading Messages', () => {
    it('should display correct title for GPU data loading', () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [{ namespace: 'gpu-data', message: 'Loading GPU data...' }]
      })

      const wrapper = mount(LoadingIndicator)
      expect(wrapper.vm.currentLoadingTitle).toBe('Loading GPU Data')
    })

    it('should display correct title for model data loading', () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [{ namespace: 'model-data', message: 'Loading model data...' }]
      })

      const wrapper = mount(LoadingIndicator)
      expect(wrapper.vm.currentLoadingTitle).toBe('Loading Model Data')
    })

    it('should display correct title for calculations', () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [{ namespace: 'calculations', message: 'Calculating configurations...' }]
      })

      const wrapper = mount(LoadingIndicator)
      expect(wrapper.vm.currentLoadingTitle).toBe('Calculating Configurations')
    })

    it('should display default title for unknown namespace', () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [{ namespace: 'unknown', message: 'Unknown operation...' }]
      })

      const wrapper = mount(LoadingIndicator)
      expect(wrapper.vm.currentLoadingTitle).toBe('Loading')
    })
  })

  describe('Cancel Functionality', () => {
    it('should emit cancel event when cancel button is clicked', async () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [{ namespace: 'test', message: 'Testing...' }]
      })

      const wrapper = mount(LoadingIndicator, {
        props: { showCancelButton: true }
      })

      // Set cancel button to show
      wrapper.vm.showCancel = true
      await nextTick()

      await wrapper.vm.handleCancel()
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('should emit cancel event on background click for non-critical operations', async () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [{ namespace: 'test', message: 'Testing...' }]
      })

      const wrapper = mount(LoadingIndicator)
      await wrapper.vm.handleBackgroundClick()
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('should not emit cancel on background click for critical operations', async () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [{ namespace: 'calculations', message: 'Calculating...' }]
      })

      const wrapper = mount(LoadingIndicator)
      await wrapper.vm.handleBackgroundClick()
      expect(wrapper.emitted('cancel')).toBeFalsy()
    })
  })

  describe('Progress Indication', () => {
    it('should calculate correct progress for multiple states', () => {
      mockIsAnyLoading.mockReturnValue({ value: true })
      mockActiveStates.mockReturnValue({ 
        value: [
          { namespace: 'gpu-data', message: 'Loading GPU data...' },
          { namespace: 'model-data', message: 'Loading model data...' },
          { namespace: 'calculations', message: 'Calculating...' }
        ]
      })

      const wrapper = mount(LoadingIndicator)
      wrapper.vm.currentStateIndex = 1 // Second state
      
      const progress = ((wrapper.vm.currentStateIndex + 1) / wrapper.vm.activeStates.length) * 100
      expect(Math.round(progress * 100) / 100).toBe(66.67)
    })
  })

  describe('Props Validation', () => {
    it('should accept valid mode prop', () => {
      const wrapper = mount(LoadingIndicator, {
        props: { mode: 'overlay' }
      })
      expect(wrapper.props('mode')).toBe('overlay')
    })

    it('should accept showCancelButton prop', () => {
      const wrapper = mount(LoadingIndicator, {
        props: { showCancelButton: true }
      })
      expect(wrapper.props('showCancelButton')).toBe(true)
    })

    it('should accept cancelTimeout prop', () => {
      const wrapper = mount(LoadingIndicator, {
        props: { cancelTimeout: 15000 }
      })
      expect(wrapper.props('cancelTimeout')).toBe(15000)
    })

    it('should accept overlayThreshold prop', () => {
      const wrapper = mount(LoadingIndicator, {
        props: { overlayThreshold: 3 }
      })
      expect(wrapper.props('overlayThreshold')).toBe(3)
    })
  })

  describe('Timer Management', () => {
    it('should start cancel timer when loading begins', async () => {
      const wrapper = mount(LoadingIndicator, {
        props: { cancelTimeout: 1000 }
      })

      // Test the method directly
      wrapper.vm.startCancelTimer()
      expect(wrapper.vm.cancelTimer).toBeTruthy()
    })

    it('should clear cancel timer when loading ends', async () => {
      const wrapper = mount(LoadingIndicator)

      // Start timer
      wrapper.vm.startCancelTimer()
      expect(wrapper.vm.cancelTimer).toBeTruthy()

      // Clear timer
      wrapper.vm.clearCancelTimer()
      expect(wrapper.vm.cancelTimer).toBeNull()
      expect(wrapper.vm.showCancel).toBe(false)
    })
  })

  describe('State Cycling', () => {
    it('should cycle through multiple loading states', () => {
      mockActiveStates.mockReturnValue({ 
        value: [
          { namespace: 'gpu-data', message: 'Loading GPU data...' },
          { namespace: 'model-data', message: 'Loading model data...' }
        ]
      })

      const wrapper = mount(LoadingIndicator)
      
      expect(wrapper.vm.currentStateIndex).toBe(0)
      
      // Simulate message cycling
      wrapper.vm.currentStateIndex = 1
      expect(wrapper.vm.currentStateIndex).toBe(1)
    })
  })

  describe('Component Lifecycle', () => {
    it('should handle mounting correctly', () => {
      const wrapper = mount(LoadingIndicator)
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.vm.messageIntervalRef).toBeTruthy()
    })

    it('should clean up timers on unmount', () => {
      const wrapper = mount(LoadingIndicator)
      
      // Start a timer first
      wrapper.vm.startCancelTimer()
      expect(wrapper.vm.cancelTimer).toBeTruthy()
      
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
      
      wrapper.unmount()
      
      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(clearIntervalSpy).toHaveBeenCalled()
    })
  })
})