import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(override=True)

# Database Configurations
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "prince")
DB_NAME = os.getenv("DB_NAME", "aura_idp")
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Security Configurations
JWT_SECRET = os.getenv("JWT_SECRET", "aura-idp-secret-key-super-secure-5678-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# YOLO Model Path
YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "best.pt")

# Feature flags
# IMPORTANT: If disabled, extraction must behave exactly as it did previously.
ENABLE_ADVANCED_RANKING = os.getenv("ENABLE_ADVANCED_RANKING", "true").strip().lower() in {"1", "true", "yes", "y", "on"}

# Performance knobs
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "3"))

# SQLAlchemy pool knobs (defaults match SQLAlchemy defaults)
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))
DB_POOL_RECYCLE_SECONDS = int(os.getenv("DB_POOL_RECYCLE_SECONDS", "1800"))
DB_SSL_DISABLED = os.getenv("DB_SSL_DISABLED", "true" if DB_HOST.lower() in ("localhost", "127.0.0.1") else "false").strip().lower() in {"1", "true", "yes", "y", "on"}


# Upload Directory
# Using absolute path relative to the root backend directory to keep consistency
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOADS_DIR = os.path.join(PROJECT_ROOT, "uploads")

# SMTP Configurations for Email OTP
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "")

# Hugging Face Configurations
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "").strip()
HUGGINGFACE_MODEL = os.getenv("HUGGINGFACE_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct").strip()
