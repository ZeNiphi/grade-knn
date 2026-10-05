"""Request and response schemas used by the API."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, StrictInt, field_validator

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


class CourseWrite(BaseModel):
    """The editable fields of a course."""

    model_config = ConfigDict(extra="forbid")

    code: str
    name: str

    @field_validator("code")
    @classmethod
    def normalize_course_code(cls, value: str) -> str:
        code = value.strip().upper()
        if not code or len(code) > 20:
            raise ValueError("Course code must be 1-20 characters.")
        return code

    @field_validator("name")
    @classmethod
    def normalize_course_name(cls, value: str) -> str:
        name = value.strip()
        if not name or len(name) > 150:
            raise ValueError("Course name must be 1-150 characters.")
        return name


class CourseResponse(BaseModel):
    id: int
    code: str
    name: str
    is_active: bool


class GradeWrite(BaseModel):
    """A grade submitted for a course."""

    model_config = ConfigDict(extra="forbid")

    course_id: StrictInt
    grade: StrictInt

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, value: int) -> int:
        if not 0 <= value <= 100:
            raise ValueError("Grade must be an integer from 0 to 100.")
        return value


class StudentGradeResponse(BaseModel):
    id: int
    course: CourseResponse
    grade: int


class HistoricalStudentResponse(BaseModel):
    id: int
    generated_key: str | None
    is_active_for_knn: bool
    grade_count: int


class HistoricalGradeResponse(BaseModel):
    course: CourseResponse
    grade: int


class HistoricalStudentDetailResponse(HistoricalStudentResponse):
    grades: list[HistoricalGradeResponse]


class AdminStudentResponse(BaseModel):
    id: int
    username: str
    is_active: bool
    grade_count: int


class AdminSummaryResponse(BaseModel):
    registered_account_count: int
    active_student_count: int
    course_count: int
    active_course_count: int
    historical_student_count: int
    active_historical_student_count: int
    stored_grade_count: int


class KNNSettingResponse(BaseModel):
    k: int


class KNNSettingWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    k: StrictInt

    @field_validator("k")
    @classmethod
    def validate_k(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("k must be a positive integer.")
        return value
