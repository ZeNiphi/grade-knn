"""Request and response schemas used by the API."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

USERNAME_PATTERN = re.compile(r"[a-z0-9_]+")
MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 100
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def normalize_username(username: str) -> str:
    """Use the same stored username form for registration and future login."""
    return username.strip().lower()


class CredentialsRequest(BaseModel):
    """Shared username and password validation for registration and login."""

    model_config = ConfigDict(extra="forbid")

    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        normalized = normalize_username(value)
        if not MIN_USERNAME_LENGTH <= len(normalized) <= MAX_USERNAME_LENGTH:
            raise ValueError(
                f"Username must be {MIN_USERNAME_LENGTH}-{MAX_USERNAME_LENGTH} characters."
            )
        if not USERNAME_PATTERN.fullmatch(normalized):
            raise ValueError("Username may use lowercase letters, numbers, and underscores.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not MIN_PASSWORD_LENGTH <= len(value) <= MAX_PASSWORD_LENGTH:
            raise ValueError(
                f"Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters."
            )
        return value


class RegisterRequest(CredentialsRequest):
    """The only fields a new Student account may submit."""


class LoginRequest(CredentialsRequest):
    """Credentials submitted to start a session."""


class RegisteredStudent(BaseModel):
    id: int
    username: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
