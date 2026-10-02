"""Create the application schema and default KNN setting."""

from .config import load_settings
from .database import create_sqlite_engine, initialize_database


def main() -> None:
    settings = load_settings()
    engine = create_sqlite_engine(settings.database_path)
    try:
        setting_created = initialize_database(engine)
    finally:
        engine.dispose()
    state = "created" if setting_created else "already present"
    print(f"Database initialized at {settings.database_path} (KNN setting {state}).")


if __name__ == "__main__":
    main()
