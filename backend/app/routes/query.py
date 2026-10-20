import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models import QueryRequest, QueryResponse, Source
from app.services import embeddings, vectorstore, llm

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_sources(context_chunks: list[dict]) -> list[Source]:
    return [
        Source(
            item_id=chunk["item_id"],
            title=chunk["title"],
            chunk_text=chunk["text"][:300],
            relevance_score=round(1 - (chunk["distance"] / 2), 3),
        )
        for chunk in context_chunks
    ]


async def _get_context(question: str) -> list[dict]:
    try:
        query_embedding = (await embeddings.get_embeddings([question]))[0]
    except Exception as e:
        logger.error("Query embedding failed: %s", e)
        raise HTTPException(status_code=502, detail="Failed to process question. Please try again.")

    results = vectorstore.search(query_embedding, n_results=5)
    if not results["documents"]:
        return []

    return [
        {
            "title": meta.get("title", "Untitled"),
            "text": doc,
            "item_id": meta.get("item_id", ""),
            "distance": dist,
        }
        for doc, meta, dist in zip(
            results["documents"],
            results["metadatas"],
            results["distances"],
        )
    ]


@router.post("/query", response_model=QueryResponse)
async def query_knowledge(request: QueryRequest):
    context_chunks = await _get_context(request.question)

    if not context_chunks:
        return QueryResponse(
            answer="No content has been saved yet. Add some notes or URLs first, then ask your question.",
            sources=[],
        )

    history = [{"role": m.role, "content": m.content} for m in (request.history or [])]

    try:
        answer = await llm.generate_answer(request.question, context_chunks, history or None)
    except Exception as e:
        logger.error("LLM generation failed: %s", e)
        raise HTTPException(status_code=502, detail="Failed to generate answer. Please try again.")

    sources = _build_sources(context_chunks)
    logger.info("Answered query with %d sources: %.50s...", len(sources), request.question)
    return QueryResponse(answer=answer, sources=sources)


@router.post("/query/stream")
async def query_knowledge_stream(request: QueryRequest):
    context_chunks = await _get_context(request.question)

    sources = _build_sources(context_chunks) if context_chunks else []
    history = [{"role": m.role, "content": m.content} for m in (request.history or [])]

    async def event_stream():
        yield f"data: {json.dumps({'type': 'sources', 'sources': [s.model_dump() for s in sources]})}\n\n"

        try:
            async for token in llm.generate_answer_stream(request.question, context_chunks, history or None):
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
        except Exception as e:
            logger.error("Stream generation failed: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Failed to generate answer.'})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
