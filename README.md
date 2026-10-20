# AI Knowledge Inbox

A personal knowledge base with RAG-powered Q&A. Save text notes or URLs, then ask natural language questions and get streamed, AI-generated answers with cited sources. Supports multi-turn conversations, auto-generated source summaries, and content deletion.

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│   React UI  │────▶│  FastAPI Backend                         │
│  (Vite/TS)  │◀────│                                          │
└─────────────┘     │  POST /api/ingest                        │
                    │    ├─ Validate input (Pydantic)           │
                    │    ├─ Fetch URL content (httpx+trafilatura)│
                    │    ├─ Chunk text (sentence-aware, 500/50) │
                    │    ├─ Generate embeddings ──▶ OpenAI      │
                    │    ├─ Generate summary ──▶ OpenAI         │
                    │    ├─ Store vectors ──▶ Vector Store       │
                    │    └─ Store metadata ──▶ SQLite           │
                    │                                          │
                    │  POST /api/query (+ /api/query/stream)   │
                    │    ├─ Embed question ──▶ OpenAI           │
                    │    ├─ Semantic search ──▶ Vector Store    │
                    │    ├─ Build RAG prompt w/ context+history │
                    │    └─ Generate answer ──▶ OpenAI (SSE)    │
                    │                                          │
                    │  GET /api/items ──▶ SQLite                │
                    │  DELETE /api/items/{id} ──▶ SQLite+Vectors│
                    └──────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenAI API key

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start the server
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` with API proxy to the backend.

## API Endpoints

### `POST /api/ingest`
Save a note or URL to the knowledge base.

**Request:**
```json
{
  "type": "note",
  "content": "React hooks allow you to use state in functional components...",
  "title": "React Hooks Notes"
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "React Hooks Notes",
  "type": "note",
  "chunk_count": 3,
  "summary": "React Hooks let you use state and other React features without writing a class...",
  "created_at": "2024-01-15T10:30:00Z"
}
```

A short 2-3 sentence summary is auto-generated via the LLM on ingest and shown on the source card in the UI. If summary generation fails, ingestion still succeeds with an empty summary.

### `GET /api/items`
List all saved items, including title, content preview, summary, and type.

### `DELETE /api/items/{item_id}`
Delete an item and all its associated chunks from both SQLite and the vector store. Returns `404` if the item doesn't exist.

### `POST /api/query`
Ask a question over saved content. Returns the full answer in one response (non-streaming).

**Request:**
```json
{
  "question": "How do React hooks work?",
  "history": [
    { "role": "user", "content": "What is useState?" },
    { "role": "assistant", "content": "useState is a hook that..." }
  ]
}
```

`history` is optional — pass prior turns to support follow-up questions (e.g., "What about useEffect?" resolves correctly using the preceding exchange). Only the last 10 messages are sent to the LLM to bound token usage.

**Response:**
```json
{
  "answer": "Based on your saved notes, React hooks allow you to use state...",
  "sources": [
    {
      "item_id": "uuid",
      "title": "React Hooks Notes",
      "chunk_text": "React hooks allow you to...",
      "relevance_score": 0.92
    }
  ]
}
```

### `POST /api/query/stream`
Same request shape as `/api/query`, but streams the answer via **Server-Sent Events** instead of waiting for the full completion. Used by the chat UI for real-time token rendering.

Event stream shape (`text/event-stream`, each line prefixed `data: `):
```json
{"type": "sources", "sources": [...]}
{"type": "token", "token": "React"}
{"type": "token", "token": " hooks"}
{"type": "done"}
```
On failure mid-stream, an `{"type": "error", "detail": "..."}` event is sent before `done`.

## Design Decisions

### 1. Chunking Strategy: Sentence-aware, regex-based (500 chars, ~25% overlap)
**Why:** Splits on sentence boundaries (`.`/`!`/`?` followed by whitespace) and packs sentences into ~500-char chunks, carrying the last ~25% of words forward as overlap for continuity. This avoids cutting answers off mid-sentence, which hurt retrieval quality and made cited chunk previews read awkwardly.

**Tradeoff:** Regex sentence splitting is simpler than a real sentence tokenizer (spaCy, nltk) and can mis-split on abbreviations (e.g., "Dr. Smith"). At scale, would swap in a proper NLP sentence boundary detector or LangChain's structure-aware splitters (Markdown/HTML header splitting, as seen in more mature RAG systems).

### 2. Vector Store: NumPy + JSON (custom, zero-dependency)
**Why:** Pure-Python implementation using NumPy for cosine similarity and JSON for persistence. Zero native compilation required — installs on any platform without C++ build tools (ChromaDB's hnswlib dependency requires Visual C++ on Windows, which many dev machines lack).

**Tradeoff:** Loads all vectors into memory and does brute-force cosine search. Works great for hundreds/thousands of chunks. At scale (millions of vectors), would move to a dedicated vector DB (Pinecone, Weaviate, Qdrant, or pgvector) with approximate nearest neighbor (ANN) indexing.

### 3. Dual Storage: SQLite + NumPy Vector Store
**Why:** SQLite handles item metadata and listing (fast, relational queries), while the vector store handles semantic search. This separates concerns — listing items doesn't touch the vector index.

**Tradeoff:** Two data stores means potential consistency issues (see Data Integrity below). A production system would use a single DB with vector extensions (e.g., pgvector) or implement proper transaction coordination.

### 4. URL Text Extraction: trafilatura
**Why:** Extracts clean article text from HTML, stripping navigation, ads, and boilerplate. Significantly better than raw BeautifulSoup for article-style content.

**Tradeoff:** Struggles with JavaScript-rendered SPAs and some paywalled content. A production system would add a headless browser fallback (Playwright) for JS-heavy sites.

### 5. No Authentication
**Why:** Per spec — single-user, local use. Keeps the codebase focused on the RAG pipeline rather than auth boilerplate.

**Tradeoff:** Cannot support multi-tenancy. Adding auth would require JWT/OAuth, user-scoped data isolation in both SQLite and vector store, and rate limiting per user.

### 6. Streamed Answers via Server-Sent Events
**Why:** The non-streaming `/api/query` endpoint blocks on the full LLM completion (can take several seconds), leaving the user staring at a spinner. SSE lets the frontend render tokens as they arrive, which is a significant perceived-latency improvement for a chat UI. SSE was chosen over WebSockets because the data flow is one-directional (server → client) and it works over plain HTTP, needing no extra infrastructure.

**Tradeoff:** SSE doesn't support client-to-server messages on the same connection and some proxies buffer `text/event-stream` responses, so `X-Accel-Buffering: no` is set defensively. At scale, long-lived streaming connections also hold a worker/thread per active request, which factors into the concurrency plan below.

### 7. Stateless Chat History (client-held, not server-persisted)
**Why:** The frontend keeps the message list in React state and sends the last 10 turns back with each question, letting the backend build a conversational prompt so follow-ups like "What about useEffect?" resolve correctly. This avoids adding session/conversation tables for an interview-scope app.

**Tradeoff:** Conversation history is lost on page refresh and isn't shareable across devices. At scale, this would move to a `chat_sessions` table (as in more mature notebook apps) with server-side persistence and pagination.

### 8. Auto-Generated Source Summaries
**Why:** A one-line content preview (first 200 chars) doesn't tell the user what a note/URL is actually about, especially for long articles. On ingest, a cheap LLM call (`gpt-4o-mini`, capped at ~3000 input chars) generates a 2-3 sentence summary shown on the source card.

**Tradeoff:** Adds one extra LLM call (latency + cost) per ingest. Summary generation failure is caught and logged as a warning — ingestion still succeeds with an empty summary rather than failing the whole request, since the summary is a nice-to-have, not core to RAG retrieval.

### 9. Typed Exception Hierarchy for Error Handling
**Why:** A single catch-all exception handler returning generic 500s makes it hard for the frontend (or an API consumer) to distinguish "your input was bad" from "OpenAI is down" from "we have a bug." `app/exceptions.py` defines `ValidationError` (422), `ContentExtractionError` (422), `ExternalServiceError` (502), and `RateLimitError` (429, with a `Retry-After` header), each caught by a dedicated FastAPI exception handler that logs at the right severity and returns the right status code.

**Tradeoff:** This is a lightweight version of what a production system needs — see "External Service Failures" below for the full picture (retries, circuit breakers, error classification by provider exception type).

## Production Considerations (System Design)

### What This Demo Implements
- **Input validation** — Pydantic models reject malformed requests before any processing
- **Typed error handling** — custom exception hierarchy (`app/exceptions.py`) mapped to correct HTTP status codes (422 validation, 429 rate limit, 502 upstream failures)
- **Async throughout** — FastAPI + aiosqlite + httpx async client = no thread blocking
- **Streaming responses** — SSE token streaming for the chat endpoint, avoiding a multi-second blocking wait
- **Health endpoint** — `GET /api/health` for liveness checks
- **Structured logging** — Timestamped logs at INFO/ERROR levels for all operations

### Concurrency & Scale (1000s of concurrent users)

**Current limitation:** Single-process uvicorn, SQLite (single-writer lock), in-memory vector store.

**Production approach:**
- Run behind Gunicorn with multiple uvicorn workers for horizontal scaling
- Replace SQLite with PostgreSQL + connection pooling (asyncpg + pgbouncer)
- Move to a dedicated vector DB service (Pinecone/Weaviate/Qdrant) accessible by all workers
- Add rate limiting (per-IP or per-user) via `slowapi` middleware to protect OpenAI API costs
- Queue ingestion jobs (Celery/Redis) — URL fetching + embedding is slow and shouldn't block the HTTP response
- Add request timeouts at the reverse proxy level (Nginx/ALB)

### Database Resilience

**Current limitation:** SQLite is file-based — no connection pooling, no recovery from corruption.

**Production approach:**
- PostgreSQL with connection pool (pgbouncer or SQLAlchemy pool with configurable min/max connections)
- Retry logic with exponential backoff on transient connection failures
- Circuit breaker pattern for external services (OpenAI, vector DB) to prevent cascade failures
- Health check should verify actual DB connectivity, not just return 200
- Read replicas for the items listing endpoint under heavy load

### External Service Failures

**Current handling:** Try/except with 502 responses and logged errors.

**Production approach:**
- **OpenAI API:** Configurable timeouts (10s embeddings, 30s LLM), retry with exponential backoff (3 attempts), fallback to cached results or graceful degradation message
- **URL fetching:** 15s timeout, User-Agent header, never store partial/empty data
- **vector store:** Data directory backups, ability to re-embed all content from SQLite source (SQLite is the source of truth)
- Dead letter queue for failed ingestion jobs so they can be retried

### Caching

- **Embedding cache:** Hash-based dedup — if the same text is ingested twice, reuse the existing embeddings
- **Query cache:** TTL-based cache for frequent questions (invalidate on new ingestion)
- **URL fetch cache:** Avoid re-fetching the same URL within a configurable window

### Observability

- **Structured logging:** JSON format for log aggregation (ELK/Datadog/CloudWatch)
- **Request tracing:** Correlation IDs across the ingest pipeline (validate → fetch → chunk → embed → store)
- **Metrics:** Request latency (p50/p95/p99), OpenAI token usage, embedding queue depth, error rates by type
- **Alerting:** Error rate spikes, OpenAI cost thresholds, DB connection pool exhaustion

### Data Integrity

**Current risk:** If embedding succeeds but SQLite insert fails, vector store has orphaned chunks.

**Production approach:**
- Store to SQLite first (source of truth), then embed and store vectors
- If vector storage fails, mark the item as "pending_indexing" in SQLite and retry via background job
- Background reconciliation job to detect and fix inconsistencies between SQLite and vector store
- Re-indexing capability: rebuild all vectors from SQLite content if vector store data is lost

### Security (Multi-user)

- JWT authentication + user-scoped data isolation on all queries
- Input sanitization to prevent stored XSS
- Content size limits (max 50KB per note, max 10MB per URL fetch)
- Rate limiting per user (e.g., 10 ingests/min, 20 queries/min)
- HTTPS enforcement, CORS restricted to known origins
- API key rotation support for OpenAI credentials

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + TypeScript + Vite | UI with type safety and fast dev |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Backend | FastAPI (Python) | Async API server with SSE streaming |
| Embeddings | OpenAI `text-embedding-3-small` | 1536-dim vectors |
| LLM | OpenAI `gpt-4o-mini` | RAG answer generation, streaming, and source summaries |
| Vector Store | NumPy + JSON | Cosine similarity search with persistence |
| Metadata DB | SQLite (aiosqlite) | Item storage, listing, and deletion |
| URL Extraction | trafilatura | Clean text from web pages |

## Project Structure

```
chatbot/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan, error handling
│   │   ├── config.py            # Environment config (pydantic-settings)
│   │   ├── models.py            # Request/response Pydantic schemas
│   │   ├── database.py          # SQLite async operations
│   │   ├── exceptions.py        # Typed error hierarchy (ValidationError, ExternalServiceError, ...)
│   │   ├── routes/
│   │   │   ├── ingest.py        # POST /api/ingest
│   │   │   ├── items.py         # GET /api/items, DELETE /api/items/{id}
│   │   │   └── query.py         # POST /api/query, POST /api/query/stream (SSE)
│   │   └── services/
│   │       ├── ingestion.py     # URL fetching + sentence-aware text chunking
│   │       ├── embeddings.py    # OpenAI embeddings wrapper
│   │       ├── vectorstore.py   # NumPy vector store operations (add/search/delete)
│   │       └── llm.py           # RAG answer generation, streaming, and summarization
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main layout + state management
│   │   ├── api.ts               # API client (fetch-based, incl. SSE stream reader)
│   │   ├── types.ts             # TypeScript interfaces
│   │   └── components/
│   │       ├── ChatPanel.tsx     # Streaming chat UI with history and sources
│   │       ├── SourcesPanel.tsx  # Add/list/delete content, shows auto-summaries
│   │       └── layout/
│   │           └── Sidebar.tsx   # Navigation, theme toggle
│   ├── package.json
│   └── vite.config.ts
└── README.md
```
