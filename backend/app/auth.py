"""Student registration endpoint."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import get_db
from .models import ADMIN_ROLE, STUDENT_ROLE, User
from .schemas import LoginRequest, RegisterRequest, RegisteredStudent, TokenResponse
from .security import create_access_token, hash_password, validate_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["authentication"])


def username_taken_response() -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={"code": "USERNAME_TAKEN", "message": "Username is already taken."},
    )


def invalid_credentials_error() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail={
            "code": "INVALID_CREDENTIALS",
            "message": "Invalid username or password.",
        },
    )


def authentication_required_error() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail={
            "code": "AUTHENTICATION_REQUIRED",
            "message": "Authentication is required.",
        },
        headers={"WWW-Authenticate": "Bearer"},
    )


def account_disabled_error() -> HTTPException:
    return HTTPException(
        status_code=403,
        detail={"code": "ACCOUNT_DISABLED", "message": "Account is disabled."},
    )


def forbidden_error() -> HTTPException:
    return HTTPException(
        status_code=403,
        detail={"code": "FORBIDDEN", "message": "Access is not allowed."},
    )


@router.post("/register", response_model=RegisteredStudent, status_code=201)
def register_student(
    registration: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
) -> RegisteredStudent | JSONResponse:
    if db.scalar(select(User.id).where(User.username == registration.username)):
        return username_taken_response()

    user = User(
        username=registration.username,
        password_hash=hash_password(registration.password),
        role=STUDENT_ROLE,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return username_taken_response()
    db.refresh(user)
    return RegisteredStudent(id=user.id, username=user.username, role=user.role)


@router.post("/login", response_model=TokenResponse)
def login(
    credentials: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    user = db.scalar(select(User).where(User.username == credentials.username))
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise invalid_credentials_error()
    if not user.is_active:
        raise account_disabled_error()
    return TokenResponse(
        access_token=create_access_token(user.id, request.app.state.settings)
    )


def get_current_user(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> User:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise authentication_required_error()
    try:
        user_id = validate_access_token(token, request.app.state.settings)
    except ValueError:
        raise authentication_required_error() from None
    user = db.get(User, user_id)
    if user is None:
        raise authentication_required_error()
    if not user.is_active:
        raise account_disabled_error()
    return user


def require_student(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != STUDENT_ROLE:
        raise forbidden_error()
    return user


def require_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != ADMIN_ROLE:
        raise forbidden_error()
    return user


@router.get("/me", response_model=RegisteredStudent)
def current_user(
    user: Annotated[User, Depends(get_current_user)],
) -> RegisteredStudent:
    return RegisteredStudent(id=user.id, username=user.username, role=user.role)
