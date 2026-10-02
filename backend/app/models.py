"""SQLAlchemy models for application and historical grade data."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

DEFAULT_K = 5
STUDENT_ROLE = "student"
ADMIN_ROLE = "admin"


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('student', 'admin')", name="ck_users_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean(create_constraint=True), nullable=False, default=True
    )


class HistoricalStudent(Base):
    __tablename__ = "historical_students"

    id: Mapped[int] = mapped_column(primary_key=True)
    generated_key: Mapped[str | None] = mapped_column(
        String(32), unique=True, nullable=True
    )
    is_active_for_knn: Mapped[bool] = mapped_column(
        Boolean(create_constraint=True), nullable=False, default=True
    )


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean(create_constraint=True), nullable=False, default=True
    )


class UserGrade(Base):
    __tablename__ = "user_grades"
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_user_grades_user_course"),
        CheckConstraint(
            "typeof(grade) = 'integer' AND grade BETWEEN 0 AND 100",
            name="ck_user_grades_grade",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    grade: Mapped[int] = mapped_column(Integer, nullable=False)


class HistoricalGrade(Base):
    __tablename__ = "historical_grades"
    __table_args__ = (
        UniqueConstraint(
            "historical_student_id",
            "course_id",
            name="uq_historical_grades_student_course",
        ),
        CheckConstraint(
            "typeof(grade) = 'integer' AND grade BETWEEN 0 AND 100",
            name="ck_historical_grades_grade",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    historical_student_id: Mapped[int] = mapped_column(
        ForeignKey("historical_students.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    grade: Mapped[int] = mapped_column(Integer, nullable=False)


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    predicted_grade: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )


class KNNSetting(Base):
    __tablename__ = "knn_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_knn_settings_singleton"),
        CheckConstraint(
            "typeof(k) = 'integer' AND k > 0", name="ck_knn_settings_positive_k"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    k: Mapped[int] = mapped_column(Integer, nullable=False, default=DEFAULT_K)
