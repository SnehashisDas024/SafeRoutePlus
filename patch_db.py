from sqlalchemy import create_engine
import os
from dotenv import load_dotenv

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

with engine.connect() as conn:
    try:
        conn.execute("ALTER TABLE users ADD COLUMN email VARCHAR UNIQUE;")
        print("Added email column.")
    except Exception as e:
        print(e)
    try:
        conn.execute("ALTER TABLE users ADD COLUMN password_hash VARCHAR;")
        print("Added password_hash column.")
    except Exception as e:
        print(e)
