from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
from pathlib import Path

# Caminho absoluto até o .env, independente de onde o uvicorn é rodado
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"

_WEAK_KEYS = {"change-me-in-production", "secret", "changeme", ""}


class Settings(BaseSettings):
    SECRET_KEY: str  # obrigatório — sem default; falha no startup se não definido
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/usinasoft"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    DEBUG: bool = False  # seguro por padrão; ative explicitamente em dev
    EMPRESA_CNPJ: str = ""  # CNPJ da empresa (14 dígitos, sem máscara) — usado pra validar direção da NF-e

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        if v in _WEAK_KEYS or len(v) < 32:
            raise ValueError(
                "SECRET_KEY deve ser uma string aleatória forte com no mínimo 32 caracteres."
            )
        return v

    @field_validator("EMPRESA_CNPJ")
    @classmethod
    def empresa_cnpj_format(cls, v: str) -> str:
        digits = "".join(c for c in v if c.isdigit())
        if digits and len(digits) != 14:
            raise ValueError("EMPRESA_CNPJ deve ter 14 dígitos.")
        return digits

    class Config:
        env_file = str(ENV_FILE)


settings = Settings()