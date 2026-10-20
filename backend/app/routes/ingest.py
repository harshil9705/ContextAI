import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.models import IngestRequest, IngestResponse
from app.exceptions import ContentExtractionError, ExternalServiceError, ValidationError
from app.services import embeddings, ingestion, vectorstore, llm
from app import database

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_content(request: IngestRequest):
    item_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    is_url = request.type == "url" or ingestion.looks_like_url(request.content)

    if is_url:
        url = request.content.strip()
        try:
            text, extracted_title = await ingestion.fetch_url_content(url)
        except Exception as e:
            logger.error("URL fetch failed for %s: %s", url, e)
            raise ContentExtractionError(url, str(e))
        title = request.title or extracted_title
        source_url = url
    else:
        text = request.content
        title = request.title or text[:60].strip()
        source_url = None

    chunks = ingestion.chunk_text(text)
    if not chunks:
        raise ValidationError("Content too short to process")

    try:
        chunk_embeddings = await embeddings.get_embeddings(chunks)
    except Exception as e:
        logger.error("Embedding generation failed: %s", e)
        raise ExternalServiceError("OpenAI Embeddings", str(e))

    vectorstore.add_chunks(
        item_id=item_id,
        chunks=chunks,
        embeddings=chunk_embeddings,
        metadata={
            "source_type": request.type,
            "title": title,
            "created_at": created_at,
        },
    )

    try:
        summary = await llm.generate_summary(text)
    except Exception as e:
        logger.warning("Summary generation failed, continuing without: %s", e)
        summary = ""

    await database.insert_item({
        "id": item_id,
        "title": title,
        "type": request.type,
        "content": text,
        "source_url": source_url,
        "chunk_count": len(chunks),
        "summary": summary,
        "created_at": created_at,
    })

    logger.info("Ingested %s '%s' with %d chunks", request.type, title, len(chunks))

    return IngestResponse(
        id=item_id,
        title=title,
        type=request.type,
        chunk_count=len(chunks),
        summary=summary,
        created_at=created_at,
    )
