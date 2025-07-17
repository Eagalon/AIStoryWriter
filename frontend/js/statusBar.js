class StatusBar {
  constructor() {
    this.statusBar = document.getElementById('statusBar')
    this.statusBarText = document.getElementById('statusBarText')
    this.statusBarClose = document.getElementById('statusBarClose')
    
    this.bindEvents()
  }

  bindEvents() {
    if (this.statusBarClose) {
      this.statusBarClose.addEventListener('click', () => {
        this.hide()
      })
    }
  }

  show(message = 'Processing...') {
    if (this.statusBarText) {
      this.statusBarText.textContent = message
    }
    
    if (this.statusBar) {
      this.statusBar.classList.add('active')
    }

    // Add padding to main content
    const main = document.querySelector('.main')
    if (main) {
      main.classList.add('status-bar-visible')
    }
  }

  hide() {
    if (this.statusBar) {
      this.statusBar.classList.remove('active')
    }

    // Remove padding from main content
    const main = document.querySelector('.main')
    if (main) {
      main.classList.remove('status-bar-visible')
    }
  }

  updateMessage(message) {
    if (this.statusBarText) {
      this.statusBarText.textContent = message
    }
  }
}

// Global instance
window.statusBar = new StatusBar() 