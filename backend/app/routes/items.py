import logging

from fastapi import APIRouter, HTTPException

from app.models import ItemResponse, ItemsListResponse
from app import database
from app.services import vectorstore

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/items", response_model=ItemsListResponse)
async def list_items():
    rows = await database.get_all_items()
    items = [
        ItemResponse(
            id=row["id"],
            title=row["title"],
            type=row["type"],
            content_preview=row["content"][:200],
            summary=row.get("summary", ""),
            created_at=row["created_at"],
        )
        for row in rows
    ]
    return ItemsListResponse(items=items)


@router.delete("/items/{item_id}")
async def delete_item(item_id: str):
    deleted = await database.delete_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found")
    vectorstore.delete_item_chunks(item_id)
    logger.info("Deleted item %s", item_id)
    return {"status": "deleted", "id": item_id}
