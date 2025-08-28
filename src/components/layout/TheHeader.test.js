import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TheHeader from './TheHeader.vue'

// Mock stores
const mockGpuStore = {
  selectedGPUs: [],
  clearAllGPUs: vi.fn()
}

const mockModelStore = {
  selectedModels: [],
  clearAllModels: vi.fn()
}

const mockConfigStore = {
  hasValidConfiguration: false,
  configurationStep: 'gpu',
  setupProgress: 25,
  configurationHealth: {
    status: 'healthy',
    issues: []
  }
}

const mockUiStore = {
  showSettingsMenu: false,
  showMobileMenu: false,
  showDebugInfo: false,
  toggleSettingsMenu: vi.fn(),
  toggleMobileMenu: vi.fn(),
  toggleDebugInfo: vi.fn(),
  updateLastSavedState: vi.fn(),
  showSuccessNotification: vi.fn(),
  clearLastSavedState: vi.fn(),
  showInfoNotification: vi.fn(),
  addStateError: vi.fn()
}

// Mock the store imports
vi.mock('../../stores/gpuStore.js', () => ({
  useGpuStore: () => mockGpuStore
}))

vi.mock('../../stores/modelStore.js', () => ({
  useModelStore: () => mockModelStore
}))

vi.mock('../../stores/configStore.js', () => ({
  useConfigStore: () => mockConfigStore
}))

vi.mock('../../stores/uiStore.js', () => ({
  useUiStore: () => mockUiStore
}))

describe('TheHeader', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    
    // Reset all mocks
    vi.clearAllMocks()
    
    // Reset mock store states
    mockGpuStore.selectedGPUs = []
    mockModelStore.selectedModels = []
    mockConfigStore.hasValidConfiguration = false
    mockConfigStore.configurationStep = 'gpu'
    mockConfigStore.setupProgress = 25
    mockConfigStore.configurationHealth = {
      status: 'healthy',
      issues: []
    }
    mockUiStore.showSettingsMenu = false
    mockUiStore.showMobileMenu = false
    mockUiStore.showDebugInfo = false
  })

  it('renders the header with brand section', () => {
    const wrapper = mount(TheHeader)
    
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.text()).toContain('vLLM Calculator')
  })

  it('renders navigation links with correct styling', () => {
    const wrapper = mount(TheHeader)
    
    const navLinks = wrapper.findAll('nav a')
    expect(navLinks.length).toBeGreaterThanOrEqual(3)
  })

  it('shows active navigation state correctly', () => {
    mockConfigStore.configurationStep = 'gpu'
    const wrapper = mount(TheHeader)
    
    const gpuLink = wrapper.find('a[href="#gpu-selection"]')
    expect(gpuLink.classes()).toContain('text-blue-600')
  })

  it('renders configuration health indicator', () => {
    const wrapper = mount(TheHeader)
    
    const healthIndicator = wrapper.find('.rounded-full')
    expect(healthIndicator.exists()).toBe(true)
  })

  it('renders setup progress indicator', () => {
    mockConfigStore.setupProgress = 75
    const wrapper = mount(TheHeader)
    
    expect(wrapper.text()).toContain('75%')
  })

  it('toggles settings menu when settings button is clicked', async () => {
    const wrapper = mount(TheHeader)
    
    const settingsButton = wrapper.find('button[aria-label="Settings and options"]')
    expect(settingsButton.exists()).toBe(true)
    await settingsButton.trigger('click')
    
    expect(mockUiStore.toggleSettingsMenu).toHaveBeenCalled()
  })

  it('toggles mobile menu when mobile menu button is clicked', async () => {
    const wrapper = mount(TheHeader)
    
    const mobileMenuButton = wrapper.find('button[data-mobile-menu]')
    await mobileMenuButton.trigger('click')
    
    expect(mockUiStore.toggleMobileMenu).toHaveBeenCalled()
  })
})
