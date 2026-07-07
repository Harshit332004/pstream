import json
import logging
import os
from fastapi import APIRouter, Request

logger = logging.getLogger("sync")
router = APIRouter()

SYNC_FILE = "sync_data.json"

def load_sync_data():
    if os.path.exists(SYNC_FILE):
        try:
            with open(SYNC_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading sync data: {e}")
    return {}

def save_sync_data(data):
    try:
        with open(SYNC_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception as e:
        logger.error(f"Error saving sync data: {e}")

@router.get("/users/{user_id}/watch-history")
async def get_watch_history(user_id: str):
    data = load_sync_data()
    user_data = data.get(user_id, {})
    return list(user_data.values())

@router.put("/users/{user_id}/watch-history/{tmdb_id}")
async def update_watch_history(user_id: str, tmdb_id: str, request: Request):
    try:
        payload = await request.json()
        data = load_sync_data()
        
        if user_id not in data:
            data[user_id] = {}
            
        data[user_id][tmdb_id] = payload
        save_sync_data(data)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to update history: {e}")
        return {"success": False, "error": str(e)}

@router.delete("/users/{user_id}/watch-history/{tmdb_id}")
async def delete_history_item(user_id: str, tmdb_id: str):
    data = load_sync_data()
    if user_id in data and tmdb_id in data[user_id]:
        del data[user_id][tmdb_id]
        save_sync_data(data)
    return {"success": True}

@router.delete("/users/{user_id}/watch-history")
async def clear_watch_history(user_id: str):
    data = load_sync_data()
    if user_id in data:
        del data[user_id]
        save_sync_data(data)
    return {"success": True}
