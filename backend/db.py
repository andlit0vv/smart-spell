import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv


CONNECT_TIMEOUT_SECONDS = 8
PLACEHOLDER_TOKENS = ("<PASSWORD>", "<YOUR_", "CHANGE_ME")


def _load_env_files() -> None:
    """Load env from repo root and backend folder."""
    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent

    load_dotenv(repo_root / ".env")
    # Never override already exported environment variables (for example, systemd
    # EnvironmentFile values in production).
    load_dotenv(backend_dir / ".env")


_load_env_files()


def _is_placeholder(value: str) -> bool:
    normalized = value.strip()
    if not normalized:
        return False
    upper_value = normalized.upper()
    return any(token in upper_value for token in PLACEHOLDER_TOKENS)


def _read_env_value(*keys: str, default: str = "") -> str:
    for key in keys:
        value = os.getenv(key)
        if value is None:
            continue
        normalized = value.strip()
        if not normalized or _is_placeholder(normalized):
            continue
        return normalized
    return default


def _build_connection_candidates() -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    database_url = _read_env_value("DATABASE_URL")

    if database_url:
        candidates.append({"source": "DATABASE_URL", "database_url": database_url})

    # Explicit per-field config when DATABASE_URL is not provided.
    config = {
        "user": _read_env_value("PGUSER", "DB_USER", "user", default="andrey"),
        "password": _read_env_value("PGPASSWORD", "DB_PASSWORD", "password", default=""),
        "host": _read_env_value("PGHOST", "DB_HOST", "host", default="localhost"),
        "port": _read_env_value("PGPORT", "DB_PORT", "port", default="5432"),
        "dbname": _read_env_value("PGDATABASE", "DB_NAME", "dbname", default="anovadb"),
    }

    has_required_fields = all([config["user"], config["host"], config["port"], config["dbname"]])
    if has_required_fields:
        candidates.append({"source": "PG*", **config})

    return candidates


def get_db_target_summary() -> dict[str, str]:
    candidates = _build_connection_candidates()
    if not candidates:
        return {
            "source": "none",
            "error": "No valid DB config found. Check DATABASE_URL or PG* variables.",
            "sslmode": os.getenv("PGSSLMODE", "prefer"),
        }

    config = candidates[0]
    if "database_url" in config:
        return {
            "source": config["source"],
            "database_url": config["database_url"],
            "sslmode": os.getenv("PGSSLMODE", "prefer"),
        }

    return {
        "source": config["source"],
        "user": config["user"],
        "host": config["host"],
        "port": config["port"],
        "dbname": config["dbname"],
        "sslmode": os.getenv("PGSSLMODE", "prefer"),
    }


@contextmanager
def get_db_connection() -> Iterator[psycopg2.extensions.connection]:
    candidates = _build_connection_candidates()
    if not candidates:
        raise psycopg2.OperationalError(
            "No valid DB config found. DATABASE_URL/PG* env values are missing or still placeholders."
        )

    connection = None
    last_error: Exception | None = None

    try:
        for config in candidates:
            try:
                if "database_url" in config:
                    connection = psycopg2.connect(
                        config["database_url"],
                        sslmode=os.getenv("PGSSLMODE", "prefer"),
                        connect_timeout=CONNECT_TIMEOUT_SECONDS,
                        cursor_factory=RealDictCursor,
                    )
                else:
                    connection = psycopg2.connect(
                        user=config["user"],
                        password=config["password"],
                        host=config["host"],
                        port=config["port"],
                        dbname=config["dbname"],
                        sslmode=os.getenv("PGSSLMODE", "prefer"),
                        connect_timeout=CONNECT_TIMEOUT_SECONDS,
                        cursor_factory=RealDictCursor,
                    )
                break
            except Exception as error:
                last_error = error
                connection = None
                continue

        if connection is None:
            raise last_error or psycopg2.OperationalError("Unable to connect using provided DB configuration.")

        # Проверка запроса
        with connection.cursor() as cur:
            cur.execute("SELECT now();")

        yield connection

    except Exception as e:
        print("\n❌ Database connection failed")
        print("Error type:", type(e).__name__)
        print("Error message:", e)
        raise

    finally:
        if connection is not None:
            connection.close()



@contextmanager
def get_db_cursor(commit: bool = False) -> Iterator[psycopg2.extensions.cursor]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        try:
            yield cursor
            if commit:
                connection.commit()
                print("💾 Transaction committed")
        except Exception:
            connection.rollback()
            print("↩️ Transaction rolled back")
            raise
        finally:
            cursor.close()
            print("🧹 Cursor closed")
