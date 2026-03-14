import os
import re
from contextlib import contextmanager
from typing import Iterator
from urllib.parse import quote, unquote

import psycopg2
from psycopg2.extras import RealDictCursor


def _encode_password_in_postgres_url(database_url: str) -> str:
    """Encode password part in postgres URL if raw special chars are used."""
    match = re.match(r'^(postgres(?:ql)?://)([^:@/]+):(.+)@([^/]+)/(.*)$', database_url)
    if not match:
        return database_url

    prefix, username, raw_password, host_part, db_part = match.groups()
    encoded_password = quote(unquote(raw_password), safe='')
    return f'{prefix}{username}:{encoded_password}@{host_part}/{db_part}'


def get_database_url() -> str:
    database_url = os.getenv('DATABASE_URL', '').strip()
    if not database_url:
        raise RuntimeError('DATABASE_URL is not set. Please configure Supabase/Postgres connection string.')
    return _encode_password_in_postgres_url(database_url)


@contextmanager
def get_db_connection() -> Iterator[psycopg2.extensions.connection]:
    connection = psycopg2.connect(get_database_url(), cursor_factory=RealDictCursor)
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
