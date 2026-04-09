from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import (
    auth, usuarios, clientes, pecas, ops,
    fornecedores, contas_receber, contas_pagar, lancamentos, dashboard_financeiro,
)

app = FastAPI(
    title="UsinaSoft v2 API",
    description="ERP system for machining production management",
    version="2.0.0",
    debug=settings.DEBUG,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(usuarios.router, prefix="/api")
app.include_router(clientes.router, prefix="/api")
app.include_router(pecas.router, prefix="/api")
app.include_router(ops.router, prefix="/api")
app.include_router(fornecedores.router, prefix="/api")
app.include_router(contas_receber.router, prefix="/api")
app.include_router(contas_pagar.router, prefix="/api")
app.include_router(lancamentos.router, prefix="/api")
app.include_router(dashboard_financeiro.router, prefix="/api")


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "version": "2.0.0"}
