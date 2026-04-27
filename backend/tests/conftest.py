import asyncio
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Patch SQLite compiler to handle PostgreSQL UUID type as CHAR(36).
# Necessary because models use postgresql.UUID(as_uuid=True) and tests run on SQLite.
SQLiteTypeCompiler.visit_UUID = lambda self, type_, **kw: "CHAR(36)"

from app.core.config import settings  # noqa: E402
# CNPJ da empresa para validação de direção da NF-e (mesmo das fixtures)
settings.EMPRESA_CNPJ = "53428953000111"

from app.db.database import Base, get_db  # noqa: E402
from app.api.deps import get_current_admin_user  # noqa: E402
from app.main import app  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402


# Importar todos os models para registrar no metadata
from app.models import (  # noqa: F401, E402
    usuario, cliente, peca, ordem_producao, fornecedor,
    conta_receber, conta_pagar, lancamento, nota_fiscal,
)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    SessionLocal = async_sessionmaker(bind=db_engine, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> Usuario:
    user = Usuario(
        id=uuid.uuid4(),
        email="admin@test.com",
        password_hash="x",
        first_name="Admin",
        last_name="Test",
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def client(db_session: AsyncSession, admin_user: Usuario) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    async def override_admin():
        return admin_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_admin_user] = override_admin

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
