// Story Generator module
class StoryGenerator {
  constructor() {
    this.isGenerating = false
    this.suggestions = []
    this.showSuggestions = false
  }

  async init() {
    this.bindEvents()
    await this.loadSuggestions()
  }

  bindEvents() {
    const promptTextarea = document.getElementById('promptTextarea')
    const generateBtn = document.getElementById('generateBtn')
    const continueBtn = document.getElementById('continueBtn')
    const suggestionsBtn = document.getElementById('suggestionsBtn')

    if (promptTextarea) {
      promptTextarea.addEventListener('input', () => {
        this.updatePromptInfo()
        this.updateButtonStates()
      })
    }

    if (generateBtn) {
      // Wrap with button locking
      const wrappedGenerate = window.buttonLock.wrapAsync(
        generateBtn,
        () => this.handleGenerate(false),
        {
          lockText: 'Generating...',
          lockIcon: 'loader-2',
          minDuration: 2000,
        }
      )
      generateBtn.addEventListener('click', wrappedGenerate)
    }

    if (continueBtn) {
      // Wrap with button locking
      const wrappedContinue = window.buttonLock.wrapAsync(
        continueBtn,
        () => this.handleGenerate(true),
        {
          lockText: 'Continuing...',
          lockIcon: 'loader-2',
          minDuration: 2000,
        }
      )
      continueBtn.addEventListener('click', wrappedContinue)
    }

    if (suggestionsBtn) {
      suggestionsBtn.addEventListener('click', () => {
        this.toggleSuggestions()
      })
    }

    // Listen for story content changes to show/hide continue button
    window.addEventListener('storyChanged', () => {
      this.updateButtonStates()
    })
  }

  async loadSuggestions() {
    try {
      const response = await window.api.getPromptSuggestions()
      this.suggestions = response.suggestions || []
    } catch (error) {
      console.error('Failed to load suggestions:', error)
      this.suggestions = []
    }
  }

  toggleSuggestions() {
    this.showSuggestions = !this.showSuggestions
    const panel = document.getElementById('suggestionsPanel')

    if (this.showSuggestions) {
      this.renderSuggestions()
      panel.style.display = 'block'
      panel.classList.add('fade-in')
    } else {
      panel.style.display = 'none'
    }
  }

  renderSuggestions() {
    const list = document.getElementById('suggestionsList')
    if (!list) return

    list.innerHTML = this.suggestions
      .map(
        (suggestion) => `
            <button class="suggestion-item" data-suggestion="${this.escapeHtml(
              suggestion
            )}">
                ${this.escapeHtml(suggestion)}
            </button>
        `
      )
      .join('')

    // Bind suggestion click events
    list.querySelectorAll('.suggestion-item').forEach((item) => {
      item.addEventListener('click', () => {
        this.useSuggestion(item.dataset.suggestion)
      })
    })
  }

  useSuggestion(suggestion) {
    const promptTextarea = document.getElementById('promptTextarea')
    if (promptTextarea) {
      promptTextarea.value = suggestion
      this.updatePromptInfo()
      this.updateButtonStates()
    }
    this.toggleSuggestions()
  }

  updatePromptInfo() {
    const promptTextarea = document.getElementById('promptTextarea')
    const promptInfo = document.getElementById('promptInfo')

    if (promptTextarea && promptInfo) {
      const length = promptTextarea.value.length
      if (length > 0) {
        promptInfo.textContent = `Prompt length: ${length} characters`
        promptInfo.style.display = 'block'
      } else {
        promptInfo.style.display = 'none'
      }
    }
  }

  updateButtonStates() {
    const promptTextarea = document.getElementById('promptTextarea')
    const generateBtn = document.getElementById('generateBtn')
    const continueBtn = document.getElementById('continueBtn')

    const hasPrompt = promptTextarea && promptTextarea.value.trim().length > 0
    const hasStory = window.storyDisplay && window.storyDisplay.hasContent()

    if (generateBtn) {
      // Don't disable if button is locked - let ButtonLock handle it
      if (!window.buttonLock.isLocked(generateBtn)) {
        generateBtn.disabled = !hasPrompt || this.isGenerating
      }
    }

    if (continueBtn) {
      continueBtn.style.display = hasStory ? 'inline-flex' : 'none'
      // Don't disable if button is locked - let ButtonLock handle it
      if (!window.buttonLock.isLocked(continueBtn)) {
        continueBtn.disabled = !hasPrompt || this.isGenerating
      }
    }
  }

  async handleGenerate(continueStory = false) {
    const promptTextarea = document.getElementById('promptTextarea')
    if (!promptTextarea || !promptTextarea.value.trim()) return

    const prompt = promptTextarea.value.trim()
    const settings = window.settingsPanel.getSettings()

    const requestData = {
      prompt: prompt,
      model: settings.model || undefined,
      temperature: settings.temperature,
      top_p: settings.topP,
      system_prompt: settings.systemPrompt || undefined,
      continue_story:
        continueStory && window.storyDisplay
          ? window.storyDisplay.getCurrentStory()
          : undefined,
    }

    this.setGenerating(true)

    try {
      // Start the story generation
      window.storyDisplay.startGeneration()

      // Stream the generation
      for await (const chunk of window.api.generateStoryStream(requestData)) {
        if (chunk.content) {
          window.storyDisplay.addContent(chunk.content)
        }
        if (chunk.isComplete) {
          window.storyDisplay.completeGeneration({
            modelUsed: settings.model,
            wordCount: window.storyDisplay.getWordCount(),
            characterCount: window.storyDisplay.getCharacterCount(),
          })
          break
        }
      }
    } catch (error) {
      console.error('Generation failed:', error)
      window.storyDisplay.showError(`Error: ${error.message}`)
    } finally {
      this.setGenerating(false)
    }
  }

  setGenerating(generating) {
    this.isGenerating = generating
    const generateBtn = document.getElementById('generateBtn')

    if (generateBtn) {
      const icon = generateBtn.querySelector('i')
      const text = generateBtn.querySelector('span')

      if (generating) {
        if (icon) icon.setAttribute('data-lucide', 'loader-2')
        if (text) text.textContent = 'Generating...'
        generateBtn.classList.add('generating')
        window.statusBar.show('Generating story...')
      } else {
        if (icon) icon.setAttribute('data-lucide', 'send')
        if (text) text.textContent = 'Generate Story'
        generateBtn.classList.remove('generating')
        window.statusBar.hide()
      }

      // Re-render lucide icons
      if (window.lucide) {
        window.lucide.createIcons()
      }
    }

    this.updateButtonStates()
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// Create global story generator instance
window.storyGenerator = new StoryGenerator()
