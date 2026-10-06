"""Framework-independent KNN profile, selection, prediction, and baseline logic."""

from dataclasses import dataclass
from math import sqrt
from typing import Literal, Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    STUDENT_ROLE,
    HistoricalGrade,
    HistoricalStudent,
    User,
    UserGrade,
)

MINIMUM_INPUT_GRADES = 5
MINIMUM_COMMON_COURSES = 5

ProfileType = Literal["registered_student", "historical_student"]
SelectionStatus = Literal["ready", "insufficient_data"]
PredictionStatus = Literal["success", "insufficient_data"]
InsufficientDataCode = Literal[
    "INSUFFICIENT_INPUT_GRADES", "INSUFFICIENT_NEIGHBORS"
]
ZERO_DISTANCE_TOLERANCE = 1e-9


@dataclass(frozen=True)
class KNNProfile:
    """One profile's non-target inputs and its separately held target grade."""

    profile_type: ProfileType
    profile_id: int
    input_grades: Mapping[int, int]
    target_grade: int | None


@dataclass(frozen=True)
class EligibleCandidate:
    """A profile that passed the minimum shared-course and target-grade rules."""

    profile: KNNProfile
    common_course_ids: frozenset[int]


@dataclass(frozen=True)
class CandidateEligibility:
    """The requester profile and the candidates suitable for later KNN stages."""

    requester: KNNProfile
    eligible_candidates: tuple[EligibleCandidate, ...]

    @property
    def has_required_input_grades(self) -> bool:
        return len(self.requester.input_grades) >= MINIMUM_INPUT_GRADES


@dataclass(frozen=True)
class ScoredCandidate:
    """An eligible candidate with its unrounded RMSE distance."""

    candidate: EligibleCandidate
    distance: float


@dataclass(frozen=True)
class NeighborSelection:
    """Ranked candidates and either exactly k neighbors or an expected shortfall."""

    status: SelectionStatus
    required_count: int
    eligible_candidate_count: int
    ranked_candidates: tuple[ScoredCandidate, ...]
    neighbors: tuple[ScoredCandidate, ...]


@dataclass(frozen=True)
class KNNPredictionResult:
    """A prediction or an expected insufficient-data outcome for one request."""

    status: PredictionStatus
    target_course_id: int
    predicted_grade: float | None
    course_average: float | None
    k: int
    neighbor_count: int
    minimum_common_courses: int
    neighbors: tuple[ScoredCandidate, ...]
    code: InsufficientDataCode | None
    message: str | None
    details: Mapping[str, int]


def _profile_from_grade_rows(
    profile_type: ProfileType,
    profile_id: int,
    grade_rows: list[tuple[int, int]],
    target_course_id: int,
) -> KNNProfile:
    """Separate the target grade so it cannot enter a later similarity calculation."""
    input_grades: dict[int, int] = {}
    target_grade: int | None = None
    for course_id, grade in grade_rows:
        if course_id == target_course_id:
            target_grade = grade
        else:
            input_grades[course_id] = grade
    return KNNProfile(
        profile_type=profile_type,
        profile_id=profile_id,
        input_grades=input_grades,
        target_grade=target_grade,
    )


def build_requester_profile(
    db: Session, requester: User, target_course_id: int
) -> KNNProfile:
    """Build a Student's target-safe KNN input profile from stored user grades."""
    rows = db.execute(
        select(UserGrade.course_id, UserGrade.grade).where(
            UserGrade.user_id == requester.id
        )
    ).all()
    return _profile_from_grade_rows(
        "registered_student", requester.id, rows, target_course_id
    )


def _build_historical_profile(
    db: Session, historical_student_id: int, target_course_id: int
) -> KNNProfile:
    rows = db.execute(
        select(HistoricalGrade.course_id, HistoricalGrade.grade).where(
            HistoricalGrade.historical_student_id == historical_student_id
        )
    ).all()
    return _profile_from_grade_rows(
        "historical_student", historical_student_id, rows, target_course_id
    )


def _build_registered_student_profile(
    db: Session, student_id: int, target_course_id: int
) -> KNNProfile:
    rows = db.execute(
        select(UserGrade.course_id, UserGrade.grade).where(UserGrade.user_id == student_id)
    ).all()
    return _profile_from_grade_rows(
        "registered_student", student_id, rows, target_course_id
    )


