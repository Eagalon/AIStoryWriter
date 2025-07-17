// Story Workflow module for multi-step story generation
class StoryWorkflow {
  constructor() {
    this.currentWorkflow = null
    this.isGenerating = false
    this.workflowSteps = [
      { id: 'prompt', name: 'Story Prompt', completed: false },
      {
        id: 'characters_settings',
        name: 'Characters & Settings',
        completed: false,
      },
      { id: 'outline', name: 'Story Outline', completed: false },
      {
        id: 'chapter_generation',
        name: 'Chapter Generation',
        completed: false,
      },
      { id: 'completed', name: 'Complete', completed: false },
    ]
  }

  async init() {
    this.bindEvents()
    this.renderProgressIndicator()
    this.updateBlockStates()
  }

  bindEvents() {
    // Start workflow button
    const startWorkflowBtn = document.getElementById('startWorkflowBtn')
    if (startWorkflowBtn) {
      console.log('✅ Found startWorkflowBtn, binding click event')

      // Wrap with button locking
      const wrappedStartWorkflow = window.buttonLock.wrapAsync(
        startWorkflowBtn,
        this.startWorkflow.bind(this),
        {
          lockText: 'Creating workflow...',
          lockIcon: 'loader-2',
          minDuration: 2000,
        }
      )

      startWorkflowBtn.addEventListener('click', () => {
        console.log('🖱️ Start workflow button clicked!')
        wrappedStartWorkflow()
      })
    } else {
      console.log('❌ startWorkflowBtn not found!')
    }

    // New story button
    const newStoryBtn = document.getElementById('newStoryBtn')
    if (newStoryBtn) {
      newStoryBtn.addEventListener('click', () => this.startNewStory())
    }

    // Suggestions button
    const suggestionsBtn = document.getElementById('suggestionsBtn')
    if (suggestionsBtn) {
      suggestionsBtn.addEventListener('click', () => this.toggleSuggestions())
    }
  }

