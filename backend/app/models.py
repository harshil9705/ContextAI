from typing import Literal, Optional
from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    type: Literal["note", "url"]
    content: str = Field(..., min_length=1, max_length=50000)
    title: Optional[str] = Field(None, max_length=200)


class IngestResponse(BaseModel):
    id: str
    title: str
    type: str
    chunk_count: int
    summary: str
    created_at: str


class ItemResponse(BaseModel):
    id: str
    title: str
    type: str
    content_preview: str
    summary: str
    created_at: str


class ItemsListResponse(BaseModel):
    items: list[ItemResponse]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)
    history: Optional[list[ChatMessage]] = None


class Source(BaseModel):
    item_id: str
    title: str
    chunk_text: str
    relevance_score: float


class QueryResponse(BaseModel):
    answer: str
    sources: list[Source]
