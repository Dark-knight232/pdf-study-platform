from __future__ import annotations

import json
import logging
from typing import Any, Dict

from openai import AsyncOpenAI, APIError, RateLimitError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from .config import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.nim_api_key, base_url=settings.nim_api_base_url)
    return _client


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=20),
    retry=retry_if_exception_type((RateLimitError, APIError)),
    reraise=True,
)
async def chat_json(system: str, user: str) -> Dict[str, Any]:
    client = get_client()
    resp = await client.chat.completions.create(
        model=settings.nim_model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    content = resp.choices[0].message.content or "{}"
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        logger.error("Malformed JSON from LLM: %s", content[:500])
        raise ValueError(f"LLM returned malformed JSON: {exc}") from exc
