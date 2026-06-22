"""
core/database.py
----------------
SQLAlchemy engine + session factory for CloudIQ.
Replaces the old raw sqlite3 cursor approach.
Uses the DB URL from core/config.py (defaults to SQLite).
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import settings
import ssl

# ─── Engine ───────────────────────────────────────────────────────────────────
# check_same_thread=False is required for SQLite + FastAPI (multiple threads)
connect_args = {"check_same_thread": False, "timeout": 30} if settings.DB_URL.startswith("sqlite") else {}

# Use pg8000 driver to bypass Windows DLL blocking policies
db_url = settings.DB_URL
if db_url.startswith("postgres"):
    if "pg8000" not in db_url:
        db_url = db_url.replace("postgres://", "postgresql+pg8000://", 1)
        db_url = db_url.replace("postgresql://", "postgresql+pg8000://", 1)
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    connect_args["ssl_context"] = ctx

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=False,           # Set True to log all SQL statements (debug mode)
)

# ─── Session Factory ──────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ─── Declarative Base ─────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ─── FastAPI Dependency ───────────────────────────────────────────────────────
def get_db():
    """
    Yields a database session and ensures it is closed after each request.
    Usage in FastAPI:
        db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