def common_non_target_course_ids(
    requester: KNNProfile, candidate: KNNProfile
) -> frozenset[int]:
    """Return the shared courses available for a future similarity calculation."""
    return frozenset(requester.input_grades) & frozenset(candidate.input_grades)


def candidate_is_eligible(
    requester: KNNProfile, candidate: KNNProfile
) -> EligibleCandidate | None:
    """Apply only the candidate rules; no distance or ranking is calculated here."""
    if candidate.target_grade is None:
        return None

    common_course_ids = common_non_target_course_ids(requester, candidate)
    if len(common_course_ids) < MINIMUM_COMMON_COURSES:
        return None

    return EligibleCandidate(
        profile=candidate,
        common_course_ids=common_course_ids,
    )


def rmse_distance(requester: KNNProfile, candidate: EligibleCandidate) -> float:
    """Calculate RMSE across each shared non-target course with equal weighting."""
    common_course_ids = candidate.common_course_ids
    if not common_course_ids:
        raise ValueError("RMSE requires at least one common non-target course.")

    squared_error_sum = sum(
        (requester.input_grades[course_id] - candidate.profile.input_grades[course_id])
        ** 2
        for course_id in common_course_ids
    )
    return sqrt(squared_error_sum / len(common_course_ids))


def _scored_candidate_sort_key(
    scored_candidate: ScoredCandidate,
) -> tuple[float, int, str, int]:
    """Keep ranking deterministic without rounding a calculated distance."""
    profile = scored_candidate.candidate.profile
    return (
        scored_candidate.distance,
        -len(scored_candidate.candidate.common_course_ids),
        profile.profile_type,
        profile.profile_id,
    )


def rank_eligible_candidates(
    eligibility: CandidateEligibility,
) -> tuple[ScoredCandidate, ...]:
    """Score and deterministically rank the already-eligible candidate pool."""
    scored_candidates = [
        ScoredCandidate(
            candidate=candidate,
            distance=rmse_distance(eligibility.requester, candidate),
        )
        for candidate in eligibility.eligible_candidates
    ]
    return tuple(sorted(scored_candidates, key=_scored_candidate_sort_key))


def select_nearest_neighbors(
    eligibility: CandidateEligibility, k: int
) -> NeighborSelection:
    """Select exactly k ranked candidates, or return the expected shortfall."""
    if isinstance(k, bool) or not isinstance(k, int) or k < 1:
        raise ValueError("k must be a positive integer.")

    ranked_candidates = rank_eligible_candidates(eligibility)
    eligible_candidate_count = len(ranked_candidates)
    if eligible_candidate_count < k:
        return NeighborSelection(
            status="insufficient_data",
            required_count=k,
            eligible_candidate_count=eligible_candidate_count,
            ranked_candidates=ranked_candidates,
            neighbors=(),
        )

    return NeighborSelection(
        status="ready",
        required_count=k,
        eligible_candidate_count=eligible_candidate_count,
        ranked_candidates=ranked_candidates,
        neighbors=ranked_candidates[:k],
    )


def calculate_target_course_average(
    db: Session, requester: User, target_course_id: int
) -> float | None:
    """Average target grades from active non-requester KNN profiles only."""
    historical_grades = db.scalars(
        select(HistoricalGrade.grade)
        .join(
            HistoricalStudent,
            HistoricalStudent.id == HistoricalGrade.historical_student_id,
        )
        .where(
            HistoricalGrade.course_id == target_course_id,
            HistoricalStudent.is_active_for_knn.is_(True),
        )
    ).all()
    registered_student_grades = db.scalars(
        select(UserGrade.grade)
        .join(User, User.id == UserGrade.user_id)
        .where(
            UserGrade.course_id == target_course_id,
            User.role == STUDENT_ROLE,
            User.is_active.is_(True),
            User.id != requester.id,
        )
    ).all()
    grades = [*historical_grades, *registered_student_grades]
    if not grades:
        return None
    return sum(grades) / len(grades)


def _target_grade(scored_candidate: ScoredCandidate) -> int:
    target_grade = scored_candidate.candidate.profile.target_grade
    if target_grade is None:
        raise ValueError("A selected KNN candidate requires a target grade.")
    return target_grade


def clamp_prediction(prediction: float) -> float:
    """Keep a calculated result in the supported grade range without rounding it."""
    return min(100.0, max(0.0, prediction))


