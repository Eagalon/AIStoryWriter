from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import List
import time
import json

from app.models.story_models import (
    StoryGenerationRequest,
    StoryResponse,
    StoryChunk,
    ModelsResponse,
    ModelInfo,
    HealthResponse,
    ErrorResponse,
    # Workflow models
    CreateWorkflowRequest,
    GenerateCharactersSettingsRequest,
    GenerateOutlineRequest,
    GenerateChapterRequest,
    GenerateAllChaptersRequest,
    ValidateChapterRequest,
    WorkflowResponse,
    WorkflowListResponse,
)
from app.services.ollama_service import ollama_service
from app.services.story_workflow_service import story_workflow_service
from app.core.config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check application and Ollama health status"""
    ollama_connected = await ollama_service.check_connection()
    models = await ollama_service.get_available_models()

    return HealthResponse(
        status="healthy" if ollama_connected else "degraded",
        ollama_connected=ollama_connected,
        available_models=len(models),
    )


@router.get("/models", response_model=ModelsResponse)
async def get_models():
    """Get available Ollama models"""
    try:
        model_names = await ollama_service.get_available_models()
        models = [ModelInfo(name=name) for name in model_names]

        return ModelsResponse(
            models=models, default_model=settings.OLLAMA_DEFAULT_MODEL
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get models: {str(e)}")


@router.post("/generate/stream")
async def generate_story_stream(request: StoryGenerationRequest):
    """Generate story with streaming response"""

    # Build the complete prompt
    full_prompt = request.prompt
    if request.continue_story:
        full_prompt = (
            f"Continue this story:\n\n{request.continue_story}\n\n{request.prompt}"
        )

    async def stream_generator():
        try:
            # Use provided system prompt or default to clean story generation
            system_prompt = (
                request.system_prompt
                or "You are an expert storyteller. Write engaging, creative stories with vivid descriptions and compelling narratives. Output only the story content without any headers, titles, introductory text, or explanatory comments."
            )

            async for chunk in ollama_service.generate_story_stream(
                prompt=full_prompt,
                model=request.model,
                temperature=request.temperature,
                top_p=request.top_p,
                system_prompt=system_prompt,
            ):
                # Send each chunk as JSON
                chunk_data = StoryChunk(content=chunk, is_complete=False)
                yield f"data: {chunk_data.model_dump_json()}\n\n"

            # Send completion signal
            final_chunk = StoryChunk(content="", is_complete=True)
            yield f"data: {final_chunk.model_dump_json()}\n\n"

        except Exception as e:
            error_chunk = StoryChunk(content=f"Error: {str(e)}", is_complete=True)
            yield f"data: {error_chunk.model_dump_json()}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/plain; charset=utf-8",
        },
    )


@router.post("/generate", response_model=StoryResponse)
async def generate_story(request: StoryGenerationRequest):
    """Generate complete story (non-streaming)"""

    start_time = time.time()

    # Build the complete prompt
    full_prompt = request.prompt
    if request.continue_story:
        full_prompt = (
            f"Continue this story:\n\n{request.continue_story}\n\n{request.prompt}"
        )

    try:
        # Use provided system prompt or default to clean story generation
        system_prompt = (
            request.system_prompt
            or "You are an expert storyteller. Write engaging, creative stories with vivid descriptions and compelling narratives. Output only the story content without any headers, titles, introductory text, or explanatory comments."
        )

        content = await ollama_service.generate_story_complete(
            prompt=full_prompt,
            model=request.model,
            temperature=request.temperature,
            top_p=request.top_p,
            system_prompt=system_prompt,
        )

        generation_time = time.time() - start_time
        word_count = len(content.split())
        character_count = len(content)

        return StoryResponse(
            content=content,
            model_used=request.model or settings.OLLAMA_DEFAULT_MODEL,
            generation_time=generation_time,
            word_count=word_count,
            character_count=character_count,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate story: {str(e)}"
        )


@router.get("/prompts/suggestions")
async def get_prompt_suggestions():
    """Get writing prompt suggestions"""
    suggestions = [
        "Write a story about a character who discovers they can see 24 hours into the future",
        "Tell the tale of a librarian who finds a book that writes itself",
        "Create a story set in a world where memories can be traded like currency",
        "Write about a person who wakes up in a different timeline every day",
        "Tell a story about the last bookstore in a digital world",
        "Write about a character who can enter and explore paintings",
        "Create a tale about a detective who solves crimes using dreams",
        "Tell the story of a chef whose food can alter emotions",
        "Write about a world where colors have been outlawed",
        "Create a story about a person who collects lost sounds",
    ]
    return {"suggestions": suggestions}


# Multi-Step Story Generation Workflow Endpoints


@router.post("/workflow/create", response_model=WorkflowResponse)
async def create_story_workflow(request: CreateWorkflowRequest):
    """Create a new multi-step story generation workflow"""
    try:
        workflow = story_workflow_service.create_workflow(request)
        return WorkflowResponse(
            workflow=workflow,
            message="Workflow created successfully. Ready to generate characters and settings.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create workflow: {str(e)}"
        )


@router.get("/workflow/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str):
    """Get workflow by ID"""
    workflow = story_workflow_service.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return WorkflowResponse(
        workflow=workflow, message="Workflow retrieved successfully"
    )


@router.get("/workflows", response_model=WorkflowListResponse)
async def list_workflows():
    """List all workflows"""
    workflows = story_workflow_service.list_workflows()
    return WorkflowListResponse(workflows=workflows, total=len(workflows))


@router.post(
    "/workflow/{workflow_id}/characters-settings", response_model=WorkflowResponse
)
async def generate_characters_settings(
    workflow_id: str, request: GenerateCharactersSettingsRequest
):
    """Step 1: Generate characters and story settings"""
    try:
        workflow = await story_workflow_service.generate_characters_and_settings(
            workflow_id=workflow_id,
            additional_instructions=request.additional_instructions,
        )

        return WorkflowResponse(
            workflow=workflow,
            message=f"Generated {len(workflow.characters)} characters and story settings. Ready to create outline.",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate characters/settings: {str(e)}"
        )


@router.post("/workflow/{workflow_id}/outline", response_model=WorkflowResponse)
async def generate_outline(workflow_id: str, request: GenerateOutlineRequest):
    """Step 2: Generate story outline"""
    try:
        workflow = await story_workflow_service.generate_outline(
            workflow_id=workflow_id,
            target_chapters=request.target_chapters,
            additional_instructions=request.additional_instructions,
        )

        return WorkflowResponse(
            workflow=workflow,
            message=f"Generated outline with {len(workflow.outline.chapters)} chapters. Ready to generate chapters.",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate outline: {str(e)}"
        )


@router.post(
    "/workflow/{workflow_id}/chapter/{chapter_number}", response_model=WorkflowResponse
)
async def generate_chapter(
    workflow_id: str, chapter_number: int, request: GenerateChapterRequest
):
    """Step 3: Generate a specific chapter (outline, dialogue, content)"""
    try:
        workflow = await story_workflow_service.generate_chapter(
            workflow_id=workflow_id,
            chapter_number=chapter_number,
            additional_instructions=request.additional_instructions,
        )

        chapter = next(
            ch for ch in workflow.chapters if ch.chapter_number == chapter_number
        )

        return WorkflowResponse(
            workflow=workflow,
            message=f"Generated Chapter {chapter_number}: {chapter.title} ({chapter.word_count} words)",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate chapter: {str(e)}"
        )


@router.post("/workflow/{workflow_id}/generate-all-chapters")
async def generate_all_chapters(workflow_id: str, request: GenerateAllChaptersRequest):
    """Generate all chapters in sequence for a workflow"""
    try:

        async def stream_generator():
            async for update in story_workflow_service.generate_all_chapters_stream(
                workflow_id=workflow_id,
                additional_instructions=request.additional_instructions,
                validation_threshold=request.validation_threshold,
            ):
                # Send each update as JSON
                yield f"data: {json.dumps(update)}\n\n"

        return StreamingResponse(
            stream_generator(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/plain; charset=utf-8",
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate all chapters: {str(e)}"
        )


@router.post(
    "/workflow/{workflow_id}/chapter/{chapter_number}/validate",
    response_model=WorkflowResponse,
)
async def validate_chapter(
    workflow_id: str, chapter_number: int, request: ValidateChapterRequest
):
    """Step 4: Validate chapter against outline"""
    try:
        workflow = await story_workflow_service.validate_chapter(
            workflow_id=workflow_id, chapter_number=chapter_number
        )

        chapter = next(
            ch for ch in workflow.chapters if ch.chapter_number == chapter_number
        )

        return WorkflowResponse(
            workflow=workflow,
            message=f"Chapter {chapter_number} validated. Score: {chapter.validation_score:.2f}",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to validate chapter: {str(e)}"
        )


@router.delete("/workflow/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """Delete a workflow"""
    workflow = story_workflow_service.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    del story_workflow_service.workflows[workflow_id]
    return {"message": "Workflow deleted successfully"}
