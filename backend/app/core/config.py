import os
import logging
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Base

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    LOG_LEVEL:   str = "INFO"

    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/taxoptimizer"

    SECRET_KEY:                  str = "dev-secret-change-in-production"
    ALGORITHM:                   str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    ANTHROPIC_API_KEY: str = ""
    REDIS_URL:         str = "redis://localhost:6379"

    SMTP_HOST:     Optional[str] = None
    SMTP_PORT:     int           = 587
    SMTP_USER:     Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    FROM_EMAIL:    Optional[str] = None

    ZERODHA_API_KEY:    Optional[str] = None
    ZERODHA_API_SECRET: Optional[str] = None

    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=(settings.ENVIRONMENT == "development"),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created / verified")
