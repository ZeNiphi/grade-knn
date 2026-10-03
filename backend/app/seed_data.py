"""Create the deterministic historical dataset used for future KNN comparisons.

Run from ``backend`` with ``python -m app.seed_data``.  The generator is kept
out of application startup so normal API use never changes historical data.
"""

from __future__ import annotations

import argparse
import random
from collections import Counter

from sqlalchemy import delete, func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from .config import load_settings
from .database import create_sqlite_engine, initialize_database
from .models import DEFAULT_K, Course, HistoricalGrade, HistoricalStudent

SEED = 20260920
STUDENT_COUNT = 400
COURSE_COUNT = 25
MIN_COURSES_PER_STUDENT = 7
MAX_COURSES_PER_STUDENT = 15
GENERATED_KEY_PREFIX = "seed-"

COURSES = tuple(
    (f"CGP{number:02}", f"Course {number:02}")
    for number in range(1, COURSE_COUNT + 1)
)
CORE_CODES = tuple(code for code, _name in COURSES[:7])
ELECTIVE_CODES = tuple(code for code, _name in COURSES[7:])


def _clamp_grade(value: float) -> int:
    return max(0, min(100, round(value)))


def build_dataset(seed: int = SEED) -> dict:
    """Build and validate a reproducible dataset without touching the database."""
    rng = random.Random(seed)
    difficulties = {
        code: rng.uniform(-9, 9)
        for code, _name in COURSES
    }
    profiles = []

    for index in range(STUDENT_COUNT):
        ability = rng.gauss(75, 10)
        extra_count = rng.randint(1, 8)
        if index == 0:
            # Keep one deterministic sparse-input case for honest insufficiency reporting.
            selected = list(ELECTIVE_CODES[:5])
        else:
            required_extra = ELECTIVE_CODES[index % len(ELECTIVE_CODES)]
            remaining = [code for code in ELECTIVE_CODES if code != required_extra]
            selected = [required_extra, *rng.sample(remaining, extra_count - 1)]
        grades = {
            code: _clamp_grade(ability - difficulties[code] + rng.gauss(0, 5))
            for code in (*CORE_CODES, *sorted(selected))
        }
        profiles.append({
            "generated_key": f"{GENERATED_KEY_PREFIX}{index + 1:04}",
            "grades": grades,
        })

    dataset = {"courses": COURSES, "profiles": profiles}
    validate_dataset(dataset)
    return dataset


def _eligible_candidate_count(
    profiles: list[dict],
    requester_key: str,
    input_codes: set[str],
    target_code: str,
) -> int:
    return sum(
        1
        for candidate in profiles
        if candidate["generated_key"] != requester_key
        and target_code in candidate["grades"]
        and len(input_codes.intersection(candidate["grades"])) >= 5
    )


def overlap_report(dataset: dict) -> dict:
    """Report pre-KNN candidate coverage using the future eligibility rules only."""
    profiles = dataset["profiles"]
    representative_profiles = []
    for requester_index, input_count in ((2, 5), (1, 7), (0, 10)):
        requester = profiles[requester_index]
        targets = []
        for target_code, _name in dataset["courses"]:
            available_inputs = sorted(set(requester["grades"]) - {target_code})
            if len(available_inputs) < input_count:
                raise ValueError("representative requester lacks the required input grades")
            input_codes = set(available_inputs[:input_count])
            candidates = _eligible_candidate_count(
                profiles,
                requester["generated_key"],
                input_codes,
                target_code,
            )
            targets.append({
                "target_code": target_code,
                "eligible_candidates": candidates,
                "status": "ready" if candidates >= DEFAULT_K else "insufficient_data",
            })
        representative_profiles.append({
            "requester": requester["generated_key"],
            "input_count": input_count,
            "targets": targets,
            "minimum_eligible_candidates": min(
                target["eligible_candidates"] for target in targets
            ),
            "maximum_eligible_candidates": max(
                target["eligible_candidates"] for target in targets
            ),
        })

    sparse_requester = profiles[0]
    sparse_inputs = set(ELECTIVE_CODES[:5])
    sparse_target = ELECTIVE_CODES[5]
    sparse_candidates = _eligible_candidate_count(
        profiles,
        sparse_requester["generated_key"],
        sparse_inputs,
        sparse_target,
    )
    insufficient_examples = [
        {
            "requester": sparse_requester["generated_key"],
            "target_code": CORE_CODES[0],
            "input_count": 4,
            "eligible_candidates": 0,
            "status": "insufficient_data",
            "reason": "fewer than 5 non-target input grades",
        },
        {
            "requester": sparse_requester["generated_key"],
            "target_code": sparse_target,
            "input_count": 5,
            "eligible_candidates": sparse_candidates,
            "status": (
                "insufficient_data" if sparse_candidates < DEFAULT_K else "ready"
            ),
            "reason": "fewer than k candidates share five input courses and the target",
        },
    ]
    return {
        "default_k": DEFAULT_K,
        "representative_profiles": representative_profiles,
        "insufficient_examples": insufficient_examples,
    }


