import logging

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts using OpenAI."""
    if not texts:
        return []

    client = _get_client()
    response = await client.embeddings.create(
        model=settings.embedding_model,
        input=texts,
    )

    logger.info("Generated %d embeddings using %s", len(texts), settings.embedding_model)
    return [item.embedding for item in response.data]
