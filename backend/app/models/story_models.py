from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid
from datetime import datetime


class StoryGenerationRequest(BaseModel):
    prompt: str = Field(..., description="The story prompt")
    model: Optional[str] = Field(None, description="Ollama model to use")
    temperature: Optional[float] = Field(
        0.7, ge=0.0, le=2.0, description="Creativity level"
    )
    top_p: Optional[float] = Field(0.9, ge=0.0, le=1.0, description="Nucleus sampling")
    system_prompt: Optional[str] = Field(None, description="System instructions")
    continue_story: Optional[str] = Field(
        None, description="Existing story to continue"
    )


class StoryChunk(BaseModel):
    content: str
    is_complete: bool = False


class StoryResponse(BaseModel):
    content: str
    model_used: str
    generation_time: Optional[float] = None
    word_count: int
    character_count: int


# Multi-Step Story Generation Models


class Character(BaseModel):
    name: str = Field(..., description="Character's name")
    description: str = Field(..., description="Character description and traits")
    role: str = Field(
        ...,
        description="Character's role in the story (protagonist, antagonist, supporting, etc.)",
    )
    background: Optional[str] = Field(
        None, description="Character's background and history"
    )
    motivations: Optional[str] = Field(
        None, description="Character's goals and motivations"
    )
    relationships: Optional[Dict[str, str]] = Field(
        None, description="Relationships with other characters"
    )


class StorySettings(BaseModel):
    genre: str = Field(..., description="Story genre")
    setting: str = Field(..., description="Time and place where the story occurs")
    tone: str = Field(..., description="Overall tone and mood of the story")
    themes: List[str] = Field(
        default_factory=list, description="Main themes to explore"
    )
    world_building: Optional[str] = Field(
        None, description="Additional world-building details"
    )
    target_length: Optional[str] = Field(
        "medium", description="Target story length (short, medium, long)"
    )


class ChapterOutline(BaseModel):
    chapter_number: int = Field(..., description="Chapter number")
    title: str = Field(..., description="Chapter title")
    summary: str = Field(..., description="Brief chapter summary")
    key_events: List[str] = Field(
        default_factory=list, description="Key events in this chapter"
    )
    characters_involved: List[str] = Field(
        default_factory=list, description="Characters featured in this chapter"
    )
    purpose: str = Field(
        ..., description="Purpose of this chapter in the overall story"
    )


class StoryOutline(BaseModel):
    title: str = Field(..., description="Story title")
    premise: str = Field(..., description="Core story premise")
    plot_structure: str = Field(..., description="Overall plot structure and arc")
    chapters: List[ChapterOutline] = Field(
        default_factory=list, description="Chapter outlines"
    )
    estimated_word_count: Optional[int] = Field(
        None, description="Estimated total word count"
    )


class GeneratedChapter(BaseModel):
    chapter_number: int = Field(..., description="Chapter number")
    title: str = Field(..., description="Chapter title")
    outline: str = Field(..., description="Generated chapter outline")
    dialogue: str = Field(..., description="Generated dialogue for the chapter")
    content: str = Field(..., description="Final chapter content")
    word_count: int = Field(default=0, description="Chapter word count")
    validation_score: Optional[float] = Field(
        None, description="How well chapter matches outline (0-1)"
    )
    validation_feedback: Optional[str] = Field(
        None, description="AI feedback on chapter quality"
    )


class WorkflowStep(str, Enum):
    CHARACTERS_SETTINGS = "characters_settings"
    OUTLINE = "outline"
    CHAPTER_GENERATION = "chapter_generation"
    VALIDATION = "validation"
    COMPLETED = "completed"


class StoryWorkflow(BaseModel):
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), description="Unique workflow ID"
    )
    original_prompt: str = Field(..., description="Original user prompt")
    current_step: WorkflowStep = Field(
        WorkflowStep.CHARACTERS_SETTINGS, description="Current workflow step"
    )
    created_at: datetime = Field(
        default_factory=datetime.now, description="Workflow creation time"
    )
    updated_at: datetime = Field(
        default_factory=datetime.now, description="Last update time"
    )

    # Generated content for each step
    characters: List[Character] = Field(
        default_factory=list, description="Generated characters"
    )
    settings: Optional[StorySettings] = Field(
        None, description="Generated story settings"
    )
    outline: Optional[StoryOutline] = Field(None, description="Generated story outline")
    chapters: List[GeneratedChapter] = Field(
        default_factory=list, description="Generated chapters"
    )

    # Configuration
    model: Optional[str] = Field(None, description="Ollama model to use")
    temperature: float = Field(0.7, description="Generation temperature")
    top_p: float = Field(0.9, description="Top-p sampling")

    # Progress tracking
    total_chapters_planned: int = Field(
        default=0, description="Total chapters in outline"
    )
    chapters_completed: int = Field(
        default=0, description="Chapters successfully generated"
    )
    is_complete: bool = Field(default=False, description="Whether workflow is complete")


# Request/Response models for workflow endpoints


class CreateWorkflowRequest(BaseModel):
    prompt: str = Field(..., description="Initial story prompt")
    model: Optional[str] = Field(None, description="Ollama model to use")
    temperature: Optional[float] = Field(0.7, description="Generation temperature")
    top_p: Optional[float] = Field(0.9, description="Top-p sampling")


class GenerateCharactersSettingsRequest(BaseModel):
    workflow_id: str = Field(..., description="Workflow ID")
    additional_instructions: Optional[str] = Field(
        None, description="Additional instructions for character/setting generation"
    )


class GenerateOutlineRequest(BaseModel):
    workflow_id: str = Field(..., description="Workflow ID")
    target_chapters: Optional[int] = Field(
        None, description="Target number of chapters"
    )
    additional_instructions: Optional[str] = Field(
        None, description="Additional instructions for outline generation"
    )


class GenerateChapterRequest(BaseModel):
    workflow_id: str = Field(..., description="Workflow ID")
    chapter_number: int = Field(..., description="Chapter number to generate")
    additional_instructions: Optional[str] = Field(
        None, description="Additional instructions for chapter generation"
    )


class GenerateAllChaptersRequest(BaseModel):
    workflow_id: str = Field(..., description="Workflow ID")
    additional_instructions: Optional[str] = Field(
        None, description="Additional instructions for all chapter generation"
    )
    validation_threshold: Optional[float] = Field(
        0.7, ge=0.1, le=1.0, description="Chapters below this score will be regenerated"
    )


class ValidateChapterRequest(BaseModel):
    workflow_id: str = Field(..., description="Workflow ID")
    chapter_number: int = Field(..., description="Chapter number to validate")


class WorkflowResponse(BaseModel):
    workflow: StoryWorkflow
    message: str = Field(..., description="Status message")


class WorkflowListResponse(BaseModel):
    workflows: List[StoryWorkflow]
    total: int


# Existing models remain unchanged
class ModelInfo(BaseModel):
    name: str
    size: Optional[str] = None
    family: Optional[str] = None


class ModelsResponse(BaseModel):
    models: List[ModelInfo]
    default_model: str


class HealthResponse(BaseModel):
    status: str
    ollama_connected: bool
    available_models: int


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
