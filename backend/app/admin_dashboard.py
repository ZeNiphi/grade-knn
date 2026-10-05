"""Small Admin summary and persisted KNN-setting endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .auth import require_admin
from .database import get_db
from .models import (
    STUDENT_ROLE,
    Course,
    HistoricalGrade,
    HistoricalStudent,
    KNNSetting,
    User,
    UserGrade,
)
from .schemas import AdminSummaryResponse, KNNSettingResponse, KNNSettingWrite

router = APIRouter(prefix="/admin", tags=["admin dashboard"])


def get_current_k(db: Session) -> int:
    """Return the initialized singleton value used by future prediction requests."""
    setting = db.get(KNNSetting, 1)
    if setting is None:
        raise RuntimeError("KNN setting has not been initialized.")
    return setting.k


@router.get("/summary", response_model=AdminSummaryResponse)
def get_admin_summary(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> AdminSummaryResponse:
    return AdminSummaryResponse(
        registered_account_count=db.scalar(select(func.count(User.id))),
        active_student_count=db.scalar(
            select(func.count(User.id)).where(
                User.role == STUDENT_ROLE, User.is_active.is_(True)
            )
        ),
        course_count=db.scalar(select(func.count(Course.id))),
        active_course_count=db.scalar(
            select(func.count(Course.id)).where(Course.is_active.is_(True))
        ),
        historical_student_count=db.scalar(select(func.count(HistoricalStudent.id))),
        active_historical_student_count=db.scalar(
            select(func.count(HistoricalStudent.id)).where(
                HistoricalStudent.is_active_for_knn.is_(True)
            )
        ),
        stored_grade_count=(
            db.scalar(select(func.count(UserGrade.id)))
            + db.scalar(select(func.count(HistoricalGrade.id)))
        ),
    )


@router.get("/knn-setting", response_model=KNNSettingResponse)
def get_knn_setting(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> KNNSettingResponse:
    return KNNSettingResponse(k=get_current_k(db))


@router.put("/knn-setting", response_model=KNNSettingResponse)
def update_knn_setting(
    payload: KNNSettingWrite,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> KNNSettingResponse:
    setting = db.get(KNNSetting, 1)
    if setting is None:
        raise RuntimeError("KNN setting has not been initialized.")
    setting.k = payload.k
    db.commit()
    return KNNSettingResponse(k=setting.k)
