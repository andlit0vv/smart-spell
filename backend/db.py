import os
import re
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit, urlunsplit

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv


def _load_env_files() -> None:
    """Load local env files for backend runs started via `python app.py`."""
    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent

    # Priority: backend/.env overrides repo-root .env for backend-specific settings.
    load_dotenv(repo_root / '.env')
    load_dotenv(backend_dir / '.env', override=True)


_load_env_files()


def _encode_password_in_postgres_url(database_url: str) -> str:
    """Encode password part in postgres URL if raw special chars are used."""
    match = re.match(r'^(postgres(?:ql)?://)([^:@/]+):(.+)@([^/]+)/(.*)$', database_url)
    if not match:
        return database_url

    prefix, username, raw_password, host_part, db_part = match.groups()
    encoded_password = quote(unquote(raw_password), safe='')
    return f'{prefix}{username}:{encoded_password}@{host_part}/{db_part}'


def _ensure_sslmode_in_postgres_url(database_url: str) -> str:
    """Supabase requires TLS; keep explicit sslmode in URL."""
    parsed = urlsplit(database_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))

    if 'sslmode' in query:
        return database_url

    query['sslmode'] = 'require'
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))


def _normalize_database_url(database_url: str) -> str:
    return _ensure_sslmode_in_postgres_url(_encode_password_in_postgres_url(database_url))


def get_database_url() -> str:
    database_url = os.getenv('DATABASE_URL', '').strip()
    if not database_url:
        raise RuntimeError('DATABASE_URL is not set. Please configure Supabase/Postgres connection string.')
    return _normalize_database_url(database_url)


def get_pooler_database_url() -> str | None:
    pooler_database_url = os.getenv('DATABASE_POOLER_URL', '').strip()
    if not pooler_database_url:
        return None
    return _normalize_database_url(pooler_database_url)


def _is_retryable_primary_error(error: psycopg2.OperationalError) -> bool:
    """Decide if we should retry connection via pooler when primary URL fails."""
    message = str(error).lower()

    retryable_fragments = (
        'could not translate host name',
        'could not connect to server',
        'connection refused',
        'network is unreachable',
        'connection timed out',
        'timeout expired',
        'server closed the connection unexpectedly',
        'no route to host',
    )
    return any(fragment in message for fragment in retryable_fragments)


@contextmanager
def get_db_connection() -> Iterator[psycopg2.extensions.connection]:
    primary_database_url = get_database_url()
    pooler_database_url = get_pooler_database_url()

    try:
        connection = psycopg2.connect(primary_database_url, cursor_factory=RealDictCursor)
    except psycopg2.OperationalError as exc:
        should_try_pooler = (
            pooler_database_url
            and pooler_database_url != primary_database_url
            and _is_retryable_primary_error(exc)
        )
        if not should_try_pooler:
            raise
        connection = psycopg2.connect(pooler_database_url, cursor_factory=RealDictCursor)

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
