import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUiStore = defineStore('ui', () => {
  // State
  const showSettingsMenu = ref(false)
  const showMobileMenu = ref(false)
  const showDebugInfo = ref(false)
  const applicationReady = ref(false)
  const isStateRestoring = ref(false)
  const stateErrors = ref([])
  const lastSavedState = ref(null)

  // Theme and appearance
  const darkMode = ref(false)
  const compactMode = ref(false)
  const sidebarCollapsed = ref(false)

  // Notification system
  const notifications = ref([])
  const notificationId = ref(0)

  // Loading states
  const globalLoading = ref(false)
  const loadingMessages = ref([])

  // Modal states
  const activeModal = ref(null)
  const modalData = ref(null)

  // Getters
  const hasErrors = computed(() => stateErrors.value.length > 0)
  
  const hasNotifications = computed(() => notifications.value.length > 0)
  
  const unreadNotifications = computed(() => 
    notifications.value.filter(n => !n.read).length
  )

  const criticalErrors = computed(() => 
    stateErrors.value.filter(err => err.level === 'critical')
  )

  const isAnyMenuOpen = computed(() => 
    showSettingsMenu.value || showMobileMenu.value
  )

  // Actions
  const toggleSettingsMenu = () => {
    showSettingsMenu.value = !showSettingsMenu.value
    if (showSettingsMenu.value) {
      showMobileMenu.value = false
    }
  }

  const toggleMobileMenu = () => {
    showMobileMenu.value = !showMobileMenu.value
    if (showMobileMenu.value) {
      showSettingsMenu.value = false
    }
  }

  const toggleDebugInfo = () => {
    showDebugInfo.value = !showDebugInfo.value
  }

  const closeAllMenus = () => {
    showSettingsMenu.value = false
    showMobileMenu.value = false
  }

  const setApplicationReady = (ready) => {
    applicationReady.value = ready
  }

  const setStateRestoring = (restoring) => {
    isStateRestoring.value = restoring
  }

  // State error management
  const addStateError = (message, level = 'warning') => {
    const error = {
      id: Date.now(),
      message,
      level,
      timestamp: new Date()
    }
    stateErrors.value.push(error)
    
    // Auto-remove non-critical errors after 5 seconds
    if (level !== 'critical') {
      setTimeout(() => {
        removeStateError(error.id)
      }, 5000)
    }
  }

  const removeStateError = (errorId) => {
    const index = stateErrors.value.findIndex(err => err.id === errorId)
    if (index > -1) {
      stateErrors.value.splice(index, 1)
    }
  }

  const clearAllErrors = () => {
    stateErrors.value = []
  }

  // Notification system
  const addNotification = (message, type = 'info', options = {}) => {
    const notification = {
      id: ++notificationId.value,
      message,
      type, // 'info', 'success', 'warning', 'error'
      read: false,
      timestamp: new Date(),
      autoRemove: options.autoRemove !== false,
      timeout: options.timeout || 5000,
      action: options.action || null,
      persistent: options.persistent || false
    }
    
    notifications.value.push(notification)
    
    // Auto-remove notification if not persistent
    if (notification.autoRemove && !notification.persistent) {
      setTimeout(() => {
        removeNotification(notification.id)
      }, notification.timeout)
    }
    
    return notification.id
  }

  const removeNotification = (notificationId) => {
    const index = notifications.value.findIndex(n => n.id === notificationId)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const markNotificationAsRead = (notificationId) => {
    const notification = notifications.value.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
    }
  }

  const clearAllNotifications = () => {
    notifications.value = []
  }

  // Loading state management
  const setGlobalLoading = (loading, message = '') => {
    globalLoading.value = loading
    if (loading && message) {
      loadingMessages.value.push(message)
    } else if (!loading) {
      loadingMessages.value = []
    }
  }

  const addLoadingMessage = (message) => {
    if (!loadingMessages.value.includes(message)) {
      loadingMessages.value.push(message)
    }
  }

  const removeLoadingMessage = (message) => {
    const index = loadingMessages.value.indexOf(message)
    if (index > -1) {
      loadingMessages.value.splice(index, 1)
    }
  }

  // Modal management
  const openModal = (modalType, data = null) => {
    activeModal.value = modalType
    modalData.value = data
  }

  const closeModal = () => {
    activeModal.value = null
    modalData.value = null
  }

  // Theme management
  const toggleDarkMode = () => {
    darkMode.value = !darkMode.value
  }

  const setDarkMode = (enabled) => {
    darkMode.value = enabled
  }

  const toggleCompactMode = () => {
    compactMode.value = !compactMode.value
  }

  const setCompactMode = (enabled) => {
    compactMode.value = enabled
  }

  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const setSidebarCollapsed = (collapsed) => {
    sidebarCollapsed.value = collapsed
  }

  // Last saved state management
  const updateLastSavedState = (state) => {
    lastSavedState.value = {
      ...state,
      timestamp: Date.now()
    }
  }

  const clearLastSavedState = () => {
    lastSavedState.value = null
  }

  // Utility functions
  const showSuccessNotification = (message, options = {}) => {
    return addNotification(message, 'success', options)
  }

  const showErrorNotification = (message, options = {}) => {
    return addNotification(message, 'error', { ...options, persistent: true })
  }

  const showWarningNotification = (message, options = {}) => {
    return addNotification(message, 'warning', options)
  }

  const showInfoNotification = (message, options = {}) => {
    return addNotification(message, 'info', options)
  }

  // Reset all UI state
  const resetUiState = () => {
    closeAllMenus()
    clearAllErrors()
    clearAllNotifications()
    closeModal()
    setGlobalLoading(false)
    setApplicationReady(false)
    setStateRestoring(false)
  }

  return {
    // State
    showSettingsMenu,
    showMobileMenu,
    showDebugInfo,
    applicationReady,
    isStateRestoring,
    stateErrors,
    lastSavedState,
    darkMode,
    compactMode,
    sidebarCollapsed,
    notifications,
    globalLoading,
    loadingMessages,
    activeModal,
    modalData,
    
    // Getters
    hasErrors,
    hasNotifications,
    unreadNotifications,
    criticalErrors,
    isAnyMenuOpen,
    
    // Actions
    toggleSettingsMenu,
    toggleMobileMenu,
    toggleDebugInfo,
    closeAllMenus,
    setApplicationReady,
    setStateRestoring,
    addStateError,
    removeStateError,
    clearAllErrors,
    addNotification,
    removeNotification,
    markNotificationAsRead,
    clearAllNotifications,
    setGlobalLoading,
    addLoadingMessage,
    removeLoadingMessage,
    openModal,
    closeModal,
    toggleDarkMode,
    setDarkMode,
    toggleCompactMode,
    setCompactMode,
    toggleSidebar,
    setSidebarCollapsed,
    updateLastSavedState,
    clearLastSavedState,
    showSuccessNotification,
    showErrorNotification,
    showWarningNotification,
    showInfoNotification,
    resetUiState
  }
}, {
  persist: {
    key: 'vllm-calculator-ui-store',
    paths: ['darkMode', 'compactMode', 'sidebarCollapsed', 'showDebugInfo']
  }
})
