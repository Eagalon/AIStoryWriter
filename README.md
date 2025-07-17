# AI Story Writer

A simple web UI framework for generating long context stories with Ollama. Features a clean, modern interface with real-time streaming generation, customizable settings, and story continuation capabilities.

## Features

- **Real-time Streaming**: Watch stories generate word by word in real-time
- **Dynamic Settings**: Adjust temperature, top-p, and system prompts on the fly
- **Story Continuation**: Continue existing stories with new prompts
- **Model Selection**: Choose from any available Ollama models
- **Export Options**: Copy to clipboard or download as text files
- **Statistics**: Track word count, character count, and reading time
- **Writing Prompts**: Built-in collection of creative writing prompts
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode**: Automatic dark/light theme support

## Architecture

```
├── backend/                 # FastAPI Python backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Configuration
│   │   ├── models/         # Pydantic models
│   │   └── services/       # Ollama integration
│   └── main.py             # Application entry point
└── frontend/               # Simple HTML/CSS/JS frontend
    ├── css/
    │   └── main.css        # Styling
    ├── js/
    │   ├── api.js          # API communication
    │   ├── settingsPanel.js # Settings management
    │   ├── storyGenerator.js # Story generation
    │   ├── storyDisplay.js  # Story display
    │   └── main.js         # App initialization
    └── index.html          # Main HTML file
```

## Prerequisites

1. **Python 3.10+** with `uv` package manager
2. **Ollama** running locally with at least one model

### Setting up Ollama

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model (e.g., `ollama pull llama3.1:8b`)
3. Ensure Ollama is running on `http://localhost:11434`

## Quick Start

### 1. Clone and Setup Backend

```bash
# Install Python dependencies
cd backend
uv pip install -r requirements.txt
# Alternative: uv pip install fastapi uvicorn[standard] httpx pydantic python-multipart jinja2 aiofiles python-dotenv pydantic-settings

# Start the backend server
uv run python main.py
```

The backend will be available at `http://localhost:8000`

### 2. Start the Application

```bash
# Quick start (runs both backend and frontend)
python run.py
```

Both servers will start automatically:

- Backend API: `http://localhost:8000`
- Frontend: `http://localhost:5173`

### 3. Access the Application

Open your browser to `http://localhost:5173` and start generating stories!

## Configuration

### Backend Configuration

Create a `.env` file in the project root:

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3.1:8b
OLLAMA_TIMEOUT=300

# Story Generation Settings
MAX_STORY_LENGTH=50000
DEFAULT_TEMPERATURE=0.7
DEFAULT_TOP_P=0.9

# Application Settings
DEBUG=false
SERVE_STATIC=true
ALLOWED_ORIGINS=["http://localhost:3000", "http://localhost:5173"]
```

### Frontend Configuration

The frontend automatically connects to the backend API. No additional configuration needed for development.

## Usage

1. **Enter a Prompt**: Describe the story you want to create
2. **Adjust Settings**: Optionally modify model, temperature, and other parameters
3. **Generate**: Click "Generate Story" to start streaming generation
4. **Continue**: Add to existing stories with the continue feature
5. **Export**: Copy or download your completed stories

### Writing Tips

- Use specific, detailed prompts for better results
- Experiment with different temperature settings:
  - Low (0.1-0.4): More focused and coherent
  - Medium (0.5-0.8): Balanced creativity and coherence
  - High (0.9-1.5): More creative and unpredictable
- Use system prompts to set style or genre preferences
- Try the preset configurations for quick setup

## API Endpoints

### Health Check

```
GET /api/v1/health
```

### Get Available Models

```
GET /api/v1/models
```

### Generate Story (Streaming)

```
POST /api/v1/generate/stream
Content-Type: application/json

{
  "prompt": "Write a story about...",
  "model": "llama3.1:8b",
  "temperature": 0.7,
  "top_p": 0.9,
  "system_prompt": "Write in a fantasy style",
  "continue_story": "Previous story content..."
}
```

### Generate Story (Complete)

```
POST /api/v1/generate
Content-Type: application/json

{
  "prompt": "Write a story about...",
  "model": "llama3.1:8b",
  "temperature": 0.7,
  "top_p": 0.9
}
```

### Get Writing Prompts

```
GET /api/v1/prompts/suggestions
```

## Development

### Backend Development

```bash
cd backend
uv run python main.py
```

The backend runs with hot reload enabled for development.

### Frontend Development

The frontend uses simple HTML/CSS/JS with no build step required. Just edit the files and refresh:

```bash
# Serve frontend manually (optional)
cd frontend
python -m http.server 5173
```

The frontend includes:

- Modern CSS with custom properties
- Modular JavaScript architecture
- Lucide icons via CDN
- Responsive design

## Production Deployment

### Backend

```bash
cd backend
uv pip install -r requirements.txt
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend

The frontend is already production-ready as static files. No build step required:

```bash
# Frontend files are ready to serve directly from frontend/
# The backend can serve them when SERVE_STATIC=true
```

The static files can be served by any web server or the backend directly.

## Troubleshooting

### Ollama Connection Issues

1. Ensure Ollama is running: `ollama list`
2. Check the Ollama API: `curl http://localhost:11434/api/tags`
3. Verify model availability: `ollama pull llama3.1:8b`

### Backend Issues

1. Check Python version: `python --version` (should be 3.10+)
2. Verify dependencies: `uv pip list`
3. If you get package build errors, try: `cd backend && uv pip install -r requirements.txt`
4. Check logs for error messages

### Frontend Issues

1. Check browser console for JavaScript errors
2. Verify API connection in browser dev tools (Network tab)
3. Ensure backend is running and accessible

## License

MIT License - feel free to use and modify as needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review the Ollama documentation
3. Open an issue on GitHub
