import httpx
import json
import logging
from typing import AsyncGenerator, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class OllamaService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.timeout = settings.OLLAMA_TIMEOUT

    async def check_connection(self) -> bool:
        """Check if Ollama is running and accessible"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to connect to Ollama: {e}")
            return False

    async def get_available_models(self) -> list[str]:
        """Get list of available models from Ollama"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    return [model["name"] for model in data.get("models", [])]
                return []
        except Exception as e:
            logger.error(f"Failed to get models: {e}")
            return []

    async def generate_story_stream(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = settings.DEFAULT_TEMPERATURE,
        top_p: float = settings.DEFAULT_TOP_P,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Generate story content with streaming response"""

        model = model or settings.OLLAMA_DEFAULT_MODEL

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
                "num_predict": -1,  # Generate until natural stopping point
            },
        }

        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST", f"{self.base_url}/api/generate", json=payload
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        raise Exception(
                            f"Ollama API error: {response.status_code} - {error_text}"
                        )

                    async for line in response.aiter_lines():
                        if line.strip():
                            try:
                                data = json.loads(line)
                                if "response" in data:
                                    yield data["response"]
                                if data.get("done", False):
                                    break
                            except json.JSONDecodeError:
                                logger.warning(f"Failed to parse JSON: {line}")
                                continue

        except Exception as e:
            logger.error(f"Error generating story: {e}")
            yield f"Error: {str(e)}"

    async def generate_story_complete(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = settings.DEFAULT_TEMPERATURE,
        top_p: float = settings.DEFAULT_TOP_P,
        system_prompt: Optional[str] = None,
    ) -> str:
        """Generate complete story (non-streaming)"""

        model = model or settings.OLLAMA_DEFAULT_MODEL

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
                "num_predict": -1,
            },
        }

        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate", json=payload
                )

                if response.status_code == 200:
                    data = response.json()
                    return data.get("response", "")
                else:
                    error_text = response.text
                    raise Exception(
                        f"Ollama API error: {response.status_code} - {error_text}"
                    )

        except Exception as e:
            logger.error(f"Error generating story: {e}")
            return f"Error: {str(e)}"


# Global instance
ollama_service = OllamaService()
