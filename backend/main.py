import os
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pdf-study")

# In-memory cache: document_id -> {pages: [str], "filename": str}
DOC_CACHE: Dict[str, Dict[str, Any]] = {}

app = FastAPI(title="PDF Study API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/v1/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    import fitz as fitz_lib

    # MIME validation
    if file.content_type not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=400,
                            detail="ERROR // INVALID MIME TYPE [EXPECTED: application/pdf]")

    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413,
                            detail="ERROR // FILE EXCEEDS 15MB LIMIT")

    # Extract page text client-side
    try:
        doc = fitz_lib.open(stream=data, filetype="pdf")
        page_count = doc.page_count
        if page_count > 20:
            raise HTTPException(status_code=422,
                                detail=f"ERROR // EXCEEDS 20-PAGE LIMIT [DETECTED: {page_count} PAGES]")
        pages_text: List[str] = []
        for i, page in enumerate(doc):
            pages_text.append(page.get_text().strip())
        doc.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422,
                            detail=f"ERROR // PDF PARSE FAILED [{e}]")

    # Store in cache and upload to Supabase
    document_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    DOC_CACHE[document_id] = {"pages": pages_text, "filename": file.filename or "document.pdf"}

    try:
        from supabase import create_client

        supabase = create_client(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_KEY", "")
        )
        # Upload PDF
        pdf_path = f"{document_id}/{file.filename or 'document.pdf'}"
        supabase.storage.from_("raw_pdfs").upload(pdf_path, data,
                                                   {"content-type": "application/pdf"})
        # Upload extracted text JSON
        text_path = f"{document_id}/text.json"
        supabase.storage.from_("raw_pdfs").upload(text_path, json.dumps({"pages": pages_text}).encode(),
                                                     {"content-type": "application/json"})
    except Exception as e:
        logger.warning(f"Supabase upload warning: {e}")

    return {"job_id": document_id, "document_id": document_id, "status": "COMPLETED",
            "page_count": page_count, "filename": file.filename or "document.pdf"}


@app.get("/api/v1/documents/{document_id}/status")
async def document_status(document_id: str):
    row = DOC_CACHE.get(document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"document_id": document_id, "status": "COMPLETED", "progress": 100.0,
            "stage": "ingestion_complete", "page_count": row["pages"] if row.get("pages") else 0,
            "filename": row.get("filename", "document.pdf")}


# ---- LLM helper -------------------------------------------------------

async def _call_llm(system: str, user: str) -> Optional[dict]:
    import httpx

    api_key = os.getenv("LLM_API_KEY", "")
    if not api_key:
        logger.error("LLM_API_KEY not set")
        return None
    base_url = os.getenv("LLM_API_BASE_URL",
                         "https://integrate.api.nvidia.com/v1")
    model = os.getenv("LLM_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model,
                      "messages": [{"role": "system", "content": system},
                                   {"role": "user", "content": user}],
                      "response_format": {"type": "json_object"},
                      "temperature": 0.2},
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            return json.loads(raw)
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        return None


# ---- Roadmap endpoint ------------------------------------------------ --

@app.post("/api/v1/documents/{document_id}/roadmap")
async def roadmap(document_id: str):
    cache = DOC_CACHE.get(document_id)
    if not cache:
        raise HTTPException(status_code=404, detail="Document not found")

    pages_context = "\n\n".join([f"[PAGE {i+1}] {c}" for i, c in enumerate(cache.get("pages", []))])

    system = ("You are a curriculum architect. Given document chunks, produce a JSON object "
              "with key 'modules', an array of objects with fields: id (string like mod_1), "
              "title, description, source_pages (array of page numbers). Return ONLY valid JSON.")

    user = f"Document chunks:\n{pages_context}"

    raw = await _call_llm(system, user)
    if not raw:
        # Fallback stub: one module from filename
        return {"modules": [{"id": "mod_1", "title": "Introduction",
                             "description": f"Overview of {cache.get('filename', 'document')}",
                             "source_pages": [1]}]}

    # Ensure modules is a list
    modules = raw.get("modules", [])
    if isinstance(modules, dict):
        modules = [modules]
    # Normalise source_pages to list of ints
    for m in modules:
        if "source_pages" in m and not isinstance(m["source_pages"], list):
            m["source_pages"] = [m["source_pages"]]
    return {"modules": modules}


# ---- Summary endpoint ------------------------------------------------ --

@app.post("/api/v1/documents/{document_id}/summary")
async def summary(document_id: str):
    cache = DOC_CACHE.get(document_id)
    if not cache:
        raise HTTPException(status_code=404, detail="Document not found")

    pages_context = "\n\n".join([f"[PAGE {i+1}] {c}" for i, c in enumerate(cache.get("pages", []))])

    system = ("You are an expert synthesizer. Return JSON with keys: executive_overview "
              "(<=3 sentences), chapter_breakdown (markdown string), flashcards (array of {term, definition}). "
              "Return ONLY valid JSON.")

    user = f"Document chunks:\n{pages_context}"

    raw = await _call_llm(system, user)
    if not raw:
        # Fallback stub
        return {"executive_overview": f"Summary of {cache.get('filename', 'document')}: "
                "Document processed with client-side validation and extraction.",
                "chapter_breakdown": "# " + cache.get('filename', 'Document') + "\n\nExtracted content.",
                "flashcards": [{"term": "Key Term", "definition": "Definition from document"}]}

    # Normalise flashcards
    fc = raw.get("flashcards", [])
    if isinstance(fc, dict):
        fc = [fc]
    return {"executive_overview": raw.get("executive_overview", ""),
            "chapter_breakdown": raw.get("chapter_breakdown", ""),
            "flashcards": fc}


# ---- Quiz endpoint ------------------------------------------------- --

@app.post("/api/v1/documents/{document_id}/quiz")
async def quiz(document_id: str):
    cache = DOC_CACHE.get(document_id)
    if not cache:
        raise HTTPException(status_code=404, detail="Document not found")

    pages_context = "\n\n".join([f"[PAGE {i+1}] {c}" for i, c in enumerate(cache.get("pages", []))])

    system = ("You are a quiz generator. Return JSON with key 'questions', an array of 10 objects. "
              "Each: question (string), type (mcq|true_false|fill_blank), options (array of 4 strings for mcq, "
              "[\"True\",\"False\"] for true_false, [] for fill_blank), correct_answer (string matching one option or answer), "
              "explanation (string). Return ONLY valid JSON.")

    user = f"Generate 10 diverse questions from:\n{pages_context}"

    raw = await _call_llm(system, user)
    if not raw:
        # Fallback stub: 10 simple questions
        questions = []
        for i in range(10):
            qtype = ["mcq", "true_false", "fill_blank"][i % 3]
            if qtype == "mcq":
                questions.append({
                    "question": f"Question {i+1} about the document?",
                    "type": "mcq",
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": "A",
                    "explanation": "Sample explanation."
                })
            elif qtype == "true_false":
                questions.append({
                    "question": f"Statement {i+1} is true or false?",
                    "type": "true_false",
                    "options": ["True", "False"],
                    "correct_answer": "True",
                    "explanation": "Sample explanation."
                })
            else:
                questions.append({
                    "question": f"Fill in the blank {i+1}: ...",
                    "type": "fill_blank",
                    "options": [],
                    "correct_answer": "answer",
                    "explanation": "Sample explanation."
                })
        return {"questions": questions}

    # Ensure questions is a list
    questions = raw.get("questions", [])
    if isinstance(questions, dict):
        questions = [questions]
    return {"questions": questions}