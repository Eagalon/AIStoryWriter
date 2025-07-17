// Settings Panel module
class SettingsPanel {
  constructor() {
    this.settings = {
      model: '',
      temperature: 0.7,
      topP: 0.9,
      systemPrompt: '',
      validationThreshold: 0.7,
    }
    this.availableModels = []
    this.isVisible = false
  }

  async init() {
    this.bindEvents()
    await this.loadModels()
    this.render()
  }

  bindEvents() {
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.toggle()
    })

    // Handle sidebar collapse toggle
    document
      .getElementById('settingsCollapseBtn')
      .addEventListener('click', (e) => {
        e.stopPropagation()
        this.toggleCollapse()
      })

    // Handle header click to toggle
    document.getElementById('settingsHeader').addEventListener('click', () => {
      this.toggle()
    })
  }

  async loadModels() {
    try {
      const response = await window.api.getModels()
      this.availableModels = response.models.map((m) => m.name)
      if (response.default_model && !this.settings.model) {
        this.settings.model = response.default_model
      }
    } catch (error) {
      console.error('Failed to load models:', error)
      this.availableModels = []
    }
  }

  toggle() {
    this.isVisible = !this.isVisible
    const sidebar = document.getElementById('settingsSidebar')

    if (this.isVisible) {
      sidebar.classList.remove('collapsed')
    } else {
      sidebar.classList.add('collapsed')
    }
  }

  toggleCollapse() {
    const sidebar = document.getElementById('settingsSidebar')
    sidebar.classList.toggle('collapsed')
    this.isVisible = !sidebar.classList.contains('collapsed')
  }

  updateSetting(key, value) {
    this.settings[key] = value
    this.notifyChange()
  }

  notifyChange() {
    // Notify other components of settings change
    window.dispatchEvent(
      new CustomEvent('settingsChanged', {
        detail: this.settings,
      })
    )
  }

  render() {
    const content = document.getElementById('settingsContent')
    if (!content) return

    content.innerHTML = `
            <div class="settings-content">
                <!-- Model Selection -->
                <div class="setting-group">
                    <label class="setting-label">Model</label>
                    <select id="modelSelect" class="select">
                        <option value="">Select a model...</option>
                        ${this.availableModels
                          .map(
                            (model) =>
                              `<option value="${model}" ${
                                model === this.settings.model ? 'selected' : ''
                              }>${model}</option>`
                          )
                          .join('')}
                    </select>
                    <div class="setting-description">Choose which Ollama model to use for generation</div>
                </div>

                <!-- Temperature -->
                <div class="setting-group">
                    <div class="slider-container">
                        <label class="setting-label">Temperature: ${
                          this.settings.temperature
                        }</label>
                        <input 
                            type="range" 
                            id="temperatureSlider"
                            class="slider" 
                            min="0" 
                            max="2" 
                            step="0.1" 
                            value="${this.settings.temperature}"
                        />
                        <div class="slider-labels">
                            <span>Conservative (0)</span>
                            <span>Creative (2)</span>
                        </div>
                        <div class="setting-description">
                            Controls randomness in the output. Higher values make output more creative but less focused.
                        </div>
                    </div>
                </div>

                <!-- Top P -->
                <div class="setting-group">
                    <div class="slider-container">
                        <label class="setting-label">Top P: ${
                          this.settings.topP
                        }</label>
                        <input 
                            type="range" 
                            id="topPSlider"
                            class="slider" 
                            min="0.1" 
                            max="1" 
                            step="0.1" 
                            value="${this.settings.topP}"
                        />
                        <div class="slider-labels">
                            <span>Focused (0.1)</span>
                            <span>Diverse (1.0)</span>
                        </div>
                        <div class="setting-description">
                            Controls diversity of word choice. Lower values make output more focused.
                        </div>
                    </div>
                </div>

                <!-- Validation Threshold -->
                <div class="setting-group">
                    <div class="slider-container">
                        <label class="setting-label">Validation Threshold: ${
                          this.settings.validationThreshold
                        }</label>
                        <input 
                            type="range" 
                            id="validationThresholdSlider"
                            class="slider" 
                            min="0.1" 
                            max="1.0" 
                            step="0.1" 
                            value="${this.settings.validationThreshold}"
                        />
                        <div class="slider-labels">
                            <span>Strict (0.1)</span>
                            <span>Lenient (1.0)</span>
                        </div>
                        <div class="setting-description">
                            Chapters scoring below this threshold will be automatically regenerated during bulk generation.
                        </div>
                    </div>
                </div>

                <!-- System Prompt -->
                <div class="setting-group">
                    <label class="setting-label">System Prompt</label>
                    <textarea 
                        id="systemPromptTextarea"
                        class="textarea" 
                        rows="3"
                        placeholder="Optional instructions for the AI (e.g., 'Write in the style of...')"
                    >${this.settings.systemPrompt}</textarea>
                    <div class="setting-description">
                        Provide specific instructions or context for how the AI should write
                    </div>
                </div>

                <!-- Quick Presets -->
                <div class="setting-group">
                    <label class="setting-label">Quick Presets</label>
                    <div class="presets-grid">
                        <button class="btn btn-outline preset-btn" data-preset="focused">
                            📝 Focused
                        </button>
                        <button class="btn btn-outline preset-btn" data-preset="balanced">
                            ✨ Balanced
                        </button>
                        <button class="btn btn-outline preset-btn" data-preset="creative">
                            🎨 Creative
                        </button>
                        <button class="btn btn-outline preset-btn" data-preset="dramatic">
                            🎭 Dramatic
                        </button>
                    </div>
                </div>
            </div>
        `

    this.bindSettingsEvents()
  }

  bindSettingsEvents() {
    // Model selection
    const modelSelect = document.getElementById('modelSelect')
    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        this.updateSetting('model', e.target.value)
      })
    }

    // Temperature slider
    const tempSlider = document.getElementById('temperatureSlider')
    if (tempSlider) {
      tempSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value)
        this.updateSetting('temperature', value)
        document.querySelector(
          '.setting-label'
        ).textContent = `Temperature: ${value}`
      })
    }

    // Top P slider
    const topPSlider = document.getElementById('topPSlider')
    if (topPSlider) {
      topPSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value)
        this.updateSetting('topP', value)
        const labels = document.querySelectorAll('.setting-label')
        if (labels[2]) labels[2].textContent = `Top P: ${value}`
      })
    }

    // Validation Threshold slider
    const validationThresholdSlider = document.getElementById('validationThresholdSlider')
    if (validationThresholdSlider) {
      validationThresholdSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value)
        this.updateSetting('validationThreshold', value)
        const labels = document.querySelectorAll('.setting-label')
        if (labels[3]) labels[3].textContent = `Validation Threshold: ${value}`
      })
    }

    // System prompt
    const systemPrompt = document.getElementById('systemPromptTextarea')
    if (systemPrompt) {
      systemPrompt.addEventListener('input', (e) => {
        this.updateSetting('systemPrompt', e.target.value)
      })
    }

    // Preset buttons
    const presetButtons = document.querySelectorAll('.preset-btn')
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset
        this.applyPreset(preset)
      })
    })
  }

  applyPreset(preset) {
    const presets = {
      focused: {
        temperature: 0.3,
        topP: 0.7,
        validationThreshold: 0.8,
        systemPrompt: 'Write a focused, coherent story with clear structure.',
      },
      balanced: {
        temperature: 0.7,
        topP: 0.9,
        validationThreshold: 0.7,
        systemPrompt:
          'Write an engaging, creative story with vivid descriptions.',
      },
      creative: {
        temperature: 1.2,
        topP: 0.95,
        validationThreshold: 0.6,
        systemPrompt:
          'Write a highly creative, imaginative story with unexpected elements.',
      },
      dramatic: {
        temperature: 0.8,
        topP: 0.9,
        validationThreshold: 0.7,
        systemPrompt:
          'Write a dramatic story with strong character development and emotional depth.',
      },
    }

    if (presets[preset]) {
      Object.assign(this.settings, presets[preset])
      this.render()
      this.notifyChange()
    }
  }

  getSettings() {
    return { ...this.settings }
  }
}

// Create global settings instance
window.settingsPanel = new SettingsPanel()
