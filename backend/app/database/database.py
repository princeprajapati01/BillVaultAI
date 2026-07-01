import pymysql
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import (
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASS,
    DB_NAME,
    DATABASE_URL,
    DB_POOL_SIZE,
    DB_MAX_OVERFLOW,
    DB_POOL_RECYCLE_SECONDS,
)

logger = logging.getLogger(__name__)

def ensure_database_exists():
    try:
        connection = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASS
        )
        try:
            with connection.cursor() as cursor:
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
            connection.commit()
            logger.info(f"Database '{DB_NAME}' checked/created successfully.")
        finally:
            connection.close()
    except Exception as e:
        logger.error(f"Error ensuring database exists: {e}")

# NOTE: ensure_database_exists() should be called at app startup, not import time,
# to avoid side effects and to support multi-worker deployments.

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=max(1, int(DB_POOL_SIZE)),
    max_overflow=max(0, int(DB_MAX_OVERFLOW)),
    pool_recycle=max(0, int(DB_POOL_RECYCLE_SECONDS)),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
