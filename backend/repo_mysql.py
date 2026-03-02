from sqlalchemy import text
from sqlalchemy.orm import Session

# FAVORITES
def add_favorite(db: Session, user_id: int, recipe_id: str, recipe_json: str):
    db.execute(text("""
        INSERT IGNORE INTO favorites (user_id, recipe_id, recipe_json)
        VALUES (:user_id, :recipe_id, :recipe_json)
    """), {"user_id": user_id, "recipe_id": recipe_id, "recipe_json": recipe_json})
    db.commit()

def get_favorites(db: Session, user_id: int):
    return db.execute(text("""
        SELECT recipe_id, recipe_json, created_at
        FROM favorites
        WHERE user_id=:user_id
        ORDER BY created_at DESC
    """), {"user_id": user_id}).mappings().all()

def delete_favorite(db: Session, user_id: int, recipe_id: str):
    db.execute(text("""
        DELETE FROM favorites
        WHERE user_id=:user_id AND recipe_id=:recipe_id
    """), {"user_id": user_id, "recipe_id": recipe_id})
    db.commit()

# HISTORY
def add_history(db: Session, user_id: int, recipe_id: str, recipe_json: str):
    db.execute(text("""
        INSERT INTO history (user_id, recipe_id, recipe_json)
        VALUES (:user_id, :recipe_id, :recipe_json)
    """), {"user_id": user_id, "recipe_id": recipe_id, "recipe_json": recipe_json})
    db.commit()

def get_history(db: Session, user_id: int, limit: int = 50):
    return db.execute(text("""
        SELECT recipe_id, recipe_json, created_at
        FROM history
        WHERE user_id=:user_id
        ORDER BY created_at DESC
        LIMIT :limit
    """), {"user_id": user_id, "limit": limit}).mappings().all()

# PANTRY
def upsert_pantry(db: Session, user_id: int, pantry_text: str):
    db.execute(text("""
        INSERT INTO pantries (user_id, text)
        VALUES (:user_id, :text)
        ON DUPLICATE KEY UPDATE text=:text
    """), {"user_id": user_id, "text": pantry_text})
    db.commit()

def get_pantry(db: Session, user_id: int):
    return db.execute(text("""
        SELECT text, updated_at FROM pantries WHERE user_id=:user_id LIMIT 1
    """), {"user_id": user_id}).mappings().first()