import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from urllib.parse import urlparse

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv


CONNECT_TIMEOUT_SECONDS = 8


def _load_env_files() -> None:
    """Load env from repo root and backend folder."""
    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent

    load_dotenv(repo_root / '.env')
    load_dotenv(backend_dir / '.env', override=True)


_load_env_files()


def _apply_database_url_defaults() -> None:
    """If DATABASE_URL is present, use it as source for missing individual fields."""
    database_url = os.getenv('DATABASE_URL', '').strip()
    if not database_url:
        return

    parsed = urlparse(database_url)
    if parsed.scheme not in {'postgres', 'postgresql'}:
        return

    if parsed.username and not os.getenv('user'):
        os.environ['user'] = parsed.username
    if parsed.password and not os.getenv('password'):
        os.environ['password'] = parsed.password
    if parsed.hostname and not os.getenv('host'):
        os.environ['host'] = parsed.hostname
    if parsed.port and not os.getenv('port'):
        os.environ['port'] = str(parsed.port)

    dbname = parsed.path.lstrip('/')
    if dbname and not os.getenv('dbname'):
        os.environ['dbname'] = dbname


def _build_connection_config() -> dict[str, str]:
    _apply_database_url_defaults()

    config = {
        'user': os.getenv('user', '').strip(),
        'password': os.getenv('password', '').strip(),
        'host': os.getenv('host', '').strip(),
        'port': os.getenv('port', '').strip(),
        'dbname': os.getenv('dbname', '').strip(),
    }

    missing = [key for key, value in config.items() if not value]
    if missing:
        raise RuntimeError(
            'No database connection is configured. Set user/password/host/port/dbname in .env '
            'or provide DATABASE_URL.'
        )

    return config


@contextmanager
def get_db_connection() -> Iterator[psycopg2.extensions.connection]:
    config = _build_connection_config()
    connection = psycopg2.connect(
        user=config['user'],
        password=config['password'],
        host=config['host'],
        port=config['port'],
        dbname=config['dbname'],
        connect_timeout=CONNECT_TIMEOUT_SECONDS,
        cursor_factory=RealDictCursor,
        sslmode='require',
    )

    try:
        yield connection
    finally:
        connection.close()


@contextmanager
def get_db_cursor(commit: bool = False) -> Iterator[psycopg2.extensions.cursor]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        try:
            yield cursor
            if commit:
                connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            cursor.close()
