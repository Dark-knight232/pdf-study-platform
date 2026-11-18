from __future__ import annotations

import logging
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .quiz_models import QuizSchema, QuizQuestion
from .models import Chunk
from .db import DocumentChunk, QuizQuestionRow
from .llm import chat_json
from .synthesis import _budget_chunks, load_chunks

logger = logging.getLogger(__name__)

QUIZ_SYSTEM = (
    "You are a quiz generator. Return JSON with key 'questions', an array of 10 objects. "
    "Each: question (string), type (mcq|true_false|fill_blank), options (array of 4 strings for mcq, "
    "[\"True\",\"False\"] for true_false, [] for fill_blank), correct_answer (string matching one option or answer), "
    "explanation (string). Return ONLY valid JSON."
)


async def generate_quiz(session: AsyncSession, document_id: str) -> QuizSchema:
    chunks = await load_chunks(session, document_id)
    if not chunks:
        raise ValueError("No chunks found for document")
    context = _budget_chunks(chunks)
    raw = await chat_json(QUIZ_SYSTEM, f"Generate 10 diverse questions from:\n{context}")
    quiz = QuizSchema.model_validate(raw)

    await session.execute(QuizQuestionRow.__table__.delete().where(QuizQuestionRow.document_id == document_id))
    for q in quiz.questions:
        session.add(QuizQuestionRow(
            document_id=document_id,
            question=q.question,
            qtype=q.type,
            options=q.options,
            correct_answer=q.correct_answer,
            explanation=q.explanation,
        ))
    await session.commit()
    return quiz
