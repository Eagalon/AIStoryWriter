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
    // Initialize all modules in the correct order
    // StatusBar is already initialized globally
    await window.settingsPanel.init()
    await window.storyWorkflow.init()

    console.log('📦 All modules initialized')
  }

  initializeIcons() {
    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
      console.log('🎨 Icons initialized')
    }
  }

  showLoading(message = 'Loading...') {
    if (window.statusBar) {
      window.statusBar.show(message)
    }
  }

  hideLoading() {
    if (window.statusBar) {
      window.statusBar.hide()
    }
  }

  showError(message) {
    this.hideLoading()
    // Create error message display
    const errorDiv = document.createElement('div')
    errorDiv.className = 'error-message'
    errorDiv.innerHTML = `
      <div class="error-content">
        <i data-lucide="alert-circle"></i>
        <h3>Connection Error</h3>
        <p>${message}</p>
        <button onclick="location.reload()" class="btn btn-primary">
          <i data-lucide="refresh-cw"></i>
          Retry
        </button>
      </div>
    `

    // Add to body
    document.body.appendChild(errorDiv)

    // Initialize icons for the error message
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }

  showWarning(message) {
    // Create warning notification
    const warningDiv = document.createElement('div')
    warningDiv.className = 'warning-notification'
    warningDiv.innerHTML = `
      <div class="warning-content">
        <i data-lucide="alert-triangle"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="close-warning">
          <i data-lucide="x"></i>
        </button>
      </div>
    `

    // Add to body
    document.body.appendChild(warningDiv)

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (warningDiv.parentElement) {
        warningDiv.remove()
      }
    }, 5000)

    // Initialize icons for the warning
    if (window.lucide) {
      window.lucide.createIcons()
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
  module.exports = { App, Utils }
}
