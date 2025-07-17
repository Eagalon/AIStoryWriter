// Story Display module
class StoryDisplay {
  constructor() {
    this.content = ''
    this.isGenerating = false
    this.showStats = false
    this.metadata = null
  }

  init() {
    this.bindEvents()
    this.render()
  }

  bindEvents() {
    const clearBtn = document.getElementById('clearBtn')
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clear()
      })
    }
  }

  render() {
    const container = document.getElementById('storyDisplay')
    if (!container) return

    container.innerHTML = `
            <div class="story-display">
                ${this.renderHeader()}
                ${this.showStats ? this.renderStats() : ''}
                ${this.renderContent()}
                ${this.renderFooter()}
            </div>
        `

    this.bindDisplayEvents()
  }

  renderHeader() {
    return `
            <div class="story-header">
                <div class="story-header-left">
                    <i data-lucide="type"></i>
                    <h2>Story</h2>
                    ${
                      this.isGenerating
                        ? `
                        <div class="story-status">
                            <div class="status-dot"></div>
                            <span>Generating...</span>
                        </div>
                    `
                        : ''
                    }
                </div>
                
                <div class="story-actions">
                    <button id="statsBtn" class="btn btn-outline" title="Show statistics">
                        <i data-lucide="bar-chart-3"></i>
                    </button>
                    
                    ${
                      this.content
                        ? `
                        <button id="copyBtn" class="btn btn-outline" title="Copy to clipboard">
                            <i data-lucide="copy"></i>
                        </button>
                        
                        <button id="downloadBtn" class="btn btn-outline" title="Download as text file">
                            <i data-lucide="download"></i>
                        </button>
                    `
                        : ''
                    }
                </div>
            </div>
        `
  }

  renderStats() {
    if (!this.content) return ''

    const wordCount = this.getWordCount()
    const charCount = this.getCharacterCount()
    const readingTime = Math.ceil(wordCount / 200) // 200 words per minute

    return `
            <div class="story-stats">
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${wordCount}</div>
                        <div class="stat-label">Words</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${charCount}</div>
                        <div class="stat-label">Characters</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${readingTime}</div>
                        <div class="stat-label">Min read</div>
                    </div>
                </div>
                
                ${
                  this.metadata
                    ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                        <span>Model: ${this.metadata.modelUsed}</span>
                        ${
                          this.metadata.generationTime
                            ? `<span>Generated in ${this.metadata.generationTime.toFixed(
                                1
                              )}s</span>`
                            : ''
                        }
                    </div>
                `
                    : ''
                }
            </div>
        `
  }

  renderContent() {
    if (!this.content && !this.isGenerating) {
      return `
                <div class="story-content">
                    <div class="story-empty">
                        <div class="story-empty-content">
                            <i data-lucide="type"></i>
                            <p>Your generated story will appear here</p>
                            <p style="font-size: 0.875rem; margin-top: 0.5rem;">Enter a prompt and click "Generate Story" to begin</p>
                        </div>
                    </div>
                </div>
            `
    }

    return `
            <div class="story-content" id="storyContentArea">
                <div class="story-text">
                    ${this.parseContentWithThinking(this.content)}${
      this.isGenerating ? '<span class="story-cursor"></span>' : ''
    }
                </div>
            </div>
        `
  }

  renderFooter() {
    if (!this.content || this.isGenerating) return ''

    return `
            <div class="story-footer">
                <button id="continueStoryBtn" class="btn btn-secondary" style="width: 100%;">
                    <i data-lucide="plus"></i>
                    <span>Continue Story</span>
                </button>
            </div>
        `
  }

  bindDisplayEvents() {
    // Re-render lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }

    // Stats toggle
    const statsBtn = document.getElementById('statsBtn')
    if (statsBtn) {
      statsBtn.addEventListener('click', () => {
        this.showStats = !this.showStats
        this.render()
      })
    }

    // Copy button with locking
    const copyBtn = document.getElementById('copyBtn')
    if (copyBtn) {
      const wrappedCopy = window.buttonLock.wrapAsync(
        copyBtn,
        this.copyToClipboard.bind(this),
        {
          lockText: 'Copied!',
          lockIcon: 'check',
          minDuration: 1500,
          showSpinner: false,
        }
      )
      copyBtn.addEventListener('click', wrappedCopy)
    }

    // Download button with locking
    const downloadBtn = document.getElementById('downloadBtn')
    if (downloadBtn) {
      const wrappedDownload = window.buttonLock.wrapAsync(
        downloadBtn,
        this.downloadAsText.bind(this),
        {
          lockText: 'Downloaded!',
          lockIcon: 'check',
          minDuration: 1500,
          showSpinner: false,
        }
      )
      downloadBtn.addEventListener('click', wrappedDownload)
    }

    // Continue story button
    const continueBtn = document.getElementById('continueStoryBtn')
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        // Focus on the prompt textarea for continuing
        const promptTextarea = document.getElementById('promptTextarea')
        if (promptTextarea) {
          promptTextarea.focus()
          promptTextarea.placeholder = 'How should the story continue?'
        }
      })
    }
  }

  startGeneration() {
    this.isGenerating = true
    this.render()
    this.updateClearButton()
    this.notifyChange()
  }

  addContent(chunk) {
    this.content += chunk

    // Update content in real-time without full re-render
    const contentArea = document.querySelector('.story-text')
    if (contentArea) {
      contentArea.innerHTML =
        this.parseContentWithThinking(this.content) +
        '<span class="story-cursor"></span>'

      // Auto-scroll to bottom
      const storyContent = document.getElementById('storyContentArea')
      if (storyContent) {
        storyContent.scrollTop = storyContent.scrollHeight
      }

      // Re-initialize Lucide icons for new thinking blocks
      if (window.lucide) {
        window.lucide.createIcons()
      }
    }

    this.notifyChange()
  }

  completeGeneration(metadata = null) {
    this.isGenerating = false
    this.metadata = metadata
    this.render()
    this.updateClearButton()
    this.notifyChange()
  }

  showError(errorMessage) {
    this.content += `\n\n${errorMessage}`
    this.isGenerating = false
    this.render()
    this.updateClearButton()
    this.notifyChange()
  }

  clear() {
    this.content = ''
    this.isGenerating = false
    this.showStats = false
    this.metadata = null
    this.render()
    this.updateClearButton()
    this.notifyChange()

    // Reset prompt placeholder
    const promptTextarea = document.getElementById('promptTextarea')
    if (promptTextarea) {
      promptTextarea.placeholder = 'Describe the story you want to create...'
    }
  }

  updateClearButton() {
    const clearBtn = document.getElementById('clearBtn')
    if (clearBtn) {
      clearBtn.style.display = this.content ? 'inline-flex' : 'none'
      clearBtn.disabled = this.isGenerating
    }
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.content)
      // Could show a toast notification here
      console.log('Story copied to clipboard')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  downloadAsText() {
    const blob = new Blob([this.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `story-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  getWordCount() {
    return this.content.trim() ? this.content.trim().split(/\s+/).length : 0
  }

  getCharacterCount() {
    return this.content.length
  }

  getCurrentStory() {
    return this.content
  }

  hasContent() {
    return this.content.length > 0
  }

  notifyChange() {
    window.dispatchEvent(
      new CustomEvent('storyChanged', {
        detail: {
          content: this.content,
          isGenerating: this.isGenerating,
          wordCount: this.getWordCount(),
          characterCount: this.getCharacterCount(),
        },
      })
    )
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  parseContentWithThinking(text) {
    // Parse content and handle thinking tags specially
    if (!text) return ''

    // Split content by thinking tags (both <thinking> and <think>)
    const parts = text.split(
      /(<(?:thinking|think)>[\s\S]*?<\/(?:thinking|think)>)/gi
    )
    let result = ''
    let thinkingCounter = 0

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]

      if (part.match(/^<(?:thinking|think)>[\s\S]*?<\/(?:thinking|think)>$/i)) {
        // This is a thinking block
        thinkingCounter++
        const thinkingContent = part
          .replace(/^<(?:thinking|think)>([\s\S]*?)<\/(?:thinking|think)>$/i, '$1')
          .trim()
        const thinkingId = `thinking-${Date.now()}-${thinkingCounter}`

        result += `
          <div class="thinking-block">
            <div class="thinking-header" onclick="this.parentElement.classList.toggle('expanded')">
              <i data-lucide="brain"></i>
              <span>Internal Reasoning</span>
              <i data-lucide="chevron-down" class="thinking-chevron"></i>
            </div>
            <div class="thinking-content">
              <div class="thinking-text">${this.escapeHtml(
                thinkingContent
              )}</div>
            </div>
          </div>
        `
      } else if (part.trim()) {
        // This is regular content
        result += `<div class="story-paragraph">${this.escapeHtml(part)}</div>`
      }
    }

    return result
  }
}

// Create global story display instance
window.storyDisplay = new StoryDisplay()
