"""Simple Supabase/Postgres smoke test.

Checks only the essentials:
1) connect to DB;
2) ensure schema exists;
3) upsert a test user;
4) upsert one dictionary word;
5) read the word back.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create test user + add test word in Supabase.")
    parser.add_argument(
        "--database-url",
        default="",
        help="Raw DB URL (optional). If empty, DATABASE_URL env var is used.",
    )
    parser.add_argument("--telegram-id", type=int, default=900000001)
    parser.add_argument("--username", default="smart_spell_test_user")
    parser.add_argument("--first-name", default="SmartSpell")
    parser.add_argument("--word", default="resilient")
    parser.add_argument("--definition", default="способный быстро восстанавливаться после сложностей")
    parser.add_argument("--relevance", type=int, default=7)
    return parser.parse_args()


def _rebuild_and_encode_auth(raw_url: str) -> str:
    """Encode username/password safely even if raw URL contains special chars in password."""
    if "://" not in raw_url:
        raise ValueError("Невалидный URL: отсутствует схема (postgresql://...).")

    scheme, rest = raw_url.split("://", 1)
    if "@" not in rest:
        return raw_url

    auth_part, host_part = rest.rsplit("@", 1)
    if ":" not in auth_part:
        return raw_url

    user, password = auth_part.split(":", 1)
    safe_user = quote(user, safe="")
    safe_password = quote(password, safe="")
    rebuilt = f"{scheme}://{safe_user}:{safe_password}@{host_part}"

    parsed = urlsplit(rebuilt)
    if not parsed.scheme or not parsed.hostname:
        raise ValueError("Невалидный URL после обработки логина/пароля.")
    return urlunsplit(parsed)


def resolve_database_url(args: argparse.Namespace) -> str:
    raw = (args.database_url or os.getenv("DATABASE_URL", "")).strip().strip('"').strip("'")
    if not raw:
        raise ValueError("Передайте --database-url или задайте DATABASE_URL.")
    if "[" in raw or "]" in raw:
        raise ValueError("Уберите квадратные скобки из строки подключения.")

    encoded = _rebuild_and_encode_auth(raw)
    if "sslmode=" not in encoded:
        sep = "&" if "?" in encoded else "?"
        encoded = f"{encoded}{sep}sslmode=require"
    return encoded


def load_schema_sql() -> str:
    path = Path(__file__).resolve().parents[1] / "database" / "init_schema.sql"
    return path.read_text(encoding="utf-8")


def main() -> int:
    args = parse_args()

    try:
        import psycopg
        from psycopg.rows import dict_row
    except ModuleNotFoundError as exc:
        raise SystemExit("Установите зависимости: pip install -r backend/requirements.txt") from exc

    database_url = resolve_database_url(args)

    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(load_schema_sql())

            cur.execute(
                """
                INSERT INTO users (telegram_id, username, first_name, is_test_user)
                VALUES (%s, %s, %s, TRUE)
                ON CONFLICT (telegram_id)
                DO UPDATE SET
                    username = EXCLUDED.username,
                    first_name = EXCLUDED.first_name,
                    is_test_user = TRUE,
                    updated_at = NOW()
                RETURNING id, telegram_id, username, first_name, is_test_user;
                """,
                (args.telegram_id, args.username, args.first_name),
            )
            user = cur.fetchone()

            cur.execute(
                """
                INSERT INTO dictionary_words (user_id, word, normalized_word, definition, relevance)
                VALUES (%s, %s, lower(%s), %s, %s)
                ON CONFLICT (user_id, normalized_word)
                DO UPDATE SET
                    word = EXCLUDED.word,
                    definition = EXCLUDED.definition,
                    relevance = EXCLUDED.relevance,
                    updated_at = NOW()
                RETURNING id, word, definition, relevance;
                """,
                (user["id"], args.word, args.word, args.definition, args.relevance),
            )
            word_row = cur.fetchone()

            cur.execute(
                """
                SELECT word, definition, relevance
                FROM dictionary_words
                WHERE user_id = %s AND normalized_word = lower(%s);
                """,
                (user["id"], args.word),
            )
            check_row = cur.fetchone()

    print("✅ Подключение к БД успешно")
    print(f"✅ Тестовый пользователь: {user}")
    print(f"✅ Добавлено/обновлено слово: {word_row}")
    print(f"✅ Проверка чтения: {check_row}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
