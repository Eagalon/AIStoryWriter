// Main application module
class App {
  constructor() {
    this.isInitialized = false
  }

  async init() {
    if (this.isInitialized) return

    try {
      console.log('🚀 Initializing AI Story Writer...')

      // Show loading overlay
      this.showLoading('Connecting to Ollama...')

      // Check backend health
      await this.checkBackendHealth()

      // Initialize all modules
      await this.initializeModules()

      // Initialize Lucide icons
      this.initializeIcons()

      // Hide loading overlay
      this.hideLoading()

      console.log('✅ AI Story Writer initialized successfully')
      this.isInitialized = true
    } catch (error) {
      console.error('❌ Failed to initialize application:', error)
      this.showError(
        'Failed to connect to the backend. Please ensure the server is running.'
      )
    }
  }

  async checkBackendHealth() {
    try {
      const health = await window.api.checkHealth()
      console.log('Backend health:', health)

      if (!health.ollama_connected) {
        console.warn('⚠️ Ollama is not connected')
        this.showWarning(
          'Ollama is not connected. Please ensure Ollama is running.'
        )
      }
    } catch (error) {
      throw new Error('Backend is not responding')
    }
  }

  async initializeModules() {
    // Initialize API client
    window.api = new APIClient()

    // Initialize settings panel
    window.settingsPanel = new SettingsPanel()
    await window.settingsPanel.init()

    // Initialize story display
    window.storyDisplay = new StoryDisplay()

    // Initialize story generator
    window.storyGenerator = new StoryGenerator()

    // Initialize story workflow
    window.storyWorkflow = new StoryWorkflow()

    // Initialize status bar
    window.statusBar = new StatusBar()

    // Bind all events
    window.storyGenerator.bindEvents()
    window.storyWorkflow.bindEvents()

    // Initial render
    window.storyDisplay.render()
    window.storyWorkflow.init()
  }

  initializeIcons() {
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }

  showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay')
    const text = document.getElementById('loadingText')
    if (overlay && text) {
      text.textContent = message
      overlay.style.display = 'flex'
    }
  }

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay')
    if (overlay) {
      overlay.style.display = 'none'
    }
  }

  showError(message) {
    this.hideLoading()
    console.error('Application Error:', message)

    // Show error in UI
    const container = document.querySelector('.container')
    if (container) {
      container.innerHTML = `
        <div class="error-container">
          <div class="error-content">
            <i data-lucide="alert-circle"></i>
            <h2>Connection Error</h2>
            <p>${message}</p>
            <button onclick="location.reload()" class="btn btn-primary">
              <i data-lucide="refresh-cw"></i>
              Try Again
            </button>
          </div>
        </div>
      `
      this.initializeIcons()
    }
  }

  showWarning(message) {
    console.warn('Application Warning:', message)
    // Could add a toast notification here
  }
}

// Button locking utility to prevent double-execution
class ButtonLock {
  constructor() {
    this.lockedButtons = new Map() // button -> lock info
    this.minLockDuration = 1000 // Minimum lock duration (1 second)
  }

  /**
   * Lock a button for a specified duration or until manually unlocked
   * @param {HTMLElement|string} buttonOrId - Button element or ID
   * @param {Object} options - Lock options
   * @param {number} options.minDuration - Minimum lock duration in ms (default: 1000)
   * @param {string} options.lockText - Text to show while locked
   * @param {string} options.lockIcon - Lucide icon to show while locked
   * @param {boolean} options.showSpinner - Whether to show spinning animation
   */
  lock(buttonOrId, options = {}) {
    const button =
      typeof buttonOrId === 'string'
        ? document.getElementById(buttonOrId)
        : buttonOrId

    if (!button || button.disabled) return

    const {
      minDuration = this.minLockDuration,
      lockText = 'Processing...',
      lockIcon = 'loader-2',
      showSpinner = true,
    } = options

    // Store original state
    const originalState = {
      disabled: button.disabled,
      innerHTML: button.innerHTML,
      textContent: button.textContent,
      className: button.className,
      startTime: Date.now(),
      minDuration,
    }

    this.lockedButtons.set(button, originalState)

    // Apply locked state
    button.disabled = true
    button.classList.add('locked', 'generating')

    // Update button content
    const icon = button.querySelector('i')
    const textSpan = button.querySelector('span')

    if (icon && lockIcon) {
      icon.setAttribute('data-lucide', lockIcon)
      if (showSpinner) {
        icon.classList.add('animate-spin')
      }
    }

    if (textSpan) {
      textSpan.textContent = lockText
    } else if (!icon) {
      // If no icon or span, replace entire content
      button.innerHTML = `<i data-lucide="${lockIcon}" class="${
        showSpinner ? 'animate-spin' : ''
      }"></i> ${lockText}`
    }

    // Re-render lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }

    console.log(`🔒 Locked button: ${button.id || button.textContent}`)
  }

