import os
import sys
import uvicorn
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.api.portfolio import router as portfolio_router
from src.api.projects import router as projects_router
from src.api.deviations import router as deviations_router
from src.api.ingestion import router as ingestion_router
from src.api.nlp import router as nlp_router
from src.api.planning import router as planning_router

# Initialize DB on startup
from src.database.db import get_engine
get_engine()

app = FastAPI(
    title="Project Portfolio Consolidator",
    description="MS Project portfolio analysis, red-line tracking, and NL querying",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# API routers (must be registered BEFORE the SPA catch-all)
app.include_router(portfolio_router)
app.include_router(projects_router)
app.include_router(deviations_router)
app.include_router(ingestion_router)
app.include_router(nlp_router)
app.include_router(planning_router)

# Serve React SPA from frontend/dist/ (production build)
SPA_DIR = os.path.join(BASE_DIR, "frontend", "dist")

if os.path.isdir(SPA_DIR):
    # Serve static assets (JS, CSS, images) from Vite build
    assets_dir = os.path.join(SPA_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="spa-assets")

    # Serve any other static files in dist root (favicon, etc.)
    @app.get("/vite.svg")
    async def vite_svg():
        return FileResponse(os.path.join(SPA_DIR, "vite.svg"))

    # SPA catch-all: return index.html for all non-API routes
    # This allows React Router to handle client-side routing
    @app.get("/{path:path}")
    async def spa_catch_all(request: Request, path: str):
        # Don't serve index.html for API routes (already handled above)
        if path.startswith("api/"):
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "Not found"}, status_code=404)
        return FileResponse(os.path.join(SPA_DIR, "index.html"))
else:
    # Fallback: no React build found, show helpful message
    @app.get("/")
    async def no_build():
        return {
            "message": "React frontend not built yet.",
            "instructions": "Run: cd frontend && npm install && npm run build",
            "api_docs": "/docs",
        }


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
