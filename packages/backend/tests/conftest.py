"""Shared test fixtures for DocForge backend."""

import os

# Must be set before any `app.*` import: the OpenAI client is instantiated at
# module import time and raises on an empty API key. Keeps the suite
# self-contained — no .env file required locally or in CI.
os.environ.setdefault("AZURE_OPENAI_API_KEY", "test-key")
os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com/")
os.environ.setdefault("POSTHOG_ENABLED", "false")

# Force Stripe OFF for the suite regardless of a developer's local .env. Tests
# that exercise the enabled path opt in explicitly via monkeypatch (see
# test_billing.py::stripe_enabled); without this, a local .env with
# STRIPE_ENABLED=true leaks in and the "disabled by default" tests fail while
# CI (no .env) stays green — a non-hermetic split. Set before any app import.
os.environ["STRIPE_ENABLED"] = "false"
os.environ["STRIPE_SECRET_KEY"] = ""
os.environ["STRIPE_PRICE_ID_PRO"] = ""
os.environ["STRIPE_PRICE_ID_TEAM"] = ""
os.environ["STRIPE_WEBHOOK_SECRET"] = ""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth import get_current_user, get_current_user_optional
from app.database import get_db
from app.main import app
from app.models.base import Base
from app.models.document_type import DocumentType, SectionDefinition
from app.models.user import User

# ─── In-memory SQLite async engine for tests ─────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Mirrors migrations 006 + 024 — the built-in guided-mode document types.
# Prompts aren't seeded here: guided/pipeline tests mock the AI layer, and the
# prompt loader falls back to prompts/documents.yaml for anything unseeded.
RFC_SECTIONS = [
    ("context", "Context", 1, "Describes the problem, its impact, and why action is needed now."),
    ("proposal", "Proposal", 2, "Presents the chosen solution, key design decisions, and architecture."),
    ("implementation", "Implementation", 3, "Details the technical implementation plan, component changes, and rollout strategy."),
    ("risks", "Risks", 4, "Identifies risks, trade-offs, open questions, and mitigation strategies."),
]

BUILTIN_TYPES = [
    ("rfc", "RFC", "Request for Comments — technical design proposal.", RFC_SECTIONS),
    ("adr", "ADR", "Architecture Decision Record.", [
        ("context", "Context", 1, "Forces driving the decision."),
        ("decision", "Decision", 2, "The decision that was made."),
        ("consequences", "Consequences", 3, "Resulting trade-offs."),
        ("alternatives", "Alternatives", 4, "Options considered and rejected."),
    ]),
    ("postmortem", "Postmortem", "Blameless incident postmortem.", [
        ("summary", "Summary", 1, "What happened and current status."),
        ("impact", "Impact", 2, "Who/what was affected and for how long."),
        ("timeline", "Timeline", 3, "Chronological record of the incident."),
        ("root_cause", "Root Cause", 4, "Underlying and contributing causes."),
        ("action_items", "Action Items", 5, "Preventive and corrective actions."),
    ]),
    ("runbook", "Runbook", "Operational runbook.", [
        ("overview", "Overview", 1, "What the runbook does and when to use it."),
        ("prerequisites", "Prerequisites", 2, "Access, tools, and preconditions."),
        ("procedure", "Procedure", 3, "Ordered steps to perform the operation."),
        ("verification", "Verification", 4, "How to confirm success."),
        ("rollback", "Rollback", 5, "How to undo and troubleshoot."),
    ]),
]


async def _seed_document_types() -> None:
    async with TestSession() as session:
        for slug, name, description, sections in BUILTIN_TYPES:
            doc_type = DocumentType(
                slug=slug,
                name=name,
                description=description,
                is_active=True,
            )
            session.add(doc_type)
            await session.flush()
            for key, display, order, role in sections:
                session.add(SectionDefinition(
                    document_type_id=doc_type.id,
                    section_key=key,
                    display_name=display,
                    order=order,
                    role_description=role,
                ))
        await session.commit()


@pytest.fixture(autouse=True)
async def setup_db():
    """Create tables before each test, seed document types, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Drop the PostgreSQL-only partial unique index (unsupported by SQLite)
        await conn.execute(text("DROP INDEX IF EXISTS idx_one_active_version"))
    await _seed_document_types()
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
            session.add(User(
                id=user.id, email=user.email, name=user.name,
                credits=user.credits, plan=user.plan or "free",
                stripe_customer_id=user.stripe_customer_id,
                stripe_subscription_id=user.stripe_subscription_id,
            ))
            await session.commit()


@pytest.fixture
def client_factory():
    """Returns a factory to create an AsyncClient with auth overridden.

    The user is seeded into the test DB so that UPDATE queries work.
    """

    def _create(user: User | None = None):
        u = user or User(id="user_test123", email="test@example.com", name="Test User", credits=5)
        if u.plan is None:
            u.plan = "free"

        async def _override_user():
            await _seed_user(u)
            return u

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_user] = _override_user
        app.dependency_overrides[get_current_user_optional] = _override_user
        transport = ASGITransport(app=app)
        return AsyncClient(transport=transport, base_url="http://test")

    return _create


@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.clear()
