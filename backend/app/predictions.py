"""Authenticated Student prediction availability and request endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import and_, select
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
    StoredPredictionResponse,
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


def stored_prediction_response(
    prediction: Prediction, course: Course, actual_grade: int | None
) -> StoredPredictionResponse:
    """Expose a stored result without reconstructing unstored KNN diagnostics."""
    return StoredPredictionResponse(
        id=prediction.id,
        course=course_response(course),
        predicted_grade=prediction.predicted_grade,
        created_at=prediction.created_at,
        actual_grade=actual_grade,
        difference=(prediction.predicted_grade - actual_grade)
        if actual_grade is not None
        else None,
    )


def prediction_history_rows(db: Session, student: User):
    """Read one Student's stored predictions with their current grade, if any."""
    return db.execute(
        select(Prediction, Course, UserGrade.grade)
        .join(Course, Course.id == Prediction.course_id)
        .outerjoin(
            UserGrade,
            and_(
                UserGrade.user_id == student.id,
                UserGrade.course_id == Prediction.course_id,
            ),
        )
        .where(Prediction.user_id == student.id)
        .order_by(Prediction.created_at.desc(), Prediction.id.desc())
    ).all()


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


@router.get("/latest", response_model=StoredPredictionResponse | None)
def get_latest_prediction(
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student)],
) -> StoredPredictionResponse | None:
    """Return the most recent stored result for this Student, if one exists."""
    rows = prediction_history_rows(db, student)
    if not rows:
        return None
    prediction, course, actual_grade = rows[0]
    return stored_prediction_response(prediction, course, actual_grade)


@router.get("/history", response_model=list[StoredPredictionResponse])
def list_prediction_history(
    db: Annotated[Session, Depends(get_db)],
    student: Annotated[User, Depends(require_student)],
) -> list[StoredPredictionResponse]:
    """Return this Student's stored results in deterministic newest-first order."""
    return [
        stored_prediction_response(prediction, course, actual_grade)
        for prediction, course, actual_grade in prediction_history_rows(db, student)
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
