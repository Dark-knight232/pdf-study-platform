from __future__ import annotations

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session, Base, engine
from .synthesis import generate_roadmap, generate_summary
from .quiz import generate_quiz
from .quiz_models import QuizSchema

app = FastAPI(title="Knowledge Synthesis Engine", version="1.0.0")


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.post("/api/v1/documents/{document_id}/roadmap", response_model=RoadmapSchema)
async def roadmap(document_id: str, session: AsyncSession = Depends(get_session)):
    try:
        return await generate_roadmap(session, document_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM/processing error: {e}")


@app.post("/api/v1/documents/{document_id}/summary", response_model=SummarySchema)
async def summary(document_id: str, session: AsyncSession = Depends(get_session)):
    try:
        return await generate_summary(session, document_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM/processing error: {e}")


@app.post("/api/v1/documents/{document_id}/quiz", response_model=QuizSchema)
async def quiz(document_id: str, session: AsyncSession = Depends(get_session)):
    try:
        return await generate_quiz(session, document_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM/processing error: {e}")
async def health():
    return {"status": "ok"}
