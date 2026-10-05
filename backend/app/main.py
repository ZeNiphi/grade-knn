"""Minimal API foundation with a database-backed health check."""

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from .auth import router as auth_router
from .config import Settings, load_settings
from .courses import router as courses_router
from .database import create_sqlite_engine, get_db
from .grades import router as grades_router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    engine = create_sqlite_engine(settings.database_path)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="Course Grade Prediction", lifespan=lifespan)
    app.state.session_factory = sessionmaker(bind=engine)
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(SQLAlchemyError)
    async def database_error(_request: Request, _error: SQLAlchemyError):
        return JSONResponse(
            status_code=500,
            content={"code": "INTERNAL_ERROR", "message": "An internal error occurred."},
        )

    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, error: HTTPException):
        if isinstance(error.detail, dict) and "code" in error.detail:
            return JSONResponse(
                status_code=error.status_code,
                content=error.detail,
                headers=error.headers,
            )
        return JSONResponse(status_code=error.status_code, content={"detail": error.detail})

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, error: RequestValidationError):
        fields = sorted({str(item["loc"][-1]) for item in error.errors()})
        if "grade" in fields:
            return JSONResponse(
                status_code=422,
                content={
                    "code": "INVALID_GRADE",
                    "message": "Grade must be an integer from 0 to 100.",
                },
            )
        return JSONResponse(
            status_code=422,
            content={
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "details": {"fields": fields},
            },
        )

    @app.get("/health")
    def health(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
        db.execute(text("SELECT 1"))
        return {"status": "healthy"}

    app.include_router(auth_router)
    app.include_router(courses_router)
    app.include_router(grades_router)

    return app
