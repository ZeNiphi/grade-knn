"""Admin endpoints for managing anonymous historical KNN profiles."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .auth import require_admin
from .courses import course_response
from .database import get_db
from .models import Course, HistoricalGrade, HistoricalStudent, User
from .schemas import (
    HistoricalGradeResponse,
    HistoricalStudentDetailResponse,
    HistoricalStudentResponse,
)

router = APIRouter(prefix="/admin/historical-students", tags=["admin historical students"])


def historical_student_not_found_error() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "NOT_FOUND", "message": "Historical student was not found."},
    )


def get_historical_student_or_404(
    db: Session, historical_student_id: int
) -> HistoricalStudent:
    historical_student = db.get(HistoricalStudent, historical_student_id)
    if historical_student is None:
        raise historical_student_not_found_error()
    return historical_student


def historical_student_response(
    historical_student: HistoricalStudent, grade_count: int
) -> HistoricalStudentResponse:
    return HistoricalStudentResponse(
        id=historical_student.id,
        generated_key=historical_student.generated_key,
        is_active_for_knn=historical_student.is_active_for_knn,
        grade_count=grade_count,
    )


@router.get("", response_model=list[HistoricalStudentResponse])
def list_historical_students(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> list[HistoricalStudentResponse]:
    rows = db.execute(
        select(HistoricalStudent, func.count(HistoricalGrade.id))
        .outerjoin(
            HistoricalGrade,
            HistoricalGrade.historical_student_id == HistoricalStudent.id,
        )
        .group_by(HistoricalStudent.id)
        .order_by(HistoricalStudent.id)
    ).all()
    return [
        historical_student_response(historical_student, grade_count)
        for historical_student, grade_count in rows
    ]


@router.get("/{historical_student_id}", response_model=HistoricalStudentDetailResponse)
def get_historical_student(
    historical_student_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> HistoricalStudentDetailResponse:
    historical_student = get_historical_student_or_404(db, historical_student_id)
    rows = db.execute(
        select(HistoricalGrade, Course)
        .join(Course, Course.id == HistoricalGrade.course_id)
        .where(HistoricalGrade.historical_student_id == historical_student.id)
        .order_by(Course.code)
    ).all()
    grades = [
        HistoricalGradeResponse(course=course_response(course), grade=grade.grade)
        for grade, course in rows
    ]
    return HistoricalStudentDetailResponse(
        **historical_student_response(historical_student, len(grades)).model_dump(),
        grades=grades,
    )


@router.post("/{historical_student_id}/deactivate", response_model=HistoricalStudentResponse)
def deactivate_historical_student(
    historical_student_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> HistoricalStudentResponse:
    historical_student = get_historical_student_or_404(db, historical_student_id)
    historical_student.is_active_for_knn = False
    db.commit()
    db.refresh(historical_student)
    grade_count = db.scalar(
        select(func.count(HistoricalGrade.id)).where(
            HistoricalGrade.historical_student_id == historical_student.id
        )
    )
    return historical_student_response(historical_student, grade_count)


@router.post("/{historical_student_id}/activate", response_model=HistoricalStudentResponse)
def activate_historical_student(
    historical_student_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> HistoricalStudentResponse:
    historical_student = get_historical_student_or_404(db, historical_student_id)
    historical_student.is_active_for_knn = True
    db.commit()
    db.refresh(historical_student)
    grade_count = db.scalar(
        select(func.count(HistoricalGrade.id)).where(
            HistoricalGrade.historical_student_id == historical_student.id
        )
    )
    return historical_student_response(historical_student, grade_count)


@router.delete("/{historical_student_id}", status_code=204, response_model=None)
def delete_historical_student(
    historical_student_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> Response:
    historical_student = get_historical_student_or_404(db, historical_student_id)
    db.delete(historical_student)
    db.commit()
    return Response(status_code=204)
