"""Password hashing and JWT helpers for account credentials."""

import base64
import binascii
from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import json
import secrets

from .config import Settings

HASH_NAME = "sha256"
PBKDF2_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    """Return a salted PBKDF2 hash suitable for storing in ``User.password_hash``."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        HASH_NAME, password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"pbkdf2_{HASH_NAME}${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Check a password against a hash created by :func:`hash_password`."""
    try:
        algorithm, iterations, salt_hex, digest_hex = stored_hash.split("$")
        if algorithm != f"pbkdf2_{HASH_NAME}":
            return False
        expected = hashlib.pbkdf2_hmac(
            HASH_NAME,
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
    except (TypeError, ValueError):
        return False
    return hmac.compare_digest(expected.hex(), digest_hex)


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_access_token(
    user_id: int,
    settings: Settings,
    expires_at: datetime | None = None,
) -> str:
    """Create a signed access token with a user identifier and expiry."""
    expiry = expires_at or (
        datetime.now(UTC) + timedelta(minutes=settings.jwt_expiry_minutes)
    )
    header = _base64url_encode(
        json.dumps(
            {"alg": settings.jwt_algorithm, "typ": "JWT"},
            separators=(",", ":"),
        ).encode("utf-8")
    )
    payload = _base64url_encode(
        json.dumps({"sub": str(user_id), "exp": int(expiry.timestamp())}, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{header}.{payload}".encode("ascii")
    signature = hmac.new(
        settings.jwt_secret.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    return f"{header}.{payload}.{_base64url_encode(signature)}"


def validate_access_token(token: str, settings: Settings) -> int:
    """Return the user id from a valid, unexpired access token."""
    try:
        header_part, payload_part, signature_part = token.split(".")
        signing_input = f"{header_part}.{payload_part}".encode("ascii")
        expected_signature = hmac.new(
            settings.jwt_secret.encode("utf-8"), signing_input, hashlib.sha256
        ).digest()
        if not hmac.compare_digest(
            expected_signature, _base64url_decode(signature_part)
        ):
            raise ValueError("Invalid signature")

        header = json.loads(_base64url_decode(header_part))
        payload = json.loads(_base64url_decode(payload_part))
        if header.get("alg") != settings.jwt_algorithm or header.get("typ") != "JWT":
            raise ValueError("Unexpected token header")
        expiry = payload.get("exp")
        user_id = int(payload.get("sub"))
        if isinstance(expiry, bool) or not isinstance(expiry, (int, float)):
            raise ValueError("Invalid expiry")
        if expiry <= datetime.now(UTC).timestamp() or user_id <= 0:
            raise ValueError("Expired or invalid token")
    except (AttributeError, binascii.Error, TypeError, UnicodeError, ValueError):
        raise ValueError("Invalid access token") from None
    return user_id
