"""Database session management and Base declarative class."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Async PostgreSQL engine
# Note: uses asyncpg for non-blocking database queries
engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql+psycopg://", "postgresql+asyncpg://")
    if "asyncpg" not in settings.DATABASE_URL
    else settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    """Base model for all SQLAlchemy tables."""

    pass


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """Dependency for obtaining database sessions."""
    async with async_session_maker() as session:
        yield session
