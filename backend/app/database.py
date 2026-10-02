"""SQLite connections and one session per request; schema arrives in Step 2."""

from collections.abc import Iterator
from pathlib import Path

from fastapi import Request
from sqlalchemy import URL, create_engine, event
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


def get_db(request: Request) -> Iterator[Session]:
    # Closing a session rolls back unfinished work; writes must commit explicitly.
    with request.app.state.session_factory() as session:
        yield session
