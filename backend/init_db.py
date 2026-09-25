import asyncio
from app.models.database import engine, Base
from app.models.schema import *  # This imports all the models so Base knows about them

def init_db():
    print("Creating all database tables...")
    # This will create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

if __name__ == "__main__":
    init_db()

