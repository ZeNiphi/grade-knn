"""SQLite engine, schema initialization, and request-scoped sessions."""

from collections.abc import Iterator
from pathlib import Path

from fastapi import Request
from sqlalchemy import URL, create_engine, event
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session


def create_sqlite_engine(database_path: Path) -> Engine:
    engine = create_engine(
        URL.create("sqlite+pysqlite", database=str(database_path)),
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()

    return engine


def initialize_database(engine: Engine) -> bool:
    """Create missing tables and the singleton KNN setting without resetting data.

    Returns True only when the default setting was inserted by this call.
    """
    from .models import Base, DEFAULT_K, KNNSetting

    with engine.begin() as connection:
        Base.metadata.create_all(connection)
        result = connection.execute(
            sqlite_insert(KNNSetting)
            .values(id=1, k=DEFAULT_K)
            .on_conflict_do_nothing(index_elements=[KNNSetting.id])
        )
    return result.rowcount == 1


def get_db(request: Request) -> Iterator[Session]:
    # Closing a session rolls back unfinished work; writes must commit explicitly.
    with request.app.state.session_factory() as session:
        yield session
