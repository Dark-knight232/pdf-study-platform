from __future__ import annotations

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    nim_api_key: str = os.getenv("NIM_API_KEY", "")
    nim_api_base_url: str = os.getenv("NIM_API_BASE_URL", "https://integrate.api.nvidia.com/v1")
    nim_model: str = os.getenv("NIM_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")
    database_url: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/study")
    max_context_tokens: int = 6000

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
