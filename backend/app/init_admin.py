"""Create the configured initial Admin account without changing existing users."""

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from .config import Settings, load_settings
from .database import create_sqlite_engine, initialize_database
from .models import ADMIN_ROLE, User
from .schemas import CredentialsRequest
from .security import hash_password


def setup_initial_admin(settings: Settings, sessions: sessionmaker[Session]) -> str:
    """Create the configured Admin only when its username is not already in use."""
    try:
        credentials = CredentialsRequest(
            username=settings.initial_admin_username,
            password=settings.initial_admin_password,
        )
    except ValueError:
        raise ValueError("INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD are invalid") from None

    with sessions.begin() as session:
        existing = session.scalar(
            select(User).where(User.username == credentials.username)
        )
        if existing is not None:
            return "existing_admin" if existing.role == ADMIN_ROLE else "username_taken"
        session.add(
            User(
                username=credentials.username,
                password_hash=hash_password(credentials.password),
                role=ADMIN_ROLE,
            )
        )
    return "created"


def main() -> None:
    settings = load_settings()
    engine = create_sqlite_engine(settings.database_path)
    try:
        initialize_database(engine)
        result = setup_initial_admin(settings, sessionmaker(bind=engine))
    finally:
        engine.dispose()

    messages = {
        "created": "Initial Admin account created.",
        "existing_admin": "Initial Admin already exists; password and role were preserved.",
        "username_taken": "Initial Admin was not created: username belongs to a Student.",
    }
    print(messages[result])


if __name__ == "__main__":
    main()
