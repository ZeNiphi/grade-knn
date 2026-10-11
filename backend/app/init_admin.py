"""Create the initial Admin and apply an explicitly configured password."""

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session, sessionmaker

from .config import Settings, load_settings
from .database import create_sqlite_engine, initialize_database
from .models import ADMIN_ROLE, User
from .schemas import CredentialsRequest
from .security import hash_password, verify_password


def setup_initial_admin(settings: Settings, sessions: sessionmaker[Session]) -> str:
    """Preserve existing users unless the Admin password is explicitly configured."""
    try:
        credentials = CredentialsRequest(
            username=settings.initial_admin_username,
            password=settings.initial_admin_password,
        )
    except ValueError:
        raise ValueError("Initial Admin credentials are invalid") from None

    with sessions.begin() as session:
        password_hash = hash_password(credentials.password)
        result = session.execute(
            sqlite_insert(User)
            .values(
                username=credentials.username,
                password_hash=password_hash,
                role=ADMIN_ROLE,
                is_active=True,
            )
            .on_conflict_do_nothing(index_elements=[User.username])
        )
        if result.rowcount == 1:
            return "created"
        existing = session.scalar(select(User).where(User.username == credentials.username))
        if existing.role != ADMIN_ROLE:
            return "username_taken"
        if settings.initial_admin_password_configured and not verify_password(
            credentials.password, existing.password_hash
        ):
            existing.password_hash = password_hash
            return "password_updated"
        return "existing_admin"


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
        "password_updated": "Initial Admin password updated from configuration.",
        "username_taken": "Initial Admin was not created: username belongs to a Student.",
    }
    print(messages[result])


if __name__ == "__main__":
    main()
