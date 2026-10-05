"""Admin endpoints for managing registered Student account eligibility."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .auth import require_admin
from .database import get_db
from .models import STUDENT_ROLE, User, UserGrade
from .schemas import AdminStudentResponse

router = APIRouter(prefix="/admin/students", tags=["admin students"])


def student_not_found_error() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "NOT_FOUND", "message": "Student was not found."},
    )


def get_student_or_404(db: Session, student_id: int) -> User:
    student = db.scalar(
        select(User).where(User.id == student_id, User.role == STUDENT_ROLE)
    )
    if student is None:
        raise student_not_found_error()
    return student


def student_response(student: User, grade_count: int) -> AdminStudentResponse:
    return AdminStudentResponse(
        id=student.id,
        username=student.username,
        is_active=student.is_active,
        grade_count=grade_count,
    )


def student_grade_count(db: Session, student_id: int) -> int:
    return db.scalar(select(func.count(UserGrade.id)).where(UserGrade.user_id == student_id))


@router.get("", response_model=list[AdminStudentResponse])
def list_students(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> list[AdminStudentResponse]:
    rows = db.execute(
        select(User, func.count(UserGrade.id))
        .outerjoin(UserGrade, UserGrade.user_id == User.id)
        .where(User.role == STUDENT_ROLE)
        .group_by(User.id)
        .order_by(User.username)
    ).all()
    return [student_response(student, grade_count) for student, grade_count in rows]


@router.get("/{student_id}", response_model=AdminStudentResponse)
def get_student(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> AdminStudentResponse:
    student = get_student_or_404(db, student_id)
    return student_response(student, student_grade_count(db, student.id))


@router.post("/{student_id}/disable", response_model=AdminStudentResponse)
def disable_student(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> AdminStudentResponse:
    student = get_student_or_404(db, student_id)
    student.is_active = False
    db.commit()
    db.refresh(student)
    return student_response(student, student_grade_count(db, student.id))


@router.post("/{student_id}/activate", response_model=AdminStudentResponse)
def activate_student(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> AdminStudentResponse:
    student = get_student_or_404(db, student_id)
    student.is_active = True
    db.commit()
    db.refresh(student)
    return student_response(student, student_grade_count(db, student.id))
