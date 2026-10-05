"""Authenticated Student grade-management endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import require_student
from .courses import course_inactive_error, course_response, get_course_or_404
from .database import get_db
from .models import Course, User, UserGrade
from .schemas import GradeWrite, StudentGradeResponse

router = APIRouter(prefix="/grades", tags=["grades"])


def grade_not_found_error() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "NOT_FOUND", "message": "Grade was not found."},
    )


def grade_response(grade: UserGrade, course: Course) -> StudentGradeResponse:
    return StudentGradeResponse(
        id=grade.id,
        course=course_response(course),
        grade=grade.grade,
    )


def get_student_grade_or_404(
    db: Session, user_id: int, course_id: int
) -> tuple[UserGrade, Course]:
    result = db.execute(
        select(UserGrade, Course)
        .join(Course, Course.id == UserGrade.course_id)
        .where(UserGrade.user_id == user_id, UserGrade.course_id == course_id)
    ).one_or_none()
    if result is None:
        raise grade_not_found_error()
    return result


@router.get("", response_model=list[StudentGradeResponse])
def list_grades(
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student)],
) -> list[StudentGradeResponse]:
    rows = db.execute(
        select(UserGrade, Course)
        .join(Course, Course.id == UserGrade.course_id)
        .where(UserGrade.user_id == student.id)
        .order_by(Course.code)
    ).all()
    return [grade_response(grade, course) for grade, course in rows]


@router.post("", response_model=StudentGradeResponse, status_code=201)
def create_or_update_grade(
    payload: GradeWrite,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student)],
) -> StudentGradeResponse:
    course = get_course_or_404(db, payload.course_id)
    grade = db.scalar(
        select(UserGrade).where(
            UserGrade.user_id == student.id,
            UserGrade.course_id == payload.course_id,
        )
    )
    if grade is None:
        if not course.is_active:
            raise course_inactive_error()
        grade = UserGrade(
            user_id=student.id, course_id=payload.course_id, grade=payload.grade
        )
        db.add(grade)
    else:
        grade.grade = payload.grade
        response.status_code = 200

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(grade)
    return grade_response(grade, course)


@router.delete("/{course_id}", status_code=204, response_model=None)
def delete_grade(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student)],
) -> Response:
    grade, _course = get_student_grade_or_404(db, student.id, course_id)
    db.delete(grade)
    db.commit()
    return Response(status_code=204)
