import os
import re
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit, urlunsplit

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv


CONNECT_TIMEOUT_SECONDS = 8


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


def _ensure_connect_timeout_in_postgres_url(database_url: str) -> str:
    """Prevent long request hangs when upstream DB endpoint is unreachable."""
    parsed = urlsplit(database_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))

    if not query.get('connect_timeout'):
        query['connect_timeout'] = str(CONNECT_TIMEOUT_SECONDS)

    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))


def _normalize_database_url(database_url: str) -> str:
    return _ensure_connect_timeout_in_postgres_url(
        _ensure_sslmode_in_postgres_url(_encode_password_in_postgres_url(database_url))
    )


def _normalize_database_dsn(database_dsn: str) -> str:
    """Normalize key-value DSN format from Supabase UI (session pooler tab)."""
    if 'connect_timeout=' not in database_dsn:
        database_dsn = f'{database_dsn} connect_timeout={CONNECT_TIMEOUT_SECONDS}'.strip()

    if 'sslmode=' not in database_dsn:
        database_dsn = f'{database_dsn} sslmode=require'.strip()

    return database_dsn


def _normalize_database_connection_value(raw_connection_value: str) -> str:
    """Accept either URL or key-value DSN without changing callers."""
    if '://' in raw_connection_value:
        return _normalize_database_url(raw_connection_value)
    return _normalize_database_dsn(raw_connection_value)


def _read_database_urls() -> list[str]:
    """Build prioritized unique list of DB connection strings to try for each request."""
    candidates: list[str] = []

    # Primary flow: Session Pooler first (works better on IPv4-only networks).
    for env_key in (
        'DATABASE_POOLER_DSN',
        'DATABASE_POOLER_URL',
        'DATABASE_URL',
        'DATABASE_DIRECT_URL',
    ):
        value = os.getenv(env_key, '').strip()
        if value:
            candidates.append(value)

    urls: list[str] = []
    seen = set()
    for raw_url in candidates:
        normalized = _normalize_database_connection_value(raw_url)
        if normalized in seen:
            continue
        seen.add(normalized)
        urls.append(normalized)

    return urls


def get_database_url() -> str:
    """Backward-compatible accessor for primary URL (first configured candidate)."""
    urls = _read_database_urls()
    if not urls:
        raise RuntimeError(
            'No database connection is configured. Set DATABASE_POOLER_URL (or DATABASE_POOLER_DSN) and optionally DATABASE_URL.'
        )
    return urls[0]


def get_pooler_database_url() -> str | None:
    pooler_database_url = (
        os.getenv('DATABASE_POOLER_URL', '').strip()
        or os.getenv('DATABASE_POOLER_DSN', '').strip()
    )
    if not pooler_database_url:
        return None
    return _normalize_database_connection_value(pooler_database_url)


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
    database_urls = _read_database_urls()
    if not database_urls:
        raise RuntimeError(
            'No database connection is configured. Set DATABASE_POOLER_URL (or DATABASE_POOLER_DSN) and optionally DATABASE_URL.'
        )

    primary_database_url = database_urls[0]
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
