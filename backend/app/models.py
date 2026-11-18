from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ModuleNode(BaseModel):
    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    source_pages: List[int] = Field(default_factory=list)

    @field_validator("source_pages")
    @classmethod
    def _non_negative(cls, v: List[int]) -> List[int]:
        if any(p < 1 for p in v):
            raise ValueError("source_pages must be >= 1")
        return v


class RoadmapSchema(BaseModel):
    modules: List[ModuleNode] = Field(default_factory=list)


class Flashcard(BaseModel):
    term: str
    definition: str


class SummarySchema(BaseModel):
    executive_overview: str = Field(..., max_length=600)
    chapter_breakdown: str
    flashcards: List[Flashcard] = Field(default_factory=list)


class Chunk(BaseModel):
    page_number: int
    content: str


class DocumentRecord(BaseModel):
    document_id: str
    chunks: List[Chunk] = Field(default_factory=list)
