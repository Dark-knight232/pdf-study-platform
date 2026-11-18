from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import Base, Document, DocumentChunk, engine, get_session
from app.synthesis import generate_roadmap, generate_summary
from app.quiz import generate_quiz
from app.config import settings

app = FastAPI(title="Knowledge Synthesis Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/v1/documents/upload")
async def upload_document(file: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
    if file.content_type not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=400, detail="ERROR // INVALID MIME TYPE [EXPECTED: application/pdf]")

    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="ERROR // FILE EXCEEDS 15MB LIMIT")

    import fitz

    try:
        doc = fitz.open(stream=data, filetype="pdf")
        page_count = doc.page_count
        if page_count > 20:
            raise HTTPException(status_code=422, detail=f"ERROR // EXCEEDS 20-PAGE LIMIT [DETECTED: {page_count} PAGES]")
        texts = []
        for i, page in enumerate(doc):
            texts.append((i + 1, page.get_text()))
        doc.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"ERROR // PDF PARSE FAILED [{e}]")

    document_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    session.add(Document(document_id=document_id, filename=file.filename or "document.pdf",
                         status="COMPLETED", page_count=page_count, created_at=now))
    for page_no, text in texts:
        if text and text.strip():
            session.add(DocumentChunk(document_id=document_id, page_number=page_no, content=text.strip()))
    await session.commit()

    try:
        from supabase import create_client

        supabase = create_client(settings.supabase_url, settings.supabase_key)
        path = f"{document_id}/{file.filename or 'document.pdf'}"
        supabase.storage.from_("raw_pdfs").upload(path, data, {"content-type": "application/pdf"})
    except Exception:
        pass

    return {"job_id": document_id, "document_id": document_id, "status": "COMPLETED",
            "page_count": page_count, "filename": file.filename or "document.pdf"}


@app.get("/api/v1/documents/{document_id}/status")
async def document_status(document_id: str, session: AsyncSession = Depends(get_session)):
    row = (await session.execute(select(Document).where(Document.document_id == document_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    progress = 100.0 if row.status == "COMPLETED" else 0.0
    stage = "ingestion_complete" if row.status == "COMPLETED" else "pending"
    return {"document_id": document_id, "status": row.status, "progress": progress, "stage": stage,
            "page_count": row.page_count, "filename": row.filename}


@app.post("/api/v1/documents/{document_id}/roadmap")
async def roadmap(document_id: str, session: AsyncSession = Depends(get_session)):
    return await generate_roadmap(session, document_id)


@app.post("/api/v1/documents/{document_id}/summary")
async def summary(document_id: str, session: AsyncSession = Depends(get_session)):
    return await generate_summary(session, document_id)


@app.post("/api/v1/documents/{document_id}/quiz")
async def quiz(document_id: str, session: AsyncSession = Depends(get_session)):
    return await generate_quiz(session, document_id)