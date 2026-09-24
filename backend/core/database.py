
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import settings
import ssl

connect_args = {"check_same_thread": False, "timeout": 30} if settings.DB_URL.startswith("sqlite") else {}

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
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
