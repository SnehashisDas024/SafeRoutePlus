from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR UNIQUE;"))
        conn.commit()
        print("Added email column.")
    except Exception as e:
        print(e)
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR;"))
        conn.commit()
        print("Added password_hash column.")
    except Exception as e:
        print(e)
