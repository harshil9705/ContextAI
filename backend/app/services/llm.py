import logging
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client

_SYSTEM_PROMPT = """You are a helpful assistant that answers questions based on the user's saved knowledge base.

Rules:
- Use ONLY the provided context to answer. Do not use outside knowledge.
- If the context doesn't contain enough information, say so clearly.
- Cite sources by referring to their titles in square brackets, e.g. [Title].
- Be concise and direct."""

_SUMMARY_PROMPT = """Summarize the following content in 2-3 sentences. Focus on the key topics and main ideas.

Content:
{text}"""


def _build_messages(
    question: str,
    context_chunks: list[dict],
    history: list[dict] | None = None,
) -> list[dict]:
    context_parts = []
    for i, chunk in enumerate(context_chunks, 1):
        title = chunk.get("title", "Untitled")
        text = chunk.get("text", "")
        context_parts.append(f"[{i}] Source: {title}\n{text}")

    context_str = "\n\n".join(context_parts)

    user_message = f"""Context from knowledge base:
{context_str}

Question: {question}"""

    messages: list[dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]
    if history:
        messages.extend(history[-10:])
    messages.append({"role": "user", "content": user_message})
    return messages


async def generate_answer(question: str, context_chunks: list[dict], history: list[dict] | None = None) -> str:
    if not context_chunks:
        return "No relevant content found in your knowledge base. Try adding some notes or URLs first."

    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.llm_model,
        messages=_build_messages(question, context_chunks, history),
        temperature=0.3,
        max_tokens=1000,
    )

    answer = response.choices[0].message.content
    logger.info("Generated answer for question: %.50s...", question)
    return answer


async def generate_answer_stream(
    question: str,
    context_chunks: list[dict],
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    if not context_chunks:
        yield "No relevant content found in your knowledge base. Try adding some notes or URLs first."
        return

    client = _get_client()
    stream = await client.chat.completions.create(
        model=settings.llm_model,
        messages=_build_messages(question, context_chunks, history),
        temperature=0.3,
        max_tokens=1000,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


async def generate_summary(text: str) -> str:
    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "user", "content": _SUMMARY_PROMPT.format(text=text[:3000])},
        ],
        temperature=0.3,
        max_tokens=200,
    )
    return response.choices[0].message.content
