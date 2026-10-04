"""Student course listing and Admin course-management endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .auth import require_admin, require_student
from .database import get_db
from .models import Course, HistoricalGrade, User, UserGrade
from .schemas import CourseResponse, CourseWrite

router = APIRouter(tags=["courses"])


def not_found_error() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "NOT_FOUND", "message": "Course was not found."},
    )


def course_code_taken_response() -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={
            "code": "COURSE_CODE_TAKEN",
            "message": "Course code is already taken.",
        },
    )


def course_delete_blocked_response() -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={
            "code": "COURSE_DELETE_BLOCKED",
            "message": "Course has 10 or more associated grades; deactivate it instead.",
        },
    )


def get_course_or_404(db: Session, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise not_found_error()
    return course


def course_response(course: Course) -> CourseResponse:
    return CourseResponse(
        id=course.id,
        code=course.code,
        name=course.name,
        is_active=course.is_active,
    )


@router.get("/courses", response_model=list[CourseResponse])
def list_active_courses(
    db: Annotated[Session, Depends(get_db)],
    _student: Annotated[User, Depends(require_student)],
) -> list[CourseResponse]:
    courses = db.scalars(
        select(Course).where(Course.is_active.is_(True)).order_by(Course.code)
    ).all()
    return [course_response(course) for course in courses]


@router.get("/admin/courses", response_model=list[CourseResponse])
def list_courses(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> list[CourseResponse]:
    courses = db.scalars(select(Course).order_by(Course.code)).all()
    return [course_response(course) for course in courses]


@router.post("/admin/courses", response_model=CourseResponse, status_code=201)
def create_course(
    payload: CourseWrite,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> CourseResponse | JSONResponse:
    if db.scalar(select(Course.id).where(Course.code == payload.code)) is not None:
        return course_code_taken_response()

    course = Course(code=payload.code, name=payload.name)
    db.add(course)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return course_code_taken_response()
    db.refresh(course)
    return course_response(course)


@router.put("/admin/courses/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    payload: CourseWrite,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> CourseResponse | JSONResponse:
    course = get_course_or_404(db, course_id)
    duplicate = db.scalar(
        select(Course.id).where(Course.code == payload.code, Course.id != course_id)
    )
    if duplicate is not None:
        return course_code_taken_response()

    course.code = payload.code
    course.name = payload.name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return course_code_taken_response()
    db.refresh(course)
    return course_response(course)


@router.post("/admin/courses/{course_id}/deactivate", response_model=CourseResponse)
def deactivate_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> CourseResponse:
    course = get_course_or_404(db, course_id)
    course.is_active = False
    db.commit()
    db.refresh(course)
    return course_response(course)


@router.post("/admin/courses/{course_id}/activate", response_model=CourseResponse)
def activate_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> CourseResponse:
    course = get_course_or_404(db, course_id)
    course.is_active = True
    db.commit()
    db.refresh(course)
    return course_response(course)


@router.delete("/admin/courses/{course_id}", status_code=204, response_model=None)
def delete_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> Response:
    course = get_course_or_404(db, course_id)
    grade_count = (
        db.scalar(
            select(func.count(UserGrade.id)).where(UserGrade.course_id == course.id)
        )
        + db.scalar(
            select(func.count(HistoricalGrade.id)).where(
                HistoricalGrade.course_id == course.id
            )
        )
    )
    if grade_count >= 10:
        return course_delete_blocked_response()

    db.delete(course)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
    return Response(status_code=204)
