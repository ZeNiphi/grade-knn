"""Authenticated Student prediction availability and request endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .admin_dashboard import get_current_k
from .auth import require_student
from .courses import course_response, get_course_or_404
from .database import get_db
from .knn import KNNPredictionResult, calculate_knn_prediction
from .models import Course, Prediction, User, UserGrade
from .schemas import (
    PredictionAvailabilityResponse,
    PredictionRequest,
    PredictionResponse,
)

router = APIRouter(prefix="/predictions", tags=["predictions"])


def inactive_prediction_course_error() -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={
            "code": "COURSE_INACTIVE",
            "message": "New predictions cannot be requested for an inactive course.",
        },
    )


def prediction_response(
    result: KNNPredictionResult,
    course: Course,
    prediction: Prediction | None = None,
) -> PredictionResponse:
    """Translate the framework-independent KNN result to the API contract."""
    return PredictionResponse(
        status=result.status,
        course=course_response(course),
        predicted_grade=result.predicted_grade,
        course_average=result.course_average,
        neighbor_count=result.neighbor_count,
        k=result.k,
        minimum_common_courses=result.minimum_common_courses,
        code=result.code,
        message=result.message,
        details=dict(result.details),
        created_at=prediction.created_at if prediction is not None else None,
    )


@router.get("/availability", response_model=list[PredictionAvailabilityResponse])
def list_prediction_availability(
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student)],
) -> list[PredictionAvailabilityResponse]:
    """Calculate current, read-only KNN availability for every active course."""
    k = get_current_k(db)
    courses = db.scalars(
        select(Course).where(Course.is_active.is_(True)).order_by(Course.code)
    ).all()
    grade_course_ids = set(
        db.scalars(select(UserGrade.course_id).where(UserGrade.user_id == student.id)).all()
    )
    return [
        PredictionAvailabilityResponse(
            course=course_response(course),
            is_available=(
                calculate_knn_prediction(db, student, course.id, k).status == "success"
            ),
            has_actual_grade=course.id in grade_course_ids,
        )
        for course in courses
    ]


@router.post("", response_model=PredictionResponse, status_code=201)
def request_prediction(
    payload: PredictionRequest,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student)],
) -> PredictionResponse:
    """Recheck eligibility and persist only a newly successful prediction."""
    course = get_course_or_404(db, payload.course_id)
    if not course.is_active:
        raise inactive_prediction_course_error()

    result = calculate_knn_prediction(db, student, course.id, get_current_k(db))
    if result.status == "insufficient_data":
        response.status_code = 200
        return prediction_response(result, course)

    prediction = Prediction(
        user_id=student.id,
        course_id=course.id,
        predicted_grade=result.predicted_grade,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction_response(result, course, prediction)
