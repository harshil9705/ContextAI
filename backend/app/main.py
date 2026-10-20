import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app import database
from app.exceptions import AppError, RateLimitError
from app.services import vectorstore
from app.routes import ingest, items, query

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Knowledge Inbox backend")
    await database.init_db()
    vectorstore.init()
    logger.info("Database and vector store ready")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="AI Knowledge Inbox",
    description="A personal knowledge base with RAG-powered Q&A",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/api", tags=["ingest"])
app.include_router(items.router, prefix="/api", tags=["items"])
app.include_router(query.router, prefix="/api", tags=["query"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    logger.warning("App error on %s %s: %s", request.method, request.url.path, exc.message)
    headers = {}
    if isinstance(exc, RateLimitError):
        headers["Retry-After"] = "30"
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message}, headers=headers)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )
