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
    // Create a fresh pinia instance for each test
    setActivePinia(createPinia())
    
    // Reset all mocks
    vi.clearAllMocks()
  })

  it('renders the header with brand section', () => {
    const wrapper = mount(TheHeader)
    
    expect(wrapper.find('h1').text()).toBe('vLLM Calculator')
    expect(wrapper.find('p').text()).toBe('GPU Configuration Tool')
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('renders navigation links with correct styling', () => {
    const wrapper = mount(TheHeader)
    
    const navLinks = wrapper.findAll('nav a')
    expect(navLinks).toHaveLength(3)
    
    // Check GPU Setup link
    expect(navLinks[0].text()).toContain('GPU Setup')
    expect(navLinks[0].attributes('href')).toBe('#gpu-selection')
    
    // Check Model Setup link
    expect(navLinks[1].text()).toContain('Model Setup')
    expect(navLinks[1].attributes('href')).toBe('#model-selection')
    
    // Check Configurations link
    expect(navLinks[2].text()).toContain('Configurations')
    expect(navLinks[2].attributes('href')).toBe('#configuration-results')
  })

  it('shows active navigation state correctly', () => {
    mockConfigStore.configurationStep = 'gpu'
    const wrapper = mount(TheHeader)
    
    const gpuLink = wrapper.find('a[href="#gpu-selection"]')
    expect(gpuLink.classes()).toContain('text-blue-600')
    expect(gpuLink.classes()).toContain('border-blue-600')
  })

  it('renders configuration health indicator', () => {
    const wrapper = mount(TheHeader)
    
    const healthIndicator = wrapper.find('.w-3.h-3.rounded-full')
    expect(healthIndicator.exists()).toBe(true)
    expect(healthIndicator.classes()).toContain('bg-green-500') // healthy status
    
    expect(wrapper.text()).toContain('Ready')
  })

  it('renders setup progress indicator', () => {
    mockConfigStore.setupProgress = 75
    const wrapper = mount(TheHeader)
    
    const progressElements = wrapper.findAll('.text-gray-500')
    const progressText = progressElements.find(el => el.text().includes('%'))
    expect(progressText.text()).toBe('75%')
    
    const progressBar = wrapper.find('.bg-blue-600')
    expect(progressBar.attributes('style')).toBe('width: 75%;')
  })

  it('shows action buttons when configuration is valid', async () => {
    mockConfigStore.hasValidConfiguration = true
    const wrapper = mount(TheHeader)
    
    const saveButton = wrapper.find('button[title="Save current configuration"]')
    expect(saveButton.exists()).toBe(true)
    expect(saveButton.text()).toContain('Save')
  })

  it('shows clear button when selections exist', async () => {
    mockGpuStore.selectedGPUs = [{ id: 'gpu1' }]
    const wrapper = mount(TheHeader)
    
    const clearButton = wrapper.find('button[title="Clear all selections"]')
    expect(clearButton.exists()).toBe(true)
    expect(clearButton.text()).toContain('Clear')
  })

  it('toggles settings menu when settings button is clicked', async () => {
    const wrapper = mount(TheHeader)
    
    const settingsButton = wrapper.find('button[title="Settings and options"]')
    await settingsButton.trigger('click')
    
    expect(mockUiStore.toggleSettingsMenu).toHaveBeenCalled()
  })

  it('toggles mobile menu when mobile menu button is clicked', async () => {
    const wrapper = mount(TheHeader)
    
    const mobileMenuButton = wrapper.find('button[data-mobile-menu]')
    await mobileMenuButton.trigger('click')
    
    expect(mockUiStore.toggleMobileMenu).toHaveBeenCalled()
  })

  it('renders settings dropdown when showSettingsMenu is true', () => {
    mockUiStore.showSettingsMenu = true
    const wrapper = mount(TheHeader)
    
    const dropdown = wrapper.find('.absolute.right-0.mt-2')
    expect(dropdown.exists()).toBe(true)
    expect(dropdown.text()).toContain('Clear Saved Data')
    expect(dropdown.text()).toContain('Show Debug Info')
    expect(dropdown.text()).toContain('vLLM Documentation')
  })

  it('renders mobile menu when showMobileMenu is true', () => {
    mockUiStore.showMobileMenu = true
    const wrapper = mount(TheHeader)
    
    const mobileMenu = wrapper.find('[data-mobile-menu-content]')
    expect(mobileMenu.exists()).toBe(true)
    expect(mobileMenu.text()).toContain('GPU Setup')
    expect(mobileMenu.text()).toContain('Model Setup')
    expect(mobileMenu.text()).toContain('Configurations')
  })

  it('calls saveStateToStorage when save button is clicked', async () => {
    mockConfigStore.hasValidConfiguration = true
    const wrapper = mount(TheHeader)
    
    const saveButton = wrapper.find('button[title="Save current configuration"]')
    await saveButton.trigger('click')
    
    expect(mockUiStore.updateLastSavedState).toHaveBeenCalled()
    expect(mockUiStore.showSuccessNotification).toHaveBeenCalledWith('Configuration saved successfully!')
  })

  it('calls clearStoredState when clear button is clicked', async () => {
    mockGpuStore.selectedGPUs = [{ id: 'gpu1' }]
    const wrapper = mount(TheHeader)
    
    const clearButton = wrapper.find('button[title="Clear all selections"]')
    await clearButton.trigger('click')
    
    expect(mockGpuStore.clearAllGPUs).toHaveBeenCalled()
    expect(mockModelStore.clearAllModels).toHaveBeenCalled()
  })

  it('renders external documentation link', () => {
    mockUiStore.showSettingsMenu = true
    const wrapper = mount(TheHeader)
    
    const docLink = wrapper.find('a[href="https://docs.vllm.ai/"]')
    expect(docLink.exists()).toBe(true)
    expect(docLink.attributes('target')).toBe('_blank')
    expect(docLink.attributes('rel')).toBe('noopener noreferrer')
  })

  it('adds event listeners on mount', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
    
    mount(TheHeader)
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function))
  })
})