def validate_dataset(dataset: dict) -> dict:
    """Validate generated content and return deterministic coverage statistics."""
    courses = dataset["courses"]
    profiles = dataset["profiles"]
    codes = [code for code, _name in courses]
    if len(courses) != COURSE_COUNT or len(set(codes)) != COURSE_COUNT:
        raise ValueError("dataset must contain exactly 25 uniquely coded courses")
    if len(profiles) != STUDENT_COUNT:
        raise ValueError("dataset must contain exactly 400 historical students")

    course_counts: Counter[str] = Counter()
    keys = set()
    for profile in profiles:
        key = profile["generated_key"]
        grades = profile["grades"]
        if not key.startswith(GENERATED_KEY_PREFIX) or key in keys:
            raise ValueError("generated profile keys must be unique")
        keys.add(key)
        if not MIN_COURSES_PER_STUDENT <= len(grades) <= MAX_COURSES_PER_STUDENT:
            raise ValueError("each profile must have 7 to 15 unique courses")
        if any(code not in codes for code in grades):
            raise ValueError("grade references an unknown course")
        for grade in grades.values():
            if isinstance(grade, bool) or not isinstance(grade, int) or not 0 <= grade <= 100:
                raise ValueError("historical grades must be integers from 0 to 100")
        course_counts.update(grades.keys())

    if any(course_counts[code] < DEFAULT_K for code in codes):
        raise ValueError("every course needs at least five historical grades")

    overlap = overlap_report(dataset)
    representative_targets = (
        target
        for profile in overlap["representative_profiles"]
        for target in profile["targets"]
    )
    if any(target["status"] != "ready" for target in representative_targets):
        raise ValueError(
            "every target needs at least five eligible candidates for each representative profile"
        )
    if any(
        example["status"] != "insufficient_data"
        for example in overlap["insufficient_examples"]
    ):
        raise ValueError("fixed insufficient-data cases must remain insufficient")

    return {
        "historical_students": len(profiles),
        "courses": len(courses),
        "historical_grades": sum(len(profile["grades"]) for profile in profiles),
        "course_grade_minimum": min(course_counts.values()),
        "course_grade_maximum": max(course_counts.values()),
        "overlap": overlap,
    }


def generate_historical_data(engine: Engine, *, replace: bool = False) -> dict:
    """Persist validated generated data, leaving all non-generated records untouched."""
    dataset = build_dataset()
    report = validate_dataset(dataset)
    initialize_database(engine)

    with Session(engine) as session:
        existing = session.scalar(
            select(HistoricalStudent.id).where(
                HistoricalStudent.generated_key.like(f"{GENERATED_KEY_PREFIX}%")
            ).limit(1)
        )
        if existing is not None and not replace:
            generated_filter = HistoricalStudent.generated_key.like(
                f"{GENERATED_KEY_PREFIX}%"
            )
            persisted_students = session.scalar(
                select(func.count(HistoricalStudent.id)).where(generated_filter)
            )
            persisted_grades = session.scalar(
                select(func.count(HistoricalGrade.id))
                .join(HistoricalStudent)
                .where(generated_filter)
            )
            persisted_courses = session.scalar(
                select(func.count(func.distinct(HistoricalGrade.course_id)))
                .join(HistoricalStudent)
                .where(generated_filter)
            )
            return {
                "status": "already_exists",
                "historical_students": persisted_students,
                "courses": persisted_courses,
                "historical_grades": persisted_grades,
            }

    with Session(engine) as session, session.begin():
        if replace:
            session.execute(
                delete(HistoricalStudent).where(
                    HistoricalStudent.generated_key.like(f"{GENERATED_KEY_PREFIX}%")
                )
            )

        existing_courses = {
            course.code: course
            for course in session.scalars(select(Course)).all()
        }
        course_ids = {}
        for code, name in dataset["courses"]:
            course = existing_courses.get(code)
            if course is None:
                course = Course(code=code, name=name)
                session.add(course)
                session.flush()
            course_ids[code] = course.id

        for profile_data in dataset["profiles"]:
            student = HistoricalStudent(generated_key=profile_data["generated_key"])
            session.add(student)
            session.flush()
            session.add_all(
                HistoricalGrade(
                    historical_student_id=student.id,
                    course_id=course_ids[code],
                    grade=grade,
                )
                for code, grade in profile_data["grades"].items()
            )

    return {"status": "replaced" if replace else "created", **report}


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate deterministic historical grades")
    parser.add_argument("--replace", action="store_true", help="replace only generated profiles")
    args = parser.parse_args()
    settings = load_settings()
    engine = create_sqlite_engine(settings.database_path)
    try:
        report = generate_historical_data(engine, replace=args.replace)
    finally:
        engine.dispose()
    summary = (
        f"Historical dataset {report['status']}: {report['historical_students']} students, "
        f"{report['courses']} courses, {report['historical_grades']} grades."
    )
    if report["status"] == "already_exists":
        print(f"{summary} Use --replace to rebuild generated profiles.")
        return
    overlap = report["overlap"]["representative_profiles"]
    ready_counts = ", ".join(
        f"{example['input_count']} inputs: {example['minimum_eligible_candidates']} minimum candidates"
        for example in overlap
    )
    print(f"{summary} {ready_counts}.")


if __name__ == "__main__":
    main()
