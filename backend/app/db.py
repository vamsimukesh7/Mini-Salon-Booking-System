from contextlib import contextmanager
from pathlib import Path
from sqlalchemy import (
    create_engine,
    event,
    MetaData,
    Table,
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    text,
)
from .config import settings

metadata = MetaData()
services = Table(
    "services",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String, nullable=False, unique=True),
    Column("price_paise", Integer, nullable=False),
    Column("duration", Integer, nullable=False),
    Column("active", Boolean, nullable=False, default=True),
)
bookings = Table(
    "bookings",
    metadata,
    Column("id", String, primary_key=True),
    Column("customer_name", String, nullable=False),
    Column("phone", String, nullable=False),
    Column("service_id", ForeignKey("services.id"), nullable=False),
    Column("date", String, nullable=False, index=True),
    Column("time", String, nullable=False),
    Column("end_time", String, nullable=False),
    Column("price_paise", Integer, nullable=False),
    Column("status", String, nullable=False),
    Column("created_at", String, nullable=False),
    Column("updated_at", String, nullable=False),
    Column("previous_slot", String),
    Column("idempotency_key", String, unique=True),
    Column("request_fingerprint", String),
)
invoices = Table(
    "invoices",
    metadata,
    Column("id", String, primary_key=True),
    Column("booking_id", ForeignKey("bookings.id"), nullable=False),
    Column("customer_name", String, nullable=False),
    Column("phone", String, nullable=False),
    Column("issued_at", String, nullable=False),
    Column("total_paise", Integer, nullable=False),
)
invoice_items = Table(
    "invoice_items",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("invoice_id", ForeignKey("invoices.id"), nullable=False),
    Column("service_id", ForeignKey("services.id"), nullable=False),
    Column("name", String, nullable=False),
    Column("quantity", Integer, nullable=False),
    Column("unit_price_paise", Integer, nullable=False),
)


def make_engine(url):
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("sqlite:///"):
        Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
    created = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 30}
        if url.startswith("sqlite")
        else {},
        pool_pre_ping=True,
    )

    if created.dialect.name == "sqlite":

        @event.listens_for(created, "connect")
        def configure_sqlite(connection, record):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return created


engine = make_engine(settings.database_url)


@contextmanager
def transaction():
    """Serialize every booking mutation, including conflict read + write, across workers."""
    with engine.connect() as connection:
        try:
            if engine.dialect.name == "sqlite":
                connection.exec_driver_sql("BEGIN IMMEDIATE")
            else:
                connection.begin()
                connection.execute(text("SELECT pg_advisory_xact_lock(739201)"))
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
