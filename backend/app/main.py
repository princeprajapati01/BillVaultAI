import os
import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import YOLO_MODEL_PATH, UPLOADS_DIR
from app.core import pipeline_state
from app.utils.logger import setup_logging
from sqlalchemy import text
from app.database.database import engine, Base, SessionLocal, ensure_database_exists
from app.database.models import User
from app.core.security import get_password_hash
from app.pipeline.pipeline import IDPPipeline
from app.api.routes import auth_router, invoices_router, admin_router

# Setup Logging
setup_logging()
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AURA Intelligent Document Processing API",
    description="Production-grade IDP System with MySQL Database, JWT Auth, and Admin Dashboard.",
    version="1.0.0"
)

# Enable CORS for frontend flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploaded bill images
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

@app.on_event("startup")
def startup_event():
    # 1. Initialize DB tables and seed admin / users
    try:
        ensure_database_exists()
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
        
        # Check and add missing columns to bills table (migration check)
        db_migration = SessionLocal()
        try:
            columns_to_add = [
                ("gst_number", "VARCHAR(100) NULL"),
                ("subtotal", "DOUBLE NULL"),
                ("payment_method", "VARCHAR(255) NULL"),
                ("transaction_id", "VARCHAR(100) NULL"),
                ("notes", "TEXT NULL"),
                ("due_date", "VARCHAR(100) NULL"),
                ("payment_terms", "TEXT NULL"),
                ("balance_due", "DOUBLE NULL"),
                ("amount_paid", "DOUBLE NULL"),
                ("payment_status", "VARCHAR(50) NULL"),
                ("status_reason", "TEXT NULL")
            ]
            for col_name, col_type in columns_to_add:
                try:
                    db_migration.execute(text(f"ALTER TABLE bills ADD COLUMN {col_name} {col_type}"))
                    db_migration.commit()
                    logger.info(f"Migration: added column {col_name} to bills table.")
                except Exception as e:
                    db_migration.rollback()
                    # Try to modify column type/size if it already exists
                    try:
                        db_migration.execute(text(f"ALTER TABLE bills MODIFY COLUMN {col_name} {col_type}"))
                        db_migration.commit()
                        logger.info(f"Migration: modified column {col_name} in bills table.")
                    except Exception as mod_e:
                        db_migration.rollback()
                        logger.debug(f"Migration: column {col_name} check: {e} | modify check: {mod_e}")
        except Exception as me:
            logger.error(f"Migration error: {me}")
        finally:
            db_migration.close()

        # Check and add missing columns to users table (migration check)
        db_migration_users = SessionLocal()
        try:
            columns_to_add_users = [
                ("otp_code", "VARCHAR(6) NULL"),
                ("otp_expires_at", "DATETIME NULL")
            ]
            for col_name, col_type in columns_to_add_users:
                try:
                    db_migration_users.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    db_migration_users.commit()
                    logger.info(f"Migration: added column {col_name} to users table.")
                except Exception as e:
                    db_migration_users.rollback()
                    logger.debug(f"Migration: column {col_name} check: {e}")
        except Exception as me:
            logger.error(f"Users migration error: {me}")
        finally:
            db_migration_users.close()
        
        db = SessionLocal()
        try:
            # Seed Admin
            admin_user = db.query(User).filter(User.email == "admin@example.com").first()
            if not admin_user:
                admin_user = User(
                    name="Admin User",
                    email="admin@example.com",
                    password_hash=get_password_hash("admin123"),
                    plan="Enterprise",
                    is_admin=True,
                    status="active"
                )
                db.add(admin_user)
                logger.info("Default admin user seeded.")

            # Seed Free User
            free_user = db.query(User).filter(User.email == "user@example.com").first()
            if not free_user:
                free_user = User(
                    name="Alex Johnson",
                    email="user@example.com",
                    password_hash=get_password_hash("user123"),
                    plan="Free",
                    is_admin=False,
                    status="active"
                )
                db.add(free_user)
                logger.info("Default free user seeded.")

            # Seed Premium User
            pro_user = db.query(User).filter(User.email == "premium@example.com").first()
            if not pro_user:
                pro_user = User(
                    name="Sarah Jenkins",
                    email="premium@example.com",
                    password_hash=get_password_hash("premium123"),
                    plan="Pro",
                    is_admin=False,
                    status="active"
                )
                db.add(pro_user)
                logger.info("Default premium user seeded.")

            db.commit()
        except Exception as se:
            logger.error(f"Failed to seed database: {se}")
            db.rollback()
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")

    # 2. Load OCR IDP Pipeline
    if not os.path.exists(YOLO_MODEL_PATH):
        logger.error(f"YOLO model not found at path: {YOLO_MODEL_PATH}. Pipeline cannot be initialized.")
        return
    try:
        pipeline_state.pipeline = IDPPipeline(yolo_model_path=YOLO_MODEL_PATH)
        logger.info("IDP Pipeline initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize IDP Pipeline: {str(e)}")

# Include Routers
app.include_router(auth_router)
app.include_router(invoices_router)
app.include_router(admin_router)

# Health and Status Endpoints
@app.get("/health")
async def health():
    model_loaded = pipeline_state.pipeline is not None
    return {
        "status": "healthy" if model_loaded else "degraded",
        "yolo_model_loaded": model_loaded,
        "yolo_model_path": YOLO_MODEL_PATH
    }

@app.get("/")
async def read_root():
    return {
        "status": "active",
        "message": "AURA Intelligent Document Processing API is active",
        "docs": "/docs"
    }
