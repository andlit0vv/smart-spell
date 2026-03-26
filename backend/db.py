import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv


CONNECT_TIMEOUT_SECONDS = 8


def _load_env_files() -> None:
    """Load env from repo root and backend folder."""
    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent

    load_dotenv(repo_root / ".env")
    load_dotenv(backend_dir / ".env", override=True)


_load_env_files()


def _build_connection_config() -> dict[str, str]:
    database_url = os.getenv("DATABASE_URL", "").strip()

    if database_url:
        return {"database_url": database_url}

    # Explicit per-field config when DATABASE_URL is not provided.
    config = {
        "user": os.getenv("PGUSER", os.getenv("user", "andrey")).strip(),
        "password": os.getenv("PGPASSWORD", os.getenv("password", "")).strip(),
        "host": os.getenv("PGHOST", os.getenv("host", "localhost")).strip(),
        "port": os.getenv("PGPORT", os.getenv("port", "5432")).strip(),
        "dbname": os.getenv("PGDATABASE", os.getenv("dbname", "anovadb")).strip(),
    }

    return config


def get_db_target_summary() -> dict[str, str]:
    config = _build_connection_config()
    if "database_url" in config:
        return {
            "source": "DATABASE_URL",
            "database_url": config["database_url"],
            "sslmode": os.getenv("PGSSLMODE", "prefer"),
        }

    return {
        "source": "PG*",
        "user": config["user"],
        "host": config["host"],
        "port": config["port"],
        "dbname": config["dbname"],
        "sslmode": os.getenv("PGSSLMODE", "prefer"),
    }


@contextmanager
def get_db_connection() -> Iterator[psycopg2.extensions.connection]:
    config = _build_connection_config()

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
        if "connection" in locals():
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
