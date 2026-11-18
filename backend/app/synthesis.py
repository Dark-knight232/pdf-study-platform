from __future__ import annotations

import logging
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Chunk, RoadmapSchema, SummarySchema
from .db import DocumentChunk, RoadmapNode, SummaryRecord
from .llm import chat_json
from .config import settings

logger = logging.getLogger(__name__)

ROADMAP_SYSTEM = (
    "You are a curriculum architect. Given document chunks, produce a JSON object with key "
    "'modules', an array of objects with fields: id (string like mod_1), title, description, "
    "source_pages (array of page numbers). Return ONLY valid JSON."
)

SUMMARY_SYSTEM = (
    "You are an expert synthesizer. Return JSON with keys: executive_overview (<=3 sentences), "
    "chapter_breakdown (markdown string), flashcards (array of {term, definition}). Return ONLY valid JSON."
)


def _budget_chunks(chunks: List[Chunk]) -> str:
    parts = []
    used = 0
    for c in chunks:
        text = f"[PAGE {c.page_number}] {c.content}"
        if used + len(text) > settings.max_context_tokens * 4:
            break
        parts.append(text)
        used += len(text)
    return "\n\n".join(parts)


async def load_chunks(session: AsyncSession, document_id: str) -> List[Chunk]:
    res = await session.execute(
        select(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    rows = res.scalars().all()
    return [Chunk(page_number=r.page_number, content=r.content) for r in rows]


async def generate_roadmap(session: AsyncSession, document_id: str) -> RoadmapSchema:
    chunks = await load_chunks(session, document_id)
    if not chunks:
        raise ValueError("No chunks found for document")
    context = _budget_chunks(chunks)
    raw = await chat_json(ROADMAP_SYSTEM, f"Document chunks:\n{context}")
    roadmap = RoadmapSchema.model_validate(raw)

    # persist
    await session.execute(
        RoadmapNode.__table__.delete().where(RoadmapNode.document_id == document_id)
    )
    for m in roadmap.modules:
        session.add(RoadmapNode(
            document_id=document_id,
            module_id=m.id,
            title=m.title,
            description=m.description,
            source_pages=m.source_pages,
        ))
    await session.commit()
    return roadmap


async def generate_summary(session: AsyncSession, document_id: str) -> SummarySchema:
    chunks = await load_chunks(session, document_id)
    if not chunks:
        raise ValueError("No chunks found for document")
    context = _budget_chunks(chunks)
    raw = await chat_json(SUMMARY_SYSTEM, f"Document chunks:\n{context}")
    summary = SummarySchema.model_validate(raw)

    existing = await session.execute(
        select(SummaryRecord).where(SummaryRecord.document_id == document_id)
    )
    rec = existing.scalar_one_or_none()
    if rec is None:
        rec = SummaryRecord(document_id=document_id)
        session.add(rec)
    rec.executive_overview = summary.executive_overview
    rec.chapter_breakdown = summary.chapter_breakdown
    rec.flashcards = [f.model_dump() for f in summary.flashcards]
    await session.commit()
    return summary
