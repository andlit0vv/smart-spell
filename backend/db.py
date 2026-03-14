import os
import re
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit, urlunsplit

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv


CONNECT_TIMEOUT_SECONDS = 8
CONNECTION_RETRY_ATTEMPTS = 2
CONNECTION_RETRY_DELAY_SECONDS = 0.25


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


def _read_database_urls() -> list[str]:
    """Build prioritized unique list of DB URLs to try for each request."""
    candidates: list[str] = []

    for env_key in ('DATABASE_URL', 'DATABASE_POOLER_URL'):
        value = os.getenv(env_key, '').strip()
        if value:
            candidates.append(value)

    urls: list[str] = []
    seen = set()
    for raw_url in candidates:
        normalized = _normalize_database_url(raw_url)
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
            'No database URL is configured. Set DATABASE_URL and optionally DATABASE_POOLER_URL.'
        )
    return urls[0]


def get_pooler_database_url() -> str | None:
    pooler_database_url = os.getenv('DATABASE_POOLER_URL', '').strip()
    if not pooler_database_url:
        return None
    return _normalize_database_url(pooler_database_url)


def _connect_once(database_url: str) -> psycopg2.extensions.connection:
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)


def _connect_with_retries(database_url: str) -> psycopg2.extensions.connection:
    last_error: psycopg2.OperationalError | None = None

    for attempt in range(1, CONNECTION_RETRY_ATTEMPTS + 1):
        try:
            return _connect_once(database_url)
        except psycopg2.OperationalError as exc:
            last_error = exc
            if attempt == CONNECTION_RETRY_ATTEMPTS:
                break
            time.sleep(CONNECTION_RETRY_DELAY_SECONDS)

    if last_error:
        raise last_error

    raise RuntimeError('Database connection retries exhausted unexpectedly.')


def _compose_connection_error(errors: list[tuple[str, psycopg2.OperationalError]]) -> psycopg2.OperationalError:
    parts = []
    for idx, (url, error) in enumerate(errors, start=1):
        parsed = urlsplit(url)
        host = parsed.hostname or 'unknown-host'
        port = parsed.port or 5432
        db_name = parsed.path.lstrip('/') or 'unknown-db'
        parts.append(f'[{idx}] {host}:{port}/{db_name} -> {error}')

    combined = 'All configured database endpoints failed. ' + ' | '.join(parts)
    return psycopg2.OperationalError(combined)


@contextmanager
def get_db_connection() -> Iterator[psycopg2.extensions.connection]:
    database_urls = _read_database_urls()
    if not database_urls:
        raise RuntimeError(
            'No database URL is configured. Set DATABASE_URL and optionally DATABASE_POOLER_URL.'
        )

    # Keep explicit names for compatibility with previous debugging and error-reporting flows.
    primary_database_url = database_urls[0]
    pooler_database_url = database_urls[1] if len(database_urls) > 1 else None

    errors: list[tuple[str, psycopg2.OperationalError]] = []
    connection: psycopg2.extensions.connection | None = None

    endpoints_to_try = [primary_database_url]
    if pooler_database_url:
        endpoints_to_try.append(pooler_database_url)

    for database_url in endpoints_to_try:
        try:
            connection = _connect_with_retries(database_url)
            break
        except psycopg2.OperationalError as exc:
            errors.append((database_url, exc))

    if connection is None:
        raise _compose_connection_error(errors)

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
