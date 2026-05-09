from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, portfolio, tax, advisor, upload, alerts, export, b2b
from app.api.websocket import router as ws_router

app = FastAPI(
    title="TaxOptimizer India API",
    description="AI-powered tax optimizer for Indian retail investors",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(tax.router,       prefix="/api/tax",       tags=["tax"])
app.include_router(advisor.router,   prefix="/api/advisor",   tags=["advisor"])
app.include_router(upload.router,    prefix="/api/upload",    tags=["upload"])
app.include_router(alerts.router,    prefix="/api/alerts",    tags=["alerts"])
app.include_router(export.router,    prefix="/api/export",    tags=["export"])
app.include_router(b2b.router,       prefix="/api/b2b",       tags=["b2b"])
app.include_router(ws_router)

@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
