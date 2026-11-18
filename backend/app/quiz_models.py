from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class QuizOption(BaseModel):
    text: str


class QuizQuestion(BaseModel):
    question: str
    type: Literal["mcq", "true_false", "fill_blank"]
    options: List[str] = Field(default_factory=list)
    correct_answer: str
    explanation: str


class QuizSchema(BaseModel):
    questions: List[QuizQuestion] = Field(default_factory=list)
