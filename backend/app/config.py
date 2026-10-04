"""Backend configuration: process environment overrides the root .env file."""

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR.parent / ".env"
JWT_ALGORITHM = "HS256"


@dataclass(frozen=True)
class Settings:
    database_path: Path
    frontend_origin: str = "http://127.0.0.1:5173"
    jwt_secret: str = ""
    jwt_algorithm: str = JWT_ALGORITHM
    jwt_expiry_minutes: int = 60
    initial_admin_username: str = ""
    initial_admin_password: str = ""


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

    jwt_secret = values.get("JWT_SECRET", "")
    if not jwt_secret or not jwt_secret.strip():
        raise ValueError("JWT_SECRET must be configured")
    jwt_algorithm = values.get("JWT_ALGORITHM", JWT_ALGORITHM)
    if jwt_algorithm != JWT_ALGORITHM:
        raise ValueError(f"JWT_ALGORITHM must be {JWT_ALGORITHM}")
    try:
        jwt_expiry_minutes = int(values.get("JWT_EXPIRY_MINUTES", "60"))
    except (TypeError, ValueError):
        raise ValueError("JWT_EXPIRY_MINUTES must be a positive integer") from None
    if jwt_expiry_minutes <= 0:
        raise ValueError("JWT_EXPIRY_MINUTES must be a positive integer")

    return Settings(
        database_path=path.resolve(),
        frontend_origin=origin,
        jwt_secret=jwt_secret,
        jwt_algorithm=jwt_algorithm,
        jwt_expiry_minutes=jwt_expiry_minutes,
        initial_admin_username=values.get("INITIAL_ADMIN_USERNAME", ""),
        initial_admin_password=values.get("INITIAL_ADMIN_PASSWORD", ""),
    )