  /**
   * Unlock a button, respecting minimum lock duration
   * @param {HTMLElement|string} buttonOrId - Button element or ID
   * @param {boolean} force - Force unlock ignoring minimum duration
   */
  unlock(buttonOrId, force = false) {
    const button =
      typeof buttonOrId === 'string'
        ? document.getElementById(buttonOrId)
        : buttonOrId

    if (!button || !this.lockedButtons.has(button)) return

    const lockInfo = this.lockedButtons.get(button)
    const elapsedTime = Date.now() - lockInfo.startTime
    const remainingTime = Math.max(0, lockInfo.minDuration - elapsedTime)

    if (!force && remainingTime > 0) {
      // Wait for minimum duration before unlocking
      setTimeout(() => this.unlock(button, true), remainingTime)
      return
    }

    // Restore original state
    button.disabled = lockInfo.disabled
    button.innerHTML = lockInfo.innerHTML
    button.className = lockInfo.className

    // Remove from locked buttons
    this.lockedButtons.delete(button)

    // Re-render lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }

    console.log(`🔓 Unlocked button: ${button.id || button.textContent}`)
  }

  /**
   * Check if a button is currently locked
   * @param {HTMLElement|string} buttonOrId
   * @returns {boolean}
   */
  isLocked(buttonOrId) {
    const button =
      typeof buttonOrId === 'string'
        ? document.getElementById(buttonOrId)
        : buttonOrId
    return button ? this.lockedButtons.has(button) : false
  }

  /**
   * Unlock all locked buttons
   * @param {boolean} force - Force unlock ignoring minimum duration
   */
  unlockAll(force = false) {
    const buttonsToUnlock = Array.from(this.lockedButtons.keys())
    buttonsToUnlock.forEach((button) => this.unlock(button, force))
  }

  /**
   * Wrap an async function with automatic button locking
   * @param {HTMLElement|string} buttonOrId - Button to lock
   * @param {Function} asyncFn - Async function to execute
   * @param {Object} lockOptions - Lock options
   * @returns {Function} Wrapped function
   */
  wrapAsync(buttonOrId, asyncFn, lockOptions = {}) {
    return async (...args) => {
      const button =
        typeof buttonOrId === 'string'
          ? document.getElementById(buttonOrId)
          : buttonOrId

      if (!button || this.isLocked(button)) {
        console.warn('⚠️ Button is locked or not found, ignoring click')
        return
      }

      this.lock(button, lockOptions)

      try {
        return await asyncFn.apply(this, args)
      } finally {
        this.unlock(button)
      }
    }
  }
}

// Utility functions
class Utils {
  static formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString()
  }

  static formatWordCount(count) {
    if (count < 1000) return `${count} words`
    return `${(count / 1000).toFixed(1)}k words`
  }

  static copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(
      () => {
        console.log('Text copied to clipboard')
      },
      (err) => {
        console.error('Failed to copy text: ', err)
      }
    )
  }

  static downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  static truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  static debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }
}

// Global button lock instance
window.buttonLock = new ButtonLock()

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new App()
  window.app = app
  await app.init()
})

// Global keyboard shortcuts
document.addEventListener('keydown', (event) => {
  // Ctrl/Cmd + Enter to start workflow (if prompt is focused)
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    const promptTextarea = document.getElementById('promptTextarea')
    const startBtn = document.getElementById('startWorkflowBtn')

    if (
      document.activeElement === promptTextarea &&
      startBtn &&
      !startBtn.disabled
    ) {
      event.preventDefault()
      startBtn.click()
    }
  }

  // Escape to close modals/panels
  if (event.key === 'Escape') {
    // Close chapter modal if open
    const modal = document.querySelector('.chapter-modal')
    if (modal) {
      modal.remove()
      return
    }

    // Close suggestions panel
    const suggestionsPanel = document.getElementById('suggestionsPanel')
    if (suggestionsPanel && suggestionsPanel.style.display !== 'none') {
      suggestionsPanel.style.display = 'none'
      const suggestionsBtn = document.getElementById('suggestionsBtn')
      if (suggestionsBtn) {
        suggestionsBtn.classList.remove('active')
      }
      return
    }

    // Close settings sidebar
    const settingsSidebar = document.getElementById('settingsSidebar')
    if (settingsSidebar && !settingsSidebar.classList.contains('collapsed')) {
      settingsSidebar.classList.add('collapsed')
      if (window.settingsPanel) {
        window.settingsPanel.isVisible = false
      }
    }
  }
})

// Export for debugging
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { App, Utils, ButtonLock }
}
