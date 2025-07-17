// API module for backend communication
class APIClient {
  constructor() {
    // Point to the backend server
    this.baseURL = 'http://localhost:8000/api/v1'
  }

  async fetchJSON(url, options = {}) {
    const fullURL = `${this.baseURL}${url}`
    console.log('🌐 Making HTTP request to:', fullURL, 'with options:', options)

    try {
      const response = await fetch(fullURL, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      console.log(
        '📡 HTTP response status:',
        response.status,
        response.statusText
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('📦 HTTP response data:', result)
      return result
    } catch (error) {
      console.error('🚨 API request failed:', error)
      throw error
    }
  }

  async checkHealth() {
    return this.fetchJSON('/health')
  }

  async getModels() {
    return this.fetchJSON('/models')
  }

  async getPromptSuggestions() {
    return this.fetchJSON('/prompts/suggestions')
  }

  async generateStory(requestData) {
    return this.fetchJSON('/generate', {
      method: 'POST',
      body: JSON.stringify(requestData),
    })
  }

  async *generateStoryStream(requestData) {
    try {
      const response = await fetch(`${this.baseURL}/generate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ') && line.length > 6) {
            try {
              const data = JSON.parse(line.slice(6))
              yield data
              if (data.isComplete) {
                return
              }
            } catch (e) {
              console.warn('Failed to parse chunk:', line)
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error)
      throw error
    }
  }

  // Workflow API methods

  async createWorkflow(requestData) {
    console.log('🔗 API: Creating workflow with data:', requestData)
    const result = await this.fetchJSON('/workflow/create', {
      method: 'POST',
      body: JSON.stringify(requestData),
    })
    console.log('🔗 API: Create workflow result:', result)
    return result
  }

  async getWorkflow(workflowId) {
    return this.fetchJSON(`/workflow/${workflowId}`)
  }

  async listWorkflows() {
    return this.fetchJSON('/workflows')
  }

  async generateCharactersSettings(workflowId, requestData = {}) {
    console.log(
      '🔗 API: Generating characters/settings for workflow:',
      workflowId,
      'with data:',
      requestData
    )
    const result = await this.fetchJSON(
      `/workflow/${workflowId}/characters-settings`,
      {
        method: 'POST',
        body: JSON.stringify({
          workflow_id: workflowId,
          ...requestData,
        }),
      }
    )
    console.log('🔗 API: Generate characters/settings result:', result)
    return result
  }

  async generateOutline(workflowId, requestData = {}) {
    return this.fetchJSON(`/workflow/${workflowId}/outline`, {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: workflowId,
        ...requestData,
      }),
    })
  }

  async generateChapter(workflowId, chapterNumber, requestData = {}) {
    return this.fetchJSON(`/workflow/${workflowId}/chapter/${chapterNumber}`, {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: workflowId,
        chapter_number: chapterNumber,
        ...requestData,
      }),
    })
  }

  async *generateChapterStream(workflowId, chapterNumber, requestData = {}) {
    try {
      const response = await fetch(
        `${this.baseURL}/workflow/${workflowId}/chapter/${chapterNumber}/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            additional_instructions: '',
            ...requestData,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ') && line.length > 6) {
            try {
              const data = JSON.parse(line.slice(6))
              yield data
              if (data.type === 'chapter_complete' || data.type === 'error') {
                return
              }
            } catch (e) {
              console.warn('Failed to parse chunk:', line)
            }
          }
        }
      }
    } catch (error) {
      console.error('Chapter streaming error:', error)
      throw error
    }
  }

  async *generateAllChaptersStream(workflowId, requestData = {}) {
    try {
      const response = await fetch(
        `${this.baseURL}/workflow/${workflowId}/generate-all-chapters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workflow_id: workflowId,
            ...requestData,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ') && line.length > 6) {
            try {
              const data = JSON.parse(line.slice(6))
              yield data
              if (data.type === 'complete' || data.type === 'error') {
                return
              }
            } catch (e) {
              console.warn('Failed to parse chunk:', line)
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error)
      throw error
    }
  }

  async validateChapter(workflowId, chapterNumber, requestData = {}) {
    return this.fetchJSON(
      `/workflow/${workflowId}/chapter/${chapterNumber}/validate`,
      {
        method: 'POST',
        body: JSON.stringify({
          workflow_id: workflowId,
          chapter_number: chapterNumber,
          ...requestData,
        }),
      }
    )
  }

  async deleteWorkflow(workflowId) {
    return this.fetchJSON(`/workflow/${workflowId}`, {
      method: 'DELETE',
    })
  }
}

// Create global API instance
window.api = new APIClient()
