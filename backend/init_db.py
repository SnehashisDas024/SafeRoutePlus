import asyncio
from datetime import datetime
from app.models.database import engine, Base, SessionLocal
from app.models.schema import *  # This imports all the models so Base knows about them

def init_db():
    print("Creating all database tables...")
    # This will create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Ensure default MVP demo user exists for foreign key constraints
    db = SessionLocal()
    try:
        test_user = db.query(User).filter(User.id == "test_user_id").first()
        if not test_user:
            demo_user = User(
                id="test_user_id",
                name="Demo User",
                phone="+919876543210",
                created_at=datetime.utcnow()
            )
            db.add(demo_user)
            db.commit()
            print("Seeded demo user 'test_user_id'.")
    except Exception as e:
        db.rollback()
        print("Warning: Could not seed default test user:", e)
    finally:
        db.close()

    print("Tables created successfully!")

if __name__ == "__main__":
    init_db()