def calculate_prediction_from_neighbors(
    neighbors: tuple[ScoredCandidate, ...],
) -> float:
    """Calculate the unrounded, clamped KNN prediction from exactly selected neighbors."""
    if not neighbors:
        raise ValueError("KNN prediction requires at least one selected neighbor.")
    if any(scored_candidate.distance < 0 for scored_candidate in neighbors):
        raise ValueError("KNN distance cannot be negative.")

    zero_distance_target_grades = [
        _target_grade(scored_candidate)
        for scored_candidate in neighbors
        if 0 <= scored_candidate.distance <= ZERO_DISTANCE_TOLERANCE
    ]
    if zero_distance_target_grades:
        return clamp_prediction(
            sum(zero_distance_target_grades) / len(zero_distance_target_grades)
        )

    weights = [1 / scored_candidate.distance for scored_candidate in neighbors]
    weighted_target_sum = sum(
        weight * _target_grade(scored_candidate)
        for weight, scored_candidate in zip(weights, neighbors, strict=True)
    )
    return clamp_prediction(weighted_target_sum / sum(weights))


def calculate_knn_prediction(
    db: Session, requester: User, target_course_id: int, k: int
) -> KNNPredictionResult:
    """Return a complete domain result without depending on HTTP or persistence."""
    course_average = calculate_target_course_average(db, requester, target_course_id)
    eligibility = build_candidate_eligibility(db, requester, target_course_id)
    input_grade_count = len(eligibility.requester.input_grades)
    if not eligibility.has_required_input_grades:
        return KNNPredictionResult(
            status="insufficient_data",
            target_course_id=target_course_id,
            predicted_grade=None,
            course_average=course_average,
            k=k,
            neighbor_count=0,
            minimum_common_courses=MINIMUM_COMMON_COURSES,
            neighbors=(),
            code="INSUFFICIENT_INPUT_GRADES",
            message="At least five usable non-target grades are required.",
            details={"found": input_grade_count, "required": MINIMUM_INPUT_GRADES},
        )

    selection = select_nearest_neighbors(eligibility, k)
    if selection.status == "insufficient_data":
        return KNNPredictionResult(
            status="insufficient_data",
            target_course_id=target_course_id,
            predicted_grade=None,
            course_average=course_average,
            k=k,
            neighbor_count=0,
            minimum_common_courses=MINIMUM_COMMON_COURSES,
            neighbors=(),
            code="INSUFFICIENT_NEIGHBORS",
            message=(
                f"{selection.eligible_candidate_count} eligible neighbors found; "
                f"{selection.required_count} required."
            ),
            details={
                "found": selection.eligible_candidate_count,
                "required": selection.required_count,
            },
        )

    return KNNPredictionResult(
        status="success",
        target_course_id=target_course_id,
        predicted_grade=calculate_prediction_from_neighbors(selection.neighbors),
        course_average=course_average,
        k=k,
        neighbor_count=len(selection.neighbors),
        minimum_common_courses=MINIMUM_COMMON_COURSES,
        neighbors=selection.neighbors,
        code=None,
        message=None,
        details={},
    )


def build_candidate_eligibility(
    db: Session, requester: User, target_course_id: int
) -> CandidateEligibility:
    """Build the active, non-self candidate pool from persisted grade records.

    Existing grades for inactive courses intentionally remain inputs.  Candidate
    account/profile activity, rather than course activity, determines whether a
    stored profile can participate.
    """
    requester_profile = build_requester_profile(db, requester, target_course_id)
    if len(requester_profile.input_grades) < MINIMUM_INPUT_GRADES:
        return CandidateEligibility(requester_profile, ())

    eligible_candidates: list[EligibleCandidate] = []

    historical_students = db.scalars(
        select(HistoricalStudent).where(HistoricalStudent.is_active_for_knn.is_(True))
    ).all()
    for historical_student in historical_students:
        candidate = _build_historical_profile(
            db, historical_student.id, target_course_id
        )
        eligible = candidate_is_eligible(requester_profile, candidate)
        if eligible is not None:
            eligible_candidates.append(eligible)

    registered_students = db.scalars(
        select(User).where(
            User.role == STUDENT_ROLE,
            User.is_active.is_(True),
            User.id != requester.id,
        )
    ).all()
    for student in registered_students:
        candidate = _build_registered_student_profile(db, student.id, target_course_id)
        eligible = candidate_is_eligible(requester_profile, candidate)
        if eligible is not None:
            eligible_candidates.append(eligible)

    return CandidateEligibility(requester_profile, tuple(eligible_candidates))
