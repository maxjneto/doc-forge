"""Shared test fixtures for DocForge backend."""


import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth import get_current_user
from app.database import get_db
from app.main import app
from app.models.base import Base
from app.models.user import User

# ─── In-memory SQLite async engine for tests ─────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(autouse=True)
async def setup_db():
    """Create tables before each test and drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Drop the PostgreSQL-only partial unique index (unsupported by SQLite)
        await conn.execute(text("DROP INDEX IF EXISTS idx_one_active_version"))
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session():
    async with TestSession() as session:
        yield session


@pytest.fixture
def test_user() -> User:
    return User(id="user_test123", email="test@example.com", name="Test User", credits=5)


@pytest.fixture
async def db_with_user(db_session: AsyncSession, test_user: User):
    db_session.add(test_user)
    await db_session.commit()
    await db_session.refresh(test_user)
    return db_session


async def _override_get_db():
    async with TestSession() as session:
        yield session


async def _seed_user(user: User) -> None:
    """Insert user into test DB so UPDATE queries find it."""
    async with TestSession() as session:
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.id == user.id))
        if result.scalar_one_or_none() is None:
            session.add(User(id=user.id, email=user.email, name=user.name, credits=user.credits))
            await session.commit()


@pytest.fixture
def client_factory():
    """Returns a factory to create an AsyncClient with auth overridden.

    The user is seeded into the test DB so that UPDATE queries work.
    """

    def _create(user: User | None = None):
        u = user or User(id="user_test123", email="test@example.com", name="Test User", credits=5)

        async def _override_user():
            await _seed_user(u)
            return u

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_user] = _override_user
        transport = ASGITransport(app=app)
        return AsyncClient(transport=transport, base_url="http://test")

    return _create


@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.clear()
