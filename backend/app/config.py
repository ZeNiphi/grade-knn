"""Backend configuration: process environment overrides the root .env file."""

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR.parent / ".env"


@dataclass(frozen=True)
class Settings:
    database_path: Path
    frontend_origin: str = "http://127.0.0.1:5173"


def load_settings() -> Settings:
    values = {**dotenv_values(ENV_FILE), **os.environ}
    database_path = values.get("DATABASE_PATH", "app.db")
    if not database_path or not database_path.strip():
        raise ValueError("DATABASE_PATH must be a non-empty SQLite file path")
    path = Path(database_path)
    if not path.is_absolute():
        path = BACKEND_DIR / path

    origin = values.get("FRONTEND_ORIGIN", "http://127.0.0.1:5173")
    try:
        parsed = urlsplit(origin or "")
        # urlsplit validates the port only when this property is read.
        _ = parsed.port
    except ValueError:
        raise ValueError("FRONTEND_ORIGIN must be a valid HTTP(S) origin") from None
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.netloc.endswith(":")
        or parsed.path
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("FRONTEND_ORIGIN must be an HTTP(S) origin without a path")
    return Settings(database_path=path.resolve(), frontend_origin=origin)
