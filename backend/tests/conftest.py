import sys
import os
from uuid import uuid4
import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import db, domain
from app.main import app, limits
from app.config import settings


@pytest.fixture
def database_url(tmp_path):
    postgres = os.environ.get("TEST_POSTGRES_URL")
    if not postgres:
        yield "sqlite:///" + str(tmp_path / "test.db")
        return
    # Never clear a caller's database. Create/drop an isolated test-only database.
    name = "atelier_test_" + uuid4().hex
    with psycopg.connect(postgres, autocommit=True) as connection:
        connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        try:
            yield str(make_url(postgres).set(database=name))
        finally:
            connection.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name))
            )


@pytest.fixture
def client(database_url, monkeypatch):
    engine = db.make_engine(database_url)
    monkeypatch.setattr(db, "engine", engine)
    monkeypatch.setattr(settings, "admin_password", "test-only-password")
    monkeypatch.setattr(settings, "llm_api_key", "")
    limits.clear()
    domain.initialize(seed=False)
    # Prevent lifespan sample seed from interfering with assertions.
    with TestClient(app) as c:
        with db.transaction() as conn:
            conn.execute(db.bookings.delete())
        yield c
    engine.dispose()


@pytest.fixture
def auth(client):
    result = client.post("/auth/login", json={"password": "test-only-password"})
    return {"Authorization": "Bearer " + result.json()["token"]}


@pytest.fixture
def future():
    from datetime import timedelta

    return (domain.now().date() + timedelta(days=2)).isoformat()


@pytest.fixture
def payload(future):
    return {
        "customer_name": "Test Customer",
        "phone": "9876543210",
        "service_id": 1,
        "date": future,
        "time": "10:00",
    }
