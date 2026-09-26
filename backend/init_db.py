import asyncio
from datetime import datetime
from sqlalchemy import inspect, text
from app.models.database import engine, Base, SessionLocal
from app.models.schema import *  # This imports all the models so Base knows about them

def migrate_existing_schema():
    inspector = inspect(engine)
    report_columns = {column['name'] for column in inspector.get_columns('reports')}
    missing_columns = {
        'user_id': 'VARCHAR',
        'source': "VARCHAR DEFAULT 'trip'",
    }

    with engine.begin() as connection:
        for column_name, column_definition in missing_columns.items():
            if column_name not in report_columns:
                connection.execute(text(
                    f'ALTER TABLE reports ADD COLUMN {column_name} {column_definition}'
                ))

def init_db():
    print("Creating all database tables...")
    # This will create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    migrate_existing_schema()
    
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