  renderProgressIndicator() {
    const container = document.getElementById('stepProgressIndicator')
    if (!container) return

    const currentStep = this.getCurrentStepIndex()

    container.innerHTML = `
      <div class="progress-steps">
        ${this.workflowSteps
          .map(
            (step, index) => `
          <div class="progress-step ${this.getStepStatus(
            index,
            currentStep
          )}" data-step="${step.id}">
            <div class="step-number">${index + 1}</div>
            <div class="step-info">
              <div class="step-name">${step.name}</div>
              <div class="step-status">${this.getStepStatusText(
                index,
                currentStep
              )}</div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `

    // Re-initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }

  getCurrentStepIndex() {
    if (!this.currentWorkflow) return 0

    const stepMap = {
      characters_settings: 1,
      outline: 2,
      chapter_generation: 3,
      completed: 4,
    }

    return stepMap[this.currentWorkflow.current_step] || 0
  }

  getStepStatus(stepIndex, currentStepIndex) {
    if (stepIndex < currentStepIndex) return 'completed'
    if (stepIndex === currentStepIndex) return 'active'
    return 'pending'
  }

  getStepStatusText(stepIndex, currentStepIndex) {
    const status = this.getStepStatus(stepIndex, currentStepIndex)
    switch (status) {
      case 'completed':
        return 'Completed'
      case 'active':
        return 'In Progress'
      case 'pending':
        return 'Pending'
      default:
        return 'Pending'
    }
  }

  updateBlockStates() {
    const blocks = [
      'promptBlock',
      'charactersBlock',
      'outlineBlock',
      'chaptersBlock',
      'completeBlock',
    ]

    blocks.forEach((blockId, index) => {
      const block = document.getElementById(blockId)
      if (!block) return

      const currentStep = this.getCurrentStepIndex()

      if (index <= currentStep) {
        block.classList.remove('disabled')
        block.classList.add('active')
      } else {
        block.classList.add('disabled')
        block.classList.remove('active')
      }

      if (index < currentStep) {
        block.classList.add('completed')
      } else {
        block.classList.remove('completed')
      }
    })
  }

  updateBlockStatus(blockId, status, message) {
    const statusElement = document.getElementById(
      `${blockId.replace('Block', 'Status')}`
    )
    if (!statusElement) return

    const badge = statusElement.querySelector('.status-badge')
    if (badge) {
      badge.className = `status-badge ${status}`
      badge.textContent = message
    }
  }

  async toggleSuggestions() {
    const panel = document.getElementById('suggestionsPanel')
    const btn = document.getElementById('suggestionsBtn')

    if (!panel || !btn) return

    if (panel.style.display === 'none') {
      try {
        const response = await window.api.getPromptSuggestions()
        this.renderSuggestions(response.suggestions)
        panel.style.display = 'block'
        btn.classList.add('active')
      } catch (error) {
        console.error('Failed to load suggestions:', error)
      }
    } else {
      panel.style.display = 'none'
      btn.classList.remove('active')
    }
  }

  renderSuggestions(suggestions) {
    const container = document.getElementById('suggestionsList')
    if (!container) return

    container.innerHTML = suggestions
      .map(
        (suggestion) => `
      <button class="suggestion-item" data-suggestion="${suggestion}">
        ${suggestion}
      </button>
    `
      )
      .join('')

    // Bind suggestion click events
    container.querySelectorAll('.suggestion-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const suggestion = e.target.dataset.suggestion
        document.getElementById('promptTextarea').value = suggestion
        document.getElementById('suggestionsPanel').style.display = 'none'
        document.getElementById('suggestionsBtn').classList.remove('active')
      })
    })
  }

  async startWorkflow() {
    console.log('🔄 Starting workflow...')

    const promptTextarea = document.getElementById('promptTextarea')
    if (!promptTextarea || !promptTextarea.value.trim()) {
      console.log('❌ No prompt entered')
      alert('Please enter a story prompt first.')
      return
    }

    console.log('📝 Prompt:', promptTextarea.value.trim())

    try {
      this.setGenerating(true, 'Creating workflow...')
      console.log('🚀 About to call API...')

      const response = await window.api.createWorkflow({
        prompt: promptTextarea.value.trim(),
        model: window.settingsPanel?.settings?.model,
        temperature: window.settingsPanel?.settings?.temperature || 0.7,
        top_p: window.settingsPanel?.settings?.topP || 0.9,
      })

      console.log('✅ API response:', response)
      this.currentWorkflow = response.workflow

      // Update prompt block status
      this.updateBlockStatus('promptBlock', 'completed', 'Prompt set')

      // Move to characters generation
      await this.generateCharactersSettings()
    } catch (error) {
      console.error('❌ Failed to start workflow:', error)
      alert('Failed to start workflow. Please try again.')
    } finally {
      this.setGenerating(false)
    }
  }

  async generateCharactersSettings() {
    console.log('👥 Starting character and settings generation...')

    if (!this.currentWorkflow) {
      console.log('❌ No current workflow found')
      return
    }

    try {
      this.setGenerating(true, 'Generating characters and settings...')
      this.updateBlockStatus('charactersBlock', 'active', 'Generating...')

      console.log('🚀 About to call generateCharactersSettings API...')
      console.log('Workflow ID:', this.currentWorkflow.id)

      const response = await window.api.generateCharactersSettings(
        this.currentWorkflow.id,
        {}
      )

      console.log('✅ Characters & Settings API response:', response)
      this.currentWorkflow = response.workflow
      this.renderCharactersBlock()
      this.renderProgressIndicator()
      this.updateBlockStates()
    } catch (error) {
      console.error('❌ Failed to generate characters/settings:', error)
      this.updateBlockStatus('charactersBlock', 'error', 'Generation failed')
      alert('Failed to generate characters and settings. Please try again.')
    } finally {
      this.setGenerating(false)
    }
  }

  renderCharactersBlock() {
    const content = document.getElementById('charactersContent')
    if (!content || !this.currentWorkflow) return

    this.updateBlockStatus(
      'charactersBlock',
      'editing',
      'Review and edit content'
    )

    content.innerHTML = `
      <div class="characters-edit-section">
        <div class="characters-section">
          <h4><i data-lucide="users"></i> Characters</h4>
          <div class="characters-edit-list">
            ${this.currentWorkflow.characters
              .map(
                (char, index) => `
              <div class="character-edit-card">
                <div class="character-edit-header">
                  <input 
                    type="text" 
                    class="character-name-input" 
                    value="${char.name}" 
                    data-character-index="${index}"
                    placeholder="Character name"
                  >
                  <select 
                    class="character-role-select" 
                    data-character-index="${index}"
                  >
                    <option value="protagonist" ${
                      char.role === 'protagonist' ? 'selected' : ''
                    }>Protagonist</option>
                    <option value="antagonist" ${
                      char.role === 'antagonist' ? 'selected' : ''
                    }>Antagonist</option>
                    <option value="supporting" ${
                      char.role === 'supporting' ? 'selected' : ''
                    }>Supporting</option>
                    <option value="mentor" ${
                      char.role === 'mentor' ? 'selected' : ''
                    }>Mentor</option>
                    <option value="love_interest" ${
                      char.role === 'love_interest' ? 'selected' : ''
                    }>Love Interest</option>
                  </select>
                </div>
                
                <div class="character-edit-fields">
                  <div class="form-group">
                    <label>Description & Traits:</label>
                    <textarea 
                      class="character-description-input textarea" 
                      data-character-index="${index}"
                      rows="3"
                      placeholder="Character description and personality traits..."
                    >${char.description}</textarea>
                  </div>
                  
                  <div class="form-group">
                    <label>Background & History:</label>
                    <textarea 
                      class="character-background-input textarea" 
                      data-character-index="${index}"
                      rows="2"
                      placeholder="Character's background and history..."
                    >${char.background || ''}</textarea>
                  </div>
                  
                  <div class="form-group">
                    <label>Goals & Motivations:</label>
                    <textarea 
                      class="character-motivations-input textarea" 
                      data-character-index="${index}"
                      rows="2"
                      placeholder="What drives this character..."
                    >${char.motivations || ''}</textarea>
                  </div>
                </div>
                
                <button class="btn btn-sm btn-danger remove-character-btn" data-character-index="${index}">
                  <i data-lucide="trash-2"></i>
                  Remove Character
                </button>
              </div>
            `
              )
              .join('')}
          </div>
          
          <button id="addCharacterBtn" class="btn btn-outline">
            <i data-lucide="user-plus"></i>
            Add Character
          </button>
        </div>

        <div class="settings-section">
          <h4><i data-lucide="map"></i> Story Settings</h4>
          <div class="settings-edit-form">
            <div class="form-row">
              <div class="form-group">
                <label for="genreInput">Genre:</label>
                <input 
                  type="text" 
                  id="genreInput" 
                  class="form-input" 
                  value="${this.currentWorkflow.settings.genre}"
                  placeholder="e.g., Fantasy, Science Fiction, Mystery..."
                >
              </div>
              
              <div class="form-group">
                <label for="toneInput">Tone:</label>
                <input 
                  type="text" 
                  id="toneInput" 
                  class="form-input" 
                  value="${this.currentWorkflow.settings.tone}"
                  placeholder="e.g., Dark, Humorous, Dramatic..."
                >
              </div>
            </div>
            
            <div class="form-group">
              <label for="settingInput">Setting (Time & Place):</label>
              <textarea 
                id="settingInput" 
                class="textarea" 
                rows="2"
                placeholder="When and where does the story take place..."
              >${this.currentWorkflow.settings.setting}</textarea>
            </div>
            
            <div class="form-group">
              <label for="themesInput">Themes (comma-separated):</label>
              <input 
                type="text" 
                id="themesInput" 
                class="form-input" 
                value="${this.currentWorkflow.settings.themes.join(', ')}"
                placeholder="e.g., Love, Betrayal, Redemption, Power..."
              >
            </div>
            
            <div class="form-group">
              <label for="worldBuildingInput">World Building Details:</label>
              <textarea 
                id="worldBuildingInput" 
                class="textarea" 
                rows="3"
                placeholder="Additional world details, rules, magic systems, technology..."
              >${this.currentWorkflow.settings.world_building || ''}</textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="targetLengthSelect">Target Length:</label>
                <select id="targetLengthSelect" class="form-input">
                  <option value="short" ${
                    this.currentWorkflow.settings.target_length === 'short'
                      ? 'selected'
                      : ''
                  }>Short (1-3 chapters)</option>
                  <option value="medium" ${
                    this.currentWorkflow.settings.target_length === 'medium'
                      ? 'selected'
                      : ''
                  }>Medium (4-8 chapters)</option>
                  <option value="long" ${
                    this.currentWorkflow.settings.target_length === 'long'
                      ? 'selected'
                      : ''
                  }>Long (9+ chapters)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="block-actions">
          <button id="saveAndProceedBtn" class="btn btn-primary">
            <i data-lucide="save"></i>
            Save Changes & Create Outline
          </button>
          
          <button id="regenerateCharactersBtn" class="btn btn-outline">
            <i data-lucide="refresh-cw"></i>
            Regenerate All
          </button>
        </div>
      </div>
    `

    this.bindCharactersEvents()

    // Re-initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }

  bindCharactersEvents() {
    const content = document.getElementById('charactersContent')
    if (!content) return

    // Save and proceed button
    const saveAndProceedBtn = content.querySelector('#saveAndProceedBtn')
    if (saveAndProceedBtn) {
      const wrappedSaveAndProceed = window.buttonLock.wrapAsync(
        saveAndProceedBtn,
        this.saveCharactersSettingsAndProceed.bind(this),
        {
          lockText: 'Saving...',
          lockIcon: 'save',
          minDuration: 1500,
        }
      )
      saveAndProceedBtn.addEventListener('click', wrappedSaveAndProceed)
    }

    // Regenerate button
    const regenerateBtn = content.querySelector('#regenerateCharactersBtn')
    if (regenerateBtn) {
      const wrappedRegenerate = window.buttonLock.wrapAsync(
        regenerateBtn,
        this.regenerateCharactersSettings.bind(this),
        {
          lockText: 'Regenerating...',
          lockIcon: 'refresh-cw',
          minDuration: 2000,
        }
      )
      regenerateBtn.addEventListener('click', wrappedRegenerate)
    }

    // Add character button
    const addCharacterBtn = content.querySelector('#addCharacterBtn')
    if (addCharacterBtn) {
      addCharacterBtn.addEventListener('click', () => this.addNewCharacter())
    }

    // Remove character buttons
    content.querySelectorAll('.remove-character-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const characterIndex = parseInt(
          e.target.closest('.remove-character-btn').dataset.characterIndex
        )
        this.removeCharacter(characterIndex)
      })
    })
  }

  collectEditedCharacters() {
    const content = document.getElementById('charactersContent')
    const characters = []

    content.querySelectorAll('.character-edit-card').forEach((card, index) => {
      const name = card.querySelector('.character-name-input').value.trim()
      const role = card.querySelector('.character-role-select').value
      const description = card
        .querySelector('.character-description-input')
        .value.trim()
      const background = card
        .querySelector('.character-background-input')
        .value.trim()
      const motivations = card
        .querySelector('.character-motivations-input')
        .value.trim()

      if (name && description) {
        characters.push({
          name,
          role,
          description,
          background: background || null,
          motivations: motivations || null,
          relationships: {},
        })
      }
    })

    return characters
  }

  collectEditedSettings() {
    const content = document.getElementById('charactersContent')

    const genre = content.querySelector('#genreInput').value.trim()
    const tone = content.querySelector('#toneInput').value.trim()
    const setting = content.querySelector('#settingInput').value.trim()
    const themesText = content.querySelector('#themesInput').value.trim()
    const worldBuilding = content
      .querySelector('#worldBuildingInput')
      .value.trim()
    const targetLength = content.querySelector('#targetLengthSelect').value

    const themes = themesText
      ? themesText
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t)
      : []

    return {
      genre,
      tone,
      setting,
      themes,
      world_building: worldBuilding || null,
      target_length: targetLength,
    }
  }

  addNewCharacter() {
    const newCharacter = {
      name: 'New Character',
      role: 'supporting',
      description: 'Character description...',
      background: '',
      motivations: '',
    }

    this.currentWorkflow.characters.push(newCharacter)
    this.renderCharactersBlock()
  }

  removeCharacter(characterIndex) {
    if (this.currentWorkflow.characters.length <= 1) {
      alert('You must have at least one character in your story.')
      return
    }

    this.currentWorkflow.characters.splice(characterIndex, 1)
    this.renderCharactersBlock()
  }

  async saveCharactersSettingsAndProceed() {
    try {
      const editedCharacters = this.collectEditedCharacters()
      const editedSettings = this.collectEditedSettings()

      if (editedCharacters.length === 0) {
        alert(
          'Please ensure you have at least one character with a name and description.'
        )
        return
      }

      if (
        !editedSettings.genre ||
        !editedSettings.setting ||
        !editedSettings.tone
      ) {
        alert('Please fill in the required settings: Genre, Setting, and Tone.')
        return
      }

      this.currentWorkflow.characters = editedCharacters
      this.currentWorkflow.settings = editedSettings
      this.currentWorkflow.current_step = 'outline'

      this.updateBlockStatus(
        'charactersBlock',
        'completed',
        'Characters & settings saved'
      )

      // Move to outline generation
      await this.generateOutline()
    } catch (error) {
      console.error('Failed to save characters and settings:', error)
      alert('Failed to save changes. Please try again.')
    }
  }

  async regenerateCharactersSettings() {
    if (
      !confirm(
        'This will regenerate all characters and settings, discarding your current edits. Continue?'
      )
    ) {
      return
    }

    await this.generateCharactersSettings()
  }

  async generateOutline() {
    if (!this.currentWorkflow) return

    try {
      this.setGenerating(true, 'Generating story outline...')
      this.updateBlockStatus('outlineBlock', 'active', 'Generating outline...')

      const response = await window.api.generateOutline(
        this.currentWorkflow.id,
        { target_chapters: 5 }
      )

      this.currentWorkflow = response.workflow
      this.renderOutlineBlock()
      this.renderProgressIndicator()
      this.updateBlockStates()
    } catch (error) {
      console.error('Failed to generate outline:', error)
      this.updateBlockStatus('outlineBlock', 'error', 'Generation failed')
      alert('Failed to generate outline. Please try again.')
    } finally {
      this.setGenerating(false)
    }
  }

  renderOutlineBlock() {
    const content = document.getElementById('outlineContent')
    if (!content || !this.currentWorkflow || !this.currentWorkflow.outline)
      return

    this.updateBlockStatus('outlineBlock', 'completed', 'Outline generated')

    const outline = this.currentWorkflow.outline

    content.innerHTML = `
      <div class="outline-section">
        <div class="story-info">
          <h4>${outline.title}</h4>
          <p class="premise">${outline.premise}</p>
          <p class="plot-structure">${outline.plot_structure}</p>
        </div>

        <div class="chapters-outline">
          <h5>Chapters (${outline.chapters.length})</h5>
          <div class="chapters-list">
            ${outline.chapters
              .map(
                (chapter) => `
              <div class="chapter-outline-card">
                <h6>Chapter ${chapter.chapter_number}: ${chapter.title}</h6>
                <p class="chapter-summary">${chapter.summary}</p>
                <div class="chapter-details">
                  <strong>Key Events:</strong> ${chapter.key_events.join(', ')}
                </div>
                <div class="chapter-details">
                  <strong>Characters:</strong> ${chapter.characters_involved.join(
                    ', '
                  )}
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="block-actions">
          <button id="startChapterGenerationBtn" class="btn btn-primary">
            <i data-lucide="book-open"></i>
            Start Generating Chapters
          </button>
          <button id="generateFullStoryBtn" class="btn btn-primary btn-success">
            <i data-lucide="zap"></i>
            Generate Full Story
          </button>
        </div>
      </div>
    `

    // Bind events with button locking
    const startBtn = content.querySelector('#startChapterGenerationBtn')
    if (startBtn) {
      const wrappedStartChapterGeneration = window.buttonLock.wrapAsync(
        startBtn,
        this.startChapterGeneration.bind(this),
        {
          lockText: 'Starting...',
          lockIcon: 'book-open',
          minDuration: 1500,
        }
      )
      startBtn.addEventListener('click', wrappedStartChapterGeneration)
    }

    const generateFullStoryBtn = content.querySelector('#generateFullStoryBtn')
    if (generateFullStoryBtn) {
      const wrappedGenerateFullStory = window.buttonLock.wrapAsync(
        generateFullStoryBtn,
        this.generateFullStory.bind(this),
        {
          lockText: 'Generating story...',
          lockIcon: 'zap',
          minDuration: 3000,
        }
      )
      generateFullStoryBtn.addEventListener('click', wrappedGenerateFullStory)
    }

    // Re-initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }

  async startChapterGeneration() {
    this.currentWorkflow.current_step = 'chapter_generation'
    this.renderChaptersBlock()
    this.renderProgressIndicator()
    this.updateBlockStates()
  }

  async generateFullStory() {
    if (!this.currentWorkflow || !this.currentWorkflow.outline) {
      alert('Story outline must be generated first.')
      return
    }

    if (
      !confirm(
        'This will generate all remaining chapters automatically. This may take several minutes. Continue?'
      )
    ) {
      return
    }

    try {
      this.setGenerating(true, 'Generating full story...')
      this.currentWorkflow.current_step = 'chapter_generation'
      this.renderChaptersBlockWithProgress()
      this.renderProgressIndicator()
      this.updateBlockStates()

      // Stream the generation process
      const settings = window.settingsPanel.getSettings()
      for await (const update of window.api.generateAllChaptersStream(
        this.currentWorkflow.id,
        {
          validation_threshold: settings.validationThreshold,
        }
      )) {
        this.handleBulkGenerationUpdate(update)
      }
    } catch (error) {
      console.error('Failed to generate full story:', error)
      alert('Failed to generate full story. Please try again.')
    } finally {
      this.setGenerating(false)
    }
  }

  renderChaptersBlock() {
    const content = document.getElementById('chaptersContent')
    if (!content || !this.currentWorkflow) return

    this.updateBlockStatus(
      'chaptersBlock',
      'active',
      'Generate chapters individually'
    )

    content.innerHTML = `
      <div class="chapters-generation-section">
        <div class="chapter-generation-progress">
          <div class="progress-info">
            Progress: ${this.currentWorkflow.chapters_completed} of ${
      this.currentWorkflow.total_chapters_planned
    } chapters
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${
              (this.currentWorkflow.chapters_completed /
                this.currentWorkflow.total_chapters_planned) *
              100
            }%"></div>
          </div>
        </div>

        <div class="chapters-status">
          ${this.currentWorkflow.outline.chapters
            .map((chapter) => {
              const generated = this.currentWorkflow.chapters.find(
                (ch) => ch.chapter_number === chapter.chapter_number
              )
              return `
              <div class="chapter-status-card ${
                generated ? 'completed' : 'pending'
              }">
                <div class="chapter-header">
                  <h6>Chapter ${chapter.chapter_number}: ${chapter.title}</h6>
                  <div class="chapter-actions">
                    ${
                      !generated
                        ? `
                      <button class="btn btn-sm btn-primary generate-chapter-btn" data-chapter="${chapter.chapter_number}">
                        <i data-lucide="play"></i>
                        Generate
                      </button>
                    `
                        : `
                      <span class="status-indicator completed">
                        <i data-lucide="check"></i>
                        Complete (${generated.word_count} words)
                      </span>
                      ${
                        generated.validation_score
                          ? `
                        <span class="validation-score">Score: ${(
                          generated.validation_score * 100
                        ).toFixed(0)}%</span>
                      `
                          : `
                        <button class="btn btn-sm btn-outline validate-chapter-btn" data-chapter="${chapter.chapter_number}">
                          <i data-lucide="check-circle"></i>
                          Validate
                        </button>
                      `
                      }
                    `
                    }
                  </div>
                </div>
                ${
                  generated
                    ? `
                  <div class="chapter-preview">
                    <p class="chapter-excerpt">${this.stripThinkingTags(
                      generated.content
                    ).substring(0, 200)}...</p>
                    <button class="btn btn-sm btn-outline view-chapter-btn" data-chapter="${
                      chapter.chapter_number
                    }">
                      View Full Chapter
                    </button>
                  </div>
                `
                    : ''
                }
              </div>
            `
            })
            .join('')}
        </div>
      </div>
    `

    this.bindChaptersEvents()

    // Re-initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }

  renderChaptersBlockWithProgress() {
    const content = document.getElementById('chaptersContent')
    if (!content || !this.currentWorkflow) return

    this.updateBlockStatus(
      'chaptersBlock',
      'active',
      'Generating all chapters...'
    )

    content.innerHTML = `
      <div class="chapters-generation-section">
        <div class="bulk-generation-progress">
          <div class="overall-progress">
            <div class="progress-info">
              <h5>Generating Full Story</h5>
              <p id="currentChapterInfo">Preparing to generate chapters...</p>
              <p class="validation-threshold-info">Validation threshold: ${
                window.settingsPanel.getSettings().validationThreshold
              } (chapters below this score will be regenerated)</p>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" id="overallProgressFill" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <div class="chapters-status" id="chaptersStatusContainer">
          ${this.currentWorkflow.outline.chapters
            .map((chapter) => {
              const generated = this.currentWorkflow.chapters.find(
                (ch) => ch.chapter_number === chapter.chapter_number
              )
              return `
              <div class="chapter-status-card ${
                generated ? 'completed' : 'pending'
              }" id="chapter-${chapter.chapter_number}">
                <div class="chapter-header">
                  <h6>Chapter ${chapter.chapter_number}: ${chapter.title}</h6>
                  <div class="chapter-status">
                    ${
                      generated
                        ? `<span class="status-indicator completed">
                             <i data-lucide="check"></i>
                             Complete (${generated.word_count} words)
                           </span>`
                        : `<span class="status-indicator pending" id="status-${chapter.chapter_number}">
                             <i data-lucide="clock"></i>
                             Waiting...
                           </span>`
                    }
                  </div>
                </div>
              </div>
            `
            })
            .join('')}
        </div>
      </div>
    `

    // Re-initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }

  addCompletedChapterToWorkflow(chapterData) {
    if (!this.currentWorkflow) return

    // Find and update or add the chapter
    const existingIndex = this.currentWorkflow.chapters.findIndex(
      (ch) => ch.chapter_number === chapterData.chapter_number
    )

    if (existingIndex !== -1) {
      this.currentWorkflow.chapters[existingIndex] = chapterData
    } else {
      this.currentWorkflow.chapters.push(chapterData)
      this.currentWorkflow.chapters_completed =
        this.currentWorkflow.chapters.length
    }

    // Sort chapters by chapter number
    this.currentWorkflow.chapters.sort(
      (a, b) => a.chapter_number - b.chapter_number
    )

    // Update the chapters display to show the new chapter immediately
    this.refreshChapterDisplay()
  }

  refreshChapterDisplay() {
    // Only refresh if we're not in the middle of bulk generation UI
    const chaptersContent = document.getElementById('chaptersContent')
    if (!chaptersContent) return

    // Check if we're in bulk generation mode
    const bulkGenSection = chaptersContent.querySelector(
      '.chapters-generation-section'
    )
    if (bulkGenSection) {
      // We're in bulk generation mode, just update the sidebar or add a quick preview
      this.updateChaptersSidebar()
    } else {
      // We're in normal mode, fully refresh the chapters block
      this.renderChaptersBlock()
    }
  }

  updateChaptersSidebar() {
    // Find or create a sidebar for completed chapters during bulk generation
    const chaptersContent = document.getElementById('chaptersContent')
    if (!chaptersContent) return

    let sidebar = chaptersContent.querySelector('.completed-chapters-sidebar')
    if (!sidebar) {
      sidebar = document.createElement('div')
      sidebar.className = 'completed-chapters-sidebar'
      sidebar.innerHTML = `
        <h5>Completed Chapters</h5>
        <div class="completed-chapters-list"></div>
      `
      chaptersContent.appendChild(sidebar)
    }

    const chaptersList = sidebar.querySelector('.completed-chapters-list')
    chaptersList.innerHTML = ''

    // Add each completed chapter as a collapsible preview
    this.currentWorkflow.chapters.forEach((chapter) => {
      const chapterItem = document.createElement('div')
      chapterItem.className = 'sidebar-chapter-item'

      const preview =
        this.stripThinkingTags(chapter.content).substring(0, 200) +
        (chapter.content.length > 200 ? '...' : '')

      chapterItem.innerHTML = `
        <div class="sidebar-chapter-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
          <strong>Chapter ${chapter.chapter_number}: ${chapter.title}</strong>
          <span class="word-count">${chapter.word_count} words</span>
        </div>
        <div class="sidebar-chapter-preview" style="display: none;">
          <p>${preview}</p>
          <button onclick="window.storyWorkflow.viewFullChapter(${chapter.chapter_number})" class="btn btn-secondary btn-sm">View Full Chapter</button>
        </div>
      `
      chaptersList.appendChild(chapterItem)
    })
  }

  stripThinkingTags(text) {
    // Remove thinking tags for previews and word counts (both <thinking> and <think>)
    return text
      .replace(/<(?:thinking|think)>[\s\S]*?<\/(?:thinking|think)>/gi, '')
      .trim()
  }

  parseContentWithThinking(text) {
    // Parse content and handle thinking tags specially (same as storyDisplay)
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
          .replace(
            /^<(?:thinking|think)>([\s\S]*?)<\/(?:thinking|think)>$/i,
            '$1'
          )
          .trim()

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

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  viewFullChapter(chapterNumber) {
    const chapter = this.currentWorkflow.chapters.find(
      (ch) => ch.chapter_number === chapterNumber
    )
    if (!chapter) return

    // Create a modal or new window to show the full chapter
    const modal = document.createElement('div')
    modal.className = 'chapter-modal'
    modal.innerHTML = `
      <div class="chapter-modal-content">
        <div class="chapter-modal-header">
          <h3>Chapter ${chapter.chapter_number}: ${chapter.title}</h3>
          <button onclick="this.closest('.chapter-modal').remove()" class="btn btn-sm">×</button>
        </div>
        <div class="chapter-modal-body">
          <div class="chapter-content">${this.parseContentWithThinking(
            chapter.content
          )}</div>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    // Re-initialize Lucide icons for thinking blocks
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }

  handleBulkGenerationUpdate(update) {
    console.log('Bulk generation update:', update)

    const currentChapterInfo = document.getElementById('currentChapterInfo')
    const overallProgressFill = document.getElementById('overallProgressFill')

    if (update.type === 'progress') {
      // Update overall progress
      const progressPercent = (update.current / update.total) * 100
      if (overallProgressFill) {
        overallProgressFill.style.width = `${progressPercent}%`
      }

      // Update current chapter info
      if (currentChapterInfo) {
        if (update.status === 'generating') {
          const attemptInfo =
            update.attempt > 1 ? ` (attempt ${update.attempt})` : ''
          currentChapterInfo.textContent = `Generating ${update.chapter_title}${attemptInfo} (${update.current}/${update.total})`
        } else if (update.status === 'validating') {
          currentChapterInfo.textContent = `Validating ${update.chapter_title} (${update.current}/${update.total})`
        } else if (update.status === 'regenerating') {
          currentChapterInfo.textContent = `Regenerating ${
            update.chapter_title
          } - Score: ${update.validation_score?.toFixed(2)} (${
            update.current
          }/${update.total})`
        } else if (update.status === 'completed') {
          const scoreInfo = update.validation_score
            ? ` (Score: ${update.validation_score.toFixed(2)})`
            : ''
          const attemptInfo =
            update.attempts > 1 ? ` after ${update.attempts} attempts` : ''
          const timeInfo = update.chapter_time
            ? ` in ${update.chapter_time.toFixed(1)}s`
            : ''

          let statusText = `Completed ${update.chapter_title}${scoreInfo}${attemptInfo}${timeInfo} - ${update.current}/${update.total}`

          // Add timing estimates if available
          if (
            update.estimated_time_remaining &&
            update.estimated_time_remaining > 0
          ) {
            const estimateMinutes = Math.ceil(
              update.estimated_time_remaining / 60
            )
            statusText += ` - Est. ${estimateMinutes}m remaining`
          }

          currentChapterInfo.textContent = statusText
        } else if (update.status === 'completed_with_warning') {
          const timeInfo = update.chapter_time
            ? ` in ${update.chapter_time.toFixed(1)}s`
            : ''

          let statusText = `Completed ${
            update.chapter_title
          } with warnings (Score: ${update.validation_score?.toFixed(
            2
          )})${timeInfo} - ${update.current}/${update.total}`

          // Add timing estimates if available
          if (
            update.estimated_time_remaining &&
            update.estimated_time_remaining > 0
          ) {
            const estimateMinutes = Math.ceil(
              update.estimated_time_remaining / 60
            )
            statusText += ` - Est. ${estimateMinutes}m remaining`
          }

          currentChapterInfo.textContent = statusText
        }
      }

      // Update chapter status
      const chapterCard = document.getElementById(
        `chapter-${update.chapter_number}`
      )
      const statusElement = document.getElementById(
        `status-${update.chapter_number}`
      )

      if (chapterCard && statusElement) {
        if (update.status === 'generating') {
          chapterCard.className = 'chapter-status-card generating'
          const attemptInfo = update.attempt > 1 ? ` (${update.attempt})` : ''
          statusElement.innerHTML = `
            <i data-lucide="loader-2"></i>
            Generating${attemptInfo}...
          `
        } else if (update.status === 'validating') {
          chapterCard.className = 'chapter-status-card generating'
          statusElement.innerHTML = `
            <i data-lucide="search"></i>
            Validating...
          `
        } else if (update.status === 'regenerating') {
          chapterCard.className = 'chapter-status-card regenerating'
          statusElement.innerHTML = `
            <i data-lucide="refresh-cw"></i>
            Regenerating (${update.validation_score?.toFixed(2)})
          `
        } else if (update.status === 'completed') {
          chapterCard.className = 'chapter-status-card completed'
          const scoreInfo = update.validation_score
            ? ` Score: ${update.validation_score.toFixed(2)}`
            : ''
          const attemptInfo =
            update.attempts > 1 ? ` (${update.attempts} attempts)` : ''
          const timeInfo = update.chapter_time
            ? ` in ${update.chapter_time.toFixed(1)}s`
            : ''
          statusElement.innerHTML = `
            <i data-lucide="check"></i>
            Complete (${update.word_count} words)${scoreInfo}${attemptInfo}${timeInfo}
          `

          // If chapter data is included, immediately add it to the workflow and display it
          if (update.chapter) {
            this.addCompletedChapterToWorkflow(update.chapter)
          }
        } else if (update.status === 'completed_with_warning') {
          chapterCard.className = 'chapter-status-card completed-warning'
          const timeInfo = update.chapter_time
            ? ` in ${update.chapter_time.toFixed(1)}s`
            : ''
          statusElement.innerHTML = `
            <i data-lucide="alert-triangle"></i>
            Complete with warnings (${
              update.word_count
            } words, Score: ${update.validation_score?.toFixed(2)})${timeInfo}
          `

          // If chapter data is included, immediately add it to the workflow and display it
          if (update.chapter) {
            this.addCompletedChapterToWorkflow(update.chapter)
          }
        }
      }
    } else if (update.type === 'complete') {
      if (currentChapterInfo) {
        let completionText = 'All chapters completed successfully!'
        if (update.total_time) {
          const minutes = Math.floor(update.total_time / 60)
          const seconds = Math.round(update.total_time % 60)
          completionText += ` in ${minutes}m ${seconds}s`
        }
        if (update.avg_time_per_chapter) {
          completionText += ` (avg ${update.avg_time_per_chapter.toFixed(
            1
          )}s per chapter)`
        }
        currentChapterInfo.textContent = completionText
      }
      if (overallProgressFill) {
        overallProgressFill.style.width = '100%'
      }

      // Update workflow with final data
      if (update.workflow) {
        this.currentWorkflow = update.workflow
      }

      // Re-render with complete state
      setTimeout(() => {
        this.renderChaptersBlock()
        this.renderCompleteBlock()
      }, 1000)
    } else if (update.type === 'warning') {
      // Handle warning for chapters completed with low scores
      const chapterCard = document.getElementById(
        `chapter-${update.chapter_number}`
      )
      const statusElement = document.getElementById(
        `status-${update.chapter_number}`
      )

      if (chapterCard && statusElement) {
        chapterCard.className = 'chapter-status-card completed-warning'
        statusElement.innerHTML = `
          <i data-lucide="alert-triangle"></i>
          Low quality (${
            update.word_count
          } words, Score: ${update.validation_score?.toFixed(2)})
        `
      }
    } else if (update.type === 'error') {
      if (currentChapterInfo) {
        currentChapterInfo.textContent = `Error: ${update.message}`
      }

      const chapterCard = document.getElementById(
        `chapter-${update.chapter_number}`
      )
      const statusElement = document.getElementById(
        `status-${update.chapter_number}`
      )

      if (chapterCard && statusElement) {
        chapterCard.className = 'chapter-status-card error'
        statusElement.innerHTML = `
          <i data-lucide="x-circle"></i>
          Failed
        `
      }
    }

    // Re-initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }

  bindChaptersEvents() {
    const content = document.getElementById('chaptersContent')
    if (!content) return

    // Chapter generation buttons
    content.querySelectorAll('.generate-chapter-btn').forEach((btn) => {
      const chapterNumber = parseInt(btn.dataset.chapter)

      const wrappedGenerateChapter = window.buttonLock.wrapAsync(
        btn,
        () => this.generateChapter(chapterNumber),
        {
          lockText: 'Generating...',
          lockIcon: 'loader-2',
          minDuration: 2000,
        }
      )

      btn.addEventListener('click', wrappedGenerateChapter)
    })

    // Chapter validation buttons
    content.querySelectorAll('.validate-chapter-btn').forEach((btn) => {
      const chapterNumber = parseInt(btn.dataset.chapter)

      const wrappedValidateChapter = window.buttonLock.wrapAsync(
        btn,
        () => this.validateChapter(chapterNumber),
        {
          lockText: 'Validating...',
          lockIcon: 'check-circle',
          minDuration: 1500,
        }
      )

      btn.addEventListener('click', wrappedValidateChapter)
    })

    // View chapter buttons - no locking needed for these
    content.querySelectorAll('.view-chapter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const chapterNumber = parseInt(
          e.target.closest('.view-chapter-btn').dataset.chapter
        )
        this.viewChapter(chapterNumber)
      })
    })
  }

  async generateChapter(chapterNumber) {
    try {
      this.setGenerating(true, `Generating Chapter ${chapterNumber}...`)

      const response = await window.api.generateChapter(
        this.currentWorkflow.id,
        chapterNumber,
        {}
      )

      this.currentWorkflow = response.workflow
      this.renderChaptersBlock()

      // Check if all chapters are complete
      if (
        this.currentWorkflow.chapters_completed >=
        this.currentWorkflow.total_chapters_planned
      ) {
        this.updateBlockStatus(
          'chaptersBlock',
          'completed',
          'All chapters generated'
        )
        this.renderCompleteBlock()
      }
    } catch (error) {
      console.error(`Failed to generate chapter ${chapterNumber}:`, error)
      alert(`Failed to generate chapter ${chapterNumber}. Please try again.`)
    } finally {
      this.setGenerating(false)
    }
  }

  async validateChapter(chapterNumber) {
    try {
      this.setGenerating(true, `Validating Chapter ${chapterNumber}...`)

      const response = await window.api.validateChapter(
        this.currentWorkflow.id,
        chapterNumber,
        {}
      )

      this.currentWorkflow = response.workflow
      this.renderChaptersBlock()
    } catch (error) {
      console.error(`Failed to validate chapter ${chapterNumber}:`, error)
      alert(`Failed to validate chapter ${chapterNumber}. Please try again.`)
    } finally {
      this.setGenerating(false)
    }
  }

  viewChapter(chapterNumber) {
    const chapter = this.currentWorkflow.chapters.find(
      (ch) => ch.chapter_number === chapterNumber
    )
    if (!chapter) return

    const modal = document.createElement('div')
    modal.className = 'chapter-modal'
    modal.innerHTML = `
      <div class="chapter-modal-content">
        <div class="chapter-modal-header">
          <h3>Chapter ${chapter.chapter_number}: ${chapter.title}</h3>
          <button class="close-modal-btn">×</button>
        </div>
        <div class="chapter-modal-body">
          <div class="chapter-content">${this.parseContentWithThinking(
            chapter.content
          )}</div>
        </div>
      </div>
    `

    document.body.appendChild(modal)

    // Re-initialize Lucide icons for thinking blocks
    if (window.lucide) {
      window.lucide.createIcons()
    }

    modal.querySelector('.close-modal-btn').addEventListener('click', () => {
      document.body.removeChild(modal)
    })

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal)
      }
    })
  }

  renderCompleteBlock() {
    const content = document.getElementById('completeContent')
    if (!content || !this.currentWorkflow) return

    this.currentWorkflow.current_step = 'completed'
    this.updateBlockStatus('completeBlock', 'completed', 'Story complete!')
    this.renderProgressIndicator()
    this.updateBlockStates()

    content.innerHTML = `
      <div class="completion-section">
        <div class="completion-header">
          <h4>🎉 Story Complete!</h4>
          <p>Your multi-step story generation is complete. Here's a summary:</p>
        </div>

        <div class="completion-summary">
          <div class="summary-stats">
            <div class="stat-item">
              <strong>${this.currentWorkflow.characters.length}</strong>
              <span>Characters</span>
            </div>
            <div class="stat-item">
              <strong>${this.currentWorkflow.chapters.length}</strong>
              <span>Chapters</span>
            </div>
            <div class="stat-item">
              <strong>${this.currentWorkflow.chapters.reduce(
                (sum, ch) => sum + ch.word_count,
                0
              )}</strong>
              <span>Total Words</span>
            </div>
          </div>

          <div class="completion-actions">
            <button id="viewFullStoryBtn" class="btn btn-primary">
              <i data-lucide="book"></i>
              View Complete Story
            </button>
            <button id="downloadStoryBtn" class="btn btn-outline">
              <i data-lucide="download"></i>
              Download Story
            </button>
          </div>
        </div>
      </div>
    `

    // Bind events with button locking
    const viewBtn = content.querySelector('#viewFullStoryBtn')
    if (viewBtn) {
      viewBtn.addEventListener('click', () => this.viewCompleteStory())
    }

    const downloadBtn = content.querySelector('#downloadStoryBtn')
    if (downloadBtn) {
      const wrappedDownload = window.buttonLock.wrapAsync(
        downloadBtn,
        this.downloadStory.bind(this),
        {
          lockText: 'Downloaded!',
          lockIcon: 'check',
          minDuration: 1500,
          showSpinner: false,
        }
      )
      downloadBtn.addEventListener('click', wrappedDownload)
    }

    // Re-initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }

  viewCompleteStory() {
    if (!this.currentWorkflow || !this.currentWorkflow.chapters.length) return

    const completeStory = this.currentWorkflow.chapters
      .sort((a, b) => a.chapter_number - b.chapter_number)
      .map(
        (chapter) =>
          `<div class="chapter-section">
            <h2>Chapter ${chapter.chapter_number}: ${chapter.title}</h2>
            ${this.parseContentWithThinking(chapter.content)}
          </div>`
      )
      .join('<div class="chapter-divider">---</div>')

    const modal = document.createElement('div')
    modal.className = 'chapter-modal'
    modal.innerHTML = `
      <div class="chapter-modal-content">
        <div class="chapter-modal-header">
          <h3>${this.currentWorkflow.outline.title}</h3>
          <button class="close-modal-btn">×</button>
        </div>
        <div class="chapter-modal-body">
          <div class="chapter-content">${completeStory}</div>
        </div>
      </div>
    `

    document.body.appendChild(modal)

    // Re-initialize Lucide icons for thinking blocks
    if (window.lucide) {
      window.lucide.createIcons()
    }

    modal.querySelector('.close-modal-btn').addEventListener('click', () => {
      document.body.removeChild(modal)
    })

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal)
      }
    })
  }

  downloadStory() {
    if (!this.currentWorkflow || !this.currentWorkflow.chapters.length) return

    const completeStory = this.currentWorkflow.chapters
      .sort((a, b) => a.chapter_number - b.chapter_number)
      .map(
        (chapter) =>
          `Chapter ${chapter.chapter_number}: ${chapter.title}\n\n${chapter.content}`
      )
      .join('\n\n---\n\n')

    const blob = new Blob([completeStory], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${this.currentWorkflow.outline.title
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  startNewStory() {
    if (
      confirm(
        'This will start a new story and lose current progress. Continue?'
      )
    ) {
      this.currentWorkflow = null
      document.getElementById('promptTextarea').value = ''

      // Reset all blocks
      document.getElementById('charactersContent').innerHTML = `
        <div class="placeholder-content">
          <i data-lucide="users"></i>
          <p>Characters and story settings will be generated and editable here</p>
        </div>
      `
      document.getElementById('outlineContent').innerHTML = `
        <div class="placeholder-content">
          <i data-lucide="list"></i>
          <p>Story outline with chapter breakdowns will appear here</p>
        </div>
      `
      document.getElementById('chaptersContent').innerHTML = `
        <div class="placeholder-content">
          <i data-lucide="book-open"></i>
          <p>Individual chapters will be generated and validated here</p>
        </div>
      `
      document.getElementById('completeContent').innerHTML = `
        <div class="placeholder-content">
          <i data-lucide="check-circle"></i>
          <p>Your completed story will be displayed here</p>
        </div>
      `

      // Reset statuses
      this.updateBlockStatus('promptBlock', 'pending', 'Enter your story idea')
      this.updateBlockStatus(
        'charactersBlock',
        'pending',
        'Complete prompt first'
      )
      this.updateBlockStatus(
        'outlineBlock',
        'pending',
        'Complete characters first'
      )
      this.updateBlockStatus(
        'chaptersBlock',
        'pending',
        'Complete outline first'
      )
      this.updateBlockStatus(
        'completeBlock',
        'pending',
        'Complete chapters first'
      )

      this.renderProgressIndicator()
      this.updateBlockStates()

      // Re-initialize Lucide icons
      if (window.lucide) {
        window.lucide.createIcons()
      }
    }
  }

  setGenerating(isGenerating, message = '') {
    this.isGenerating = isGenerating

    if (isGenerating) {
      window.statusBar.show(message)
    } else {
      window.statusBar.hide()
    }
  }
}

// Global instance
window.storyWorkflow = new StoryWorkflow()
