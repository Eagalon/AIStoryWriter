import json
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime

from app.models.story_models import (
    StoryWorkflow,
    Character,
    StorySettings,
    StoryOutline,
    ChapterOutline,
    GeneratedChapter,
    WorkflowStep,
    CreateWorkflowRequest,
)
from app.services.ollama_service import ollama_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class StoryWorkflowService:
    def __init__(self):
        # In-memory storage for workflows (in production, use a database)
        self.workflows: Dict[str, StoryWorkflow] = {}

    def create_workflow(self, request: CreateWorkflowRequest) -> StoryWorkflow:
        """Create a new story generation workflow"""
        workflow = StoryWorkflow(
            original_prompt=request.prompt,
            model=request.model or settings.OLLAMA_DEFAULT_MODEL,
            temperature=request.temperature,
            top_p=request.top_p,
        )

        self.workflows[workflow.id] = workflow
        logger.info(f"Created workflow {workflow.id}")
        return workflow

    def get_workflow(self, workflow_id: str) -> Optional[StoryWorkflow]:
        """Get workflow by ID"""
        return self.workflows.get(workflow_id)

    def list_workflows(self) -> List[StoryWorkflow]:
        """List all workflows"""
        return list(self.workflows.values())

    async def generate_characters_and_settings(
        self, workflow_id: str, additional_instructions: Optional[str] = None
    ) -> StoryWorkflow:
        """Step 1: Generate characters and story settings"""
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        # Create the prompt for character and setting generation
        prompt = self._build_characters_settings_prompt(
            workflow.original_prompt, additional_instructions
        )

        try:
            # Generate characters and settings using AI
            response = await ollama_service.generate_story_complete(
                prompt=prompt,
                model=workflow.model,
                temperature=workflow.temperature,
                top_p=workflow.top_p,
                system_prompt="You are an expert story planner. Generate detailed characters and settings in the specified JSON format.",
            )

            # Parse the response to extract characters and settings
            characters, settings = self._parse_characters_settings_response(response)

            # Update workflow
            workflow.characters = characters
            workflow.settings = settings
            workflow.current_step = WorkflowStep.OUTLINE
            workflow.updated_at = datetime.now()

            logger.info(
                f"Generated {len(characters)} characters and settings for workflow {workflow_id}"
            )

        except Exception as e:
            logger.error(
                f"Failed to generate characters/settings for workflow {workflow_id}: {e}"
            )
            raise

        return workflow

    async def generate_outline(
        self,
        workflow_id: str,
        target_chapters: Optional[int] = None,
        additional_instructions: Optional[str] = None,
    ) -> StoryWorkflow:
        """Step 2: Generate story outline"""
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        if not workflow.characters or not workflow.settings:
            raise ValueError("Characters and settings must be generated first")

        # Create the prompt for outline generation
        prompt = self._build_outline_prompt(
            workflow, target_chapters, additional_instructions
        )

        try:
            # Generate outline using AI
            response = await ollama_service.generate_story_complete(
                prompt=prompt,
                model=workflow.model,
                temperature=workflow.temperature,
                top_p=workflow.top_p,
                system_prompt="You are an expert story outliner. Create a detailed story outline in the specified JSON format.",
            )

            # Parse the response to extract outline
            outline = self._parse_outline_response(response)

            # Update workflow
            workflow.outline = outline
            workflow.total_chapters_planned = len(outline.chapters)
            workflow.current_step = WorkflowStep.CHAPTER_GENERATION
            workflow.updated_at = datetime.now()

            logger.info(
                f"Generated outline with {len(outline.chapters)} chapters for workflow {workflow_id}"
            )

        except Exception as e:
            logger.error(f"Failed to generate outline for workflow {workflow_id}: {e}")
            raise

        return workflow

    async def generate_chapter(
        self,
        workflow_id: str,
        chapter_number: int,
        additional_instructions: Optional[str] = None,
    ) -> StoryWorkflow:
        """Step 3: Generate a specific chapter (outline, dialogue, then content)"""
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        if not workflow.outline:
            raise ValueError("Story outline must be generated first")

        if chapter_number > len(workflow.outline.chapters):
            raise ValueError(f"Chapter {chapter_number} not found in outline")

        chapter_outline = workflow.outline.chapters[chapter_number - 1]

        try:
            # Step 3a: Generate detailed chapter outline
            outline_response = await self._generate_chapter_outline(
                workflow, chapter_outline, additional_instructions
            )

            # Step 3b: Generate dialogue for the chapter
            dialogue_response = await self._generate_chapter_dialogue(
                workflow, chapter_outline, outline_response
            )

            # Step 3c: Generate final chapter content
            content_response = await self._generate_chapter_content(
                workflow, chapter_outline, outline_response, dialogue_response
            )

            # Create the chapter object
            generated_chapter = GeneratedChapter(
                chapter_number=chapter_number,
                title=chapter_outline.title,
                outline=outline_response,
                dialogue=dialogue_response,
                content=content_response,
                word_count=len(content_response.split()),
            )

            # Update or add chapter to workflow
            existing_chapter_index = next(
                (
                    i
                    for i, ch in enumerate(workflow.chapters)
                    if ch.chapter_number == chapter_number
                ),
                None,
            )

            if existing_chapter_index is not None:
                workflow.chapters[existing_chapter_index] = generated_chapter
            else:
                workflow.chapters.append(generated_chapter)
                workflow.chapters_completed += 1

            workflow.updated_at = datetime.now()

            logger.info(
                f"Generated chapter {chapter_number} for workflow {workflow_id}"
            )

        except Exception as e:
            logger.error(
                f"Failed to generate chapter {chapter_number} for workflow {workflow_id}: {e}"
            )
            raise

        return workflow

    async def generate_all_chapters_stream(
        self,
        workflow_id: str,
        additional_instructions: Optional[str] = None,
        validation_threshold: Optional[float] = None,
    ):
        """Generate all remaining chapters in sequence with progress updates"""
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        if not workflow.outline:
            raise ValueError("Story outline must be generated first")

        # Use provided threshold or default
        if validation_threshold is None:
            validation_threshold = settings.DEFAULT_VALIDATION_THRESHOLD

        total_chapters = len(workflow.outline.chapters)
        max_regeneration_attempts = 3  # Maximum times to regenerate a chapter

        # Get chapters that haven't been generated yet
        existing_chapter_numbers = {ch.chapter_number for ch in workflow.chapters}
        chapters_to_generate = [
            ch
            for ch in workflow.outline.chapters
            if ch.chapter_number not in existing_chapter_numbers
        ]

        if not chapters_to_generate:
            yield {
                "type": "complete",
                "message": "All chapters have already been generated",
                "workflow": workflow.model_dump(),
            }
            return

        # Generate each chapter with validation and regeneration
        for i, chapter_outline in enumerate(chapters_to_generate):
            chapter_number = chapter_outline.chapter_number
            regeneration_attempts = 0
            chapter_completed = False

            while (
                not chapter_completed
                and regeneration_attempts <= max_regeneration_attempts
            ):
                attempt_label = (
                    f" (attempt {regeneration_attempts + 1})"
                    if regeneration_attempts > 0
                    else ""
                )

                yield {
                    "type": "progress",
                    "chapter_number": chapter_number,
                    "chapter_title": chapter_outline.title,
                    "current": i + 1,
                    "total": len(chapters_to_generate),
                    "status": "generating",
                    "attempt": regeneration_attempts + 1,
                    "message": f"Generating Chapter {chapter_number}: {chapter_outline.title}{attempt_label}",
                }

                try:
                    # Generate the chapter using existing method
                    workflow = await self.generate_chapter(
                        workflow_id=workflow_id,
                        chapter_number=chapter_number,
                        additional_instructions=additional_instructions,
                    )

                    # Validate the chapter
                    yield {
                        "type": "progress",
                        "chapter_number": chapter_number,
                        "chapter_title": chapter_outline.title,
                        "current": i + 1,
                        "total": len(chapters_to_generate),
                        "status": "validating",
                        "attempt": regeneration_attempts + 1,
                        "message": f"Validating Chapter {chapter_number}: {chapter_outline.title}",
                    }

                    workflow = await self.validate_chapter(
                        workflow_id=workflow_id, chapter_number=chapter_number
                    )

                    chapter = next(
                        ch
                        for ch in workflow.chapters
                        if ch.chapter_number == chapter_number
                    )
                    validation_score = chapter.validation_score or 0.0

                    if validation_score >= validation_threshold:
                        # Chapter passed validation
                        yield {
                            "type": "progress",
                            "chapter_number": chapter_number,
                            "chapter_title": chapter_outline.title,
                            "current": i + 1,
                            "total": len(chapters_to_generate),
                            "status": "completed",
                            "validation_score": validation_score,
                            "validation_threshold": validation_threshold,
                            "attempts": regeneration_attempts + 1,
                            "message": f"Completed Chapter {chapter_number}: {chapter_outline.title} (Score: {validation_score:.2f})",
                            "word_count": chapter.word_count,
                        }
                        chapter_completed = True
                    else:
                        # Chapter failed validation
                        regeneration_attempts += 1
                        if regeneration_attempts <= max_regeneration_attempts:
                            yield {
                                "type": "progress",
                                "chapter_number": chapter_number,
                                "chapter_title": chapter_outline.title,
                                "current": i + 1,
                                "total": len(chapters_to_generate),
                                "status": "regenerating",
                                "validation_score": validation_score,
                                "validation_threshold": validation_threshold,
                                "attempt": regeneration_attempts,
                                "message": f"Chapter {chapter_number} scored {validation_score:.2f} (below {validation_threshold:.2f}). Regenerating...",
                            }
                        else:
                            # Max attempts reached
                            yield {
                                "type": "warning",
                                "chapter_number": chapter_number,
                                "chapter_title": chapter_outline.title,
                                "current": i + 1,
                                "total": len(chapters_to_generate),
                                "status": "completed_with_warning",
                                "validation_score": validation_score,
                                "validation_threshold": validation_threshold,
                                "attempts": regeneration_attempts,
                                "message": f"Chapter {chapter_number} completed with low score {validation_score:.2f} after {max_regeneration_attempts} attempts",
                                "word_count": chapter.word_count,
                            }
                            chapter_completed = True

                except Exception as e:
                    logger.error(
                        f"Failed to generate/validate chapter {chapter_number}: {e}"
                    )
                    regeneration_attempts += 1
                    if regeneration_attempts <= max_regeneration_attempts:
                        yield {
                            "type": "progress",
                            "chapter_number": chapter_number,
                            "chapter_title": chapter_outline.title,
                            "current": i + 1,
                            "total": len(chapters_to_generate),
                            "status": "retrying",
                            "attempt": regeneration_attempts,
                            "message": f"Error generating Chapter {chapter_number}, retrying... ({str(e)})",
                        }
                    else:
                        yield {
                            "type": "error",
                            "chapter_number": chapter_number,
                            "chapter_title": chapter_outline.title,
                            "current": i + 1,
                            "total": len(chapters_to_generate),
                            "status": "failed",
                            "attempts": regeneration_attempts,
                            "message": f"Failed to generate Chapter {chapter_number} after {max_regeneration_attempts} attempts: {str(e)}",
                        }
                        return

        # All chapters completed
        yield {
            "type": "complete",
            "message": f"Successfully generated all {len(chapters_to_generate)} remaining chapters",
            "total_chapters": total_chapters,
            "workflow": workflow.model_dump(),
        }

    async def validate_chapter(
        self, workflow_id: str, chapter_number: int
    ) -> StoryWorkflow:
        """Step 4: Validate chapter against outline"""
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        chapter = next(
            (ch for ch in workflow.chapters if ch.chapter_number == chapter_number),
            None,
        )

        if not chapter:
            raise ValueError(f"Chapter {chapter_number} not found")

        outline_chapter = workflow.outline.chapters[chapter_number - 1]

        try:
            # Create validation prompt
            prompt = self._build_validation_prompt(outline_chapter, chapter)

            # Get AI validation
            response = await ollama_service.generate_story_complete(
                prompt=prompt,
                model=workflow.model,
                temperature=0.3,  # Lower temperature for more consistent validation
                top_p=workflow.top_p,
                system_prompt="You are an expert story editor. Analyze how well the chapter matches the outline and provide constructive feedback.",
            )

            # Parse validation response
            score, feedback = self._parse_validation_response(response)

            # Update chapter with validation results
            chapter.validation_score = score
            chapter.validation_feedback = feedback
            workflow.updated_at = datetime.now()

            logger.info(
                f"Validated chapter {chapter_number} for workflow {workflow_id} - Score: {score}"
            )

        except Exception as e:
            logger.error(
                f"Failed to validate chapter {chapter_number} for workflow {workflow_id}: {e}"
            )
            raise

        return workflow

    def _build_characters_settings_prompt(
        self, original_prompt: str, additional_instructions: Optional[str] = None
    ) -> str:
        """Build prompt for character and settings generation"""
        prompt = f"""Based on this story idea: "{original_prompt}"

Create detailed characters and story settings. Return your response as a JSON object with this structure:

{{
  "characters": [
    {{
      "name": "Character Name",
      "description": "Detailed character description and traits",
      "role": "protagonist/antagonist/supporting",
      "background": "Character's background and history",
      "motivations": "Character's goals and motivations",
      "relationships": {{"other_character": "relationship description"}}
    }}
  ],
  "settings": {{
    "genre": "Story genre",
    "setting": "Time and place description",
    "tone": "Overall tone and mood",
    "themes": ["theme1", "theme2"],
    "world_building": "Additional world details",
    "target_length": "short/medium/long"
  }}
}}

Focus on creating compelling, well-developed characters with clear motivations and relationships. The settings should support the story's themes and provide a rich backdrop for the narrative.

{additional_instructions or ""}

Respond ONLY with valid JSON."""

        return prompt

    def _build_outline_prompt(
        self,
        workflow: StoryWorkflow,
        target_chapters: Optional[int],
        additional_instructions: Optional[str] = None,
    ) -> str:
        """Build prompt for outline generation"""
        characters_summary = "\n".join(
            [
                f"- {char.name}: {char.description} ({char.role})"
                for char in workflow.characters
            ]
        )
        settings_info = f"Genre: {workflow.settings.genre}, Setting: {workflow.settings.setting}, Tone: {workflow.settings.tone}"

        prompt = f"""Create a detailed story outline based on:

Original Idea: "{workflow.original_prompt}"

Characters:
{characters_summary}

Settings: {settings_info}
Themes: {', '.join(workflow.settings.themes)}

Target Chapters: {target_chapters or 'flexible'}

Return your response as a JSON object with this structure:

{{
  "title": "Story Title",
  "premise": "Core story premise",
  "plot_structure": "Overall plot structure and arc",
  "chapters": [
    {{
      "chapter_number": 1,
      "title": "Chapter Title",
      "summary": "Brief chapter summary",
      "key_events": ["event1", "event2"],
      "characters_involved": ["character1", "character2"],
      "purpose": "Purpose of this chapter in the overall story"
    }}
  ],
  "estimated_word_count": 50000
}}

Create a compelling story arc with proper pacing, character development, and thematic exploration.

{additional_instructions or ""}

Respond ONLY with valid JSON."""

        return prompt

    async def _generate_chapter_outline(
        self,
        workflow: StoryWorkflow,
        chapter_outline: ChapterOutline,
        additional_instructions: Optional[str] = None,
    ) -> str:
        """Generate detailed outline for a specific chapter"""
        prompt = f"""Create a detailed outline for this chapter:

Chapter {chapter_outline.chapter_number}: {chapter_outline.title}
Summary: {chapter_outline.summary}
Key Events: {', '.join(chapter_outline.key_events)}
Characters: {', '.join(chapter_outline.characters_involved)}
Purpose: {chapter_outline.purpose}

Story Context:
- Genre: {workflow.settings.genre}
- Setting: {workflow.settings.setting}
- Tone: {workflow.settings.tone}

Available Characters:
{chr(10).join([f"- {char.name}: {char.description}" for char in workflow.characters])}

Create a detailed scene-by-scene outline for this chapter. Include:
- Opening scene setup
- Character interactions and development
- Plot progression
- Emotional beats
- Transition to next chapter

{additional_instructions or ""}

Write a comprehensive outline that serves as a blueprint for the chapter."""

        return await ollama_service.generate_story_complete(
            prompt=prompt,
            model=workflow.model,
            temperature=workflow.temperature,
            top_p=workflow.top_p,
            system_prompt="You are an expert chapter outliner. Create detailed, scene-by-scene chapter outlines. Output only the outline content without any headers or explanatory text.",
        )

    async def _generate_chapter_dialogue(
        self,
        workflow: StoryWorkflow,
        chapter_outline: ChapterOutline,
        detailed_outline: str,
    ) -> str:
        """Generate dialogue for the chapter"""
        prompt = f"""Based on this chapter outline:

{detailed_outline}

Characters in this chapter:
{chr(10).join([f"- {char.name}: {char.description}" for char in workflow.characters if char.name in chapter_outline.characters_involved])}

Create engaging dialogue for this chapter. Focus on:
- Character voice and personality
- Natural conversation flow
- Emotional subtext
- Plot advancement through dialogue
- Character relationships and dynamics

Present the dialogue in script format with character names and their lines."""

        return await ollama_service.generate_story_complete(
            prompt=prompt,
            model=workflow.model,
            temperature=workflow.temperature,
            top_p=workflow.top_p,
            system_prompt="You are an expert dialogue writer. Create realistic, engaging dialogue that advances character and plot. Output only the dialogue content without any headers or explanatory text.",
        )

    async def _generate_chapter_content(
        self,
        workflow: StoryWorkflow,
        chapter_outline: ChapterOutline,
        detailed_outline: str,
        dialogue: str,
    ) -> str:
        """Generate final chapter content"""
        prompt = f"""Write the complete chapter based on:

Chapter Outline:
{detailed_outline}

Key Dialogue:
{dialogue}

Story Details:
- Genre: {workflow.settings.genre}
- Setting: {workflow.settings.setting}
- Tone: {workflow.settings.tone}

Write a complete, polished chapter that:
- Incorporates the outlined scenes and events
- Uses the dialogue naturally within narrative
- Maintains consistent tone and style
- Develops characters and advances plot
- Engages the reader with vivid descriptions
- Flows smoothly from previous chapters

Aim for approximately 2000-4000 words.

IMPORTANT: Output ONLY the story content. Do not include:
- Chapter titles or headers
- Introductory text like "Here is the chapter:" or "Chapter X:"
- Explanatory notes or comments
- Outro text or summaries
- Any text that is not part of the actual story narrative

Start immediately with the story content and end when the chapter naturally concludes."""

        return await ollama_service.generate_story_complete(
            prompt=prompt,
            model=workflow.model,
            temperature=workflow.temperature,
            top_p=workflow.top_p,
            system_prompt="You are an expert novelist. Write engaging, well-crafted chapters with rich description and compelling narrative. Output only the story content without any headers, titles, or explanatory text.",
        )

    def _build_validation_prompt(
        self, outline_chapter: ChapterOutline, generated_chapter: GeneratedChapter
    ) -> str:
        """Build prompt for chapter validation"""
        prompt = f"""Analyze how well this generated chapter matches its intended outline:

INTENDED OUTLINE:
Title: {outline_chapter.title}
Summary: {outline_chapter.summary}
Key Events: {', '.join(outline_chapter.key_events)}
Characters: {', '.join(outline_chapter.characters_involved)}
Purpose: {outline_chapter.purpose}

GENERATED CHAPTER:
{generated_chapter.content}

Evaluate the chapter on:
1. How well it follows the outlined plot points
2. Character consistency and development
3. Achievement of the chapter's purpose
4. Overall quality and engagement

Provide a score from 0.0 to 1.0 and detailed feedback.

Format your response as:
SCORE: [0.0-1.0]
FEEDBACK: [Detailed analysis and suggestions for improvement]"""

        return prompt

    def _parse_characters_settings_response(
        self, response: str
    ) -> Tuple[List[Character], StorySettings]:
        """Parse AI response to extract characters and settings"""
        try:
            # Try to find JSON in the response
            start = response.find("{")
            end = response.rfind("}") + 1
            if start != -1 and end != 0:
                json_str = response[start:end]
                data = json.loads(json_str)

                # Parse characters
                characters = [
                    Character(**char_data) for char_data in data.get("characters", [])
                ]

                # Parse settings
                settings_data = data.get("settings", {})
                settings = StorySettings(**settings_data)

                return characters, settings
            else:
                raise ValueError("No valid JSON found in response")

        except Exception as e:
            logger.error(f"Failed to parse characters/settings response: {e}")
            # Fallback: create basic character and settings
            characters = [
                Character(
                    name="Main Character",
                    description="The protagonist of the story",
                    role="protagonist",
                )
            ]
            settings = StorySettings(
                genre="Fiction", setting="Contemporary", tone="Engaging"
            )
            return characters, settings

    def _parse_outline_response(self, response: str) -> StoryOutline:
        """Parse AI response to extract story outline"""
        try:
            # Try to find JSON in the response
            start = response.find("{")
            end = response.rfind("}") + 1
            if start != -1 and end != 0:
                json_str = response[start:end]
                data = json.loads(json_str)

                # Parse chapters
                chapters_data = data.get("chapters", [])
                chapters = [
                    ChapterOutline(**chapter_data) for chapter_data in chapters_data
                ]

                outline = StoryOutline(
                    title=data.get("title", "Untitled Story"),
                    premise=data.get("premise", ""),
                    plot_structure=data.get("plot_structure", ""),
                    chapters=chapters,
                    estimated_word_count=data.get("estimated_word_count"),
                )

                return outline

        except Exception as e:
            logger.error(f"Failed to parse outline response: {e}")
            # Fallback: create basic outline
            return StoryOutline(
                title="Untitled Story",
                premise="A story premise",
                plot_structure="Basic three-act structure",
                chapters=[
                    ChapterOutline(
                        chapter_number=1,
                        title="Chapter 1",
                        summary="Opening chapter",
                        purpose="Introduce the story and characters",
                    )
                ],
            )

    def _parse_validation_response(self, response: str) -> Tuple[float, str]:
        """Parse validation response to extract score and feedback"""
        try:
            lines = response.strip().split("\n")
            score = 0.8  # Default score
            feedback = response

            for line in lines:
                if line.startswith("SCORE:"):
                    score_str = line.replace("SCORE:", "").strip()
                    score = float(score_str)
                elif line.startswith("FEEDBACK:"):
                    feedback = line.replace("FEEDBACK:", "").strip()
                    # Get remaining lines as part of feedback
                    remaining_lines = lines[lines.index(line) + 1 :]
                    if remaining_lines:
                        feedback += "\n" + "\n".join(remaining_lines)
                    break

            return score, feedback

        except Exception as e:
            logger.error(f"Failed to parse validation response: {e}")
            return 0.7, response


# Global instance
story_workflow_service = StoryWorkflowService()
