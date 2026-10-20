import logging
import re
from html.parser import HTMLParser

import httpx
import trafilatura

from app.config import settings

logger = logging.getLogger(__name__)

_URL_PATTERN = re.compile(r"^https?://\S+$")


def looks_like_url(text: str) -> bool:
    return bool(_URL_PATTERN.match(text.strip()))


class _HTMLTextExtractor(HTMLParser):
    """Fallback: strip HTML tags and return plain text."""

    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "header", "footer"):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "header", "footer"):
            self._skip = False

    def handle_data(self, data):
        if not self._skip:
            text = data.strip()
            if text:
                self._parts.append(text)

    def get_text(self) -> str:
        return " ".join(self._parts)


async def fetch_url_content(url: str) -> tuple[str, str]:
    """Fetch and extract clean text from a URL."""
    async with httpx.AsyncClient(
        timeout=15.0,
        follow_redirects=True,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        html = response.text

    extracted = trafilatura.extract(html, include_comments=False, include_tables=True)

    if not extracted:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            extracted = trafilatura.extract(downloaded, include_comments=False, include_tables=True)

    if not extracted:
        parser = _HTMLTextExtractor()
        parser.feed(html)
        extracted = parser.get_text()

    if not extracted or len(extracted) < 20:
        raise ValueError(f"Could not extract meaningful text content from {url}")

    metadata = trafilatura.extract_metadata(html)
    title = metadata.title if metadata and metadata.title else url.split("//")[-1].split("/")[0]

    logger.info("Extracted %d chars from %s", len(extracted), url)
    return extracted, title


_SENTENCE_ENDINGS = re.compile(r'(?<=[.!?])\s+')


def chunk_text(text: str, size: int | None = None, overlap: int | None = None) -> list[str]:
    """Split text into overlapping chunks, breaking at sentence boundaries."""
    size = size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap

    sentences = _SENTENCE_ENDINGS.split(text)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if current and len(current) + len(sentence) + 1 > size:
            if len(current) >= 20:
                chunks.append(current)
            words = current.split()
            overlap_words = words[-(len(words) // 4):] if len(words) > 4 else []
            current = " ".join(overlap_words) + " " + sentence if overlap_words else sentence
        else:
            current = (current + " " + sentence).strip() if current else sentence

    if current and len(current) >= 20:
        chunks.append(current)

    logger.info("Chunked %d chars into %d chunks (size=%d, sentence-aware)", len(text), len(chunks), size)
    return chunks
