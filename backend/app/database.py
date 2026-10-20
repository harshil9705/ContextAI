import logging
from pathlib import Path

import aiosqlite

from app.config import settings

logger = logging.getLogger(__name__)

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('note', 'url')),
    content TEXT NOT NULL,
    source_url TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
)
"""

_MIGRATE_SUMMARY = "ALTER TABLE items ADD COLUMN summary TEXT NOT NULL DEFAULT ''"


async def init_db() -> None:
    db_path = Path(settings.sqlite_db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(str(db_path)) as db:
        await db.execute(_CREATE_TABLE)
        try:
            await db.execute(_MIGRATE_SUMMARY)
        except Exception:
            pass
        await db.commit()
    logger.info("Database initialized at %s", db_path)


async def insert_item(item: dict) -> None:
    async with aiosqlite.connect(settings.sqlite_db_path) as db:
        await db.execute(
            """
            INSERT INTO items (id, title, type, content, source_url, chunk_count, summary, created_at)
            VALUES (:id, :title, :type, :content, :source_url, :chunk_count, :summary, :created_at)
            """,
            item,
        )
        await db.commit()


async def delete_item(item_id: str) -> bool:
    async with aiosqlite.connect(settings.sqlite_db_path) as db:
        cursor = await db.execute("DELETE FROM items WHERE id = :id", {"id": item_id})
        await db.commit()
        return cursor.rowcount > 0


async def get_all_items() -> list[dict]:
    async with aiosqlite.connect(settings.sqlite_db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, title, type, content, summary, created_at FROM items ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
