from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "AI Story Writer"
    DEBUG: bool = False
    SERVE_STATIC: bool = True

    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Ollama settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_DEFAULT_MODEL: str = "qwen3:8b"
    OLLAMA_TIMEOUT: int = 300  # 5 minutes for long context generation

    # Story generation settings
    MAX_STORY_LENGTH: int = 50000  # Maximum characters for a story
    DEFAULT_TEMPERATURE: float = 0.7
    DEFAULT_TOP_P: float = 0.9
    DEFAULT_VALIDATION_THRESHOLD: float = (
        0.7  # Default threshold for chapter regeneration
    )

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
