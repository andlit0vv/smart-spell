import hashlib
import hmac
import json
import logging
import os
from typing import Any
from urllib.parse import parse_qs

from flask import Request

from db import get_db_cursor

logger = logging.getLogger(__name__)


def parse_telegram_init_data(raw_init_data: str) -> dict[str, str]:
    params = parse_qs(raw_init_data, keep_blank_values=True)
    return {key: values[0] if values else "" for key, values in params.items()}


def _build_data_check_string(params: dict[str, str]) -> str:
    chunks = [f"{key}={value}" for key, value in sorted(params.items()) if key != "hash"]
    return "\n".join(chunks)


def validate_telegram_init_data(raw_init_data: str, bot_token: str) -> bool:
    if not raw_init_data or not bot_token:
        return False

    params = parse_telegram_init_data(raw_init_data)
    incoming_hash = params.get("hash", "")
    if not incoming_hash:
        return False

    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    check_string = _build_data_check_string(params)
    computed_hash = hmac.new(secret_key, check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_hash, incoming_hash)


def extract_telegram_user(raw_init_data: str) -> dict[str, Any]:
    params = parse_telegram_init_data(raw_init_data)
    user_payload = params.get("user", "")
    if not user_payload:
        return {}

    try:
        user = json.loads(user_payload)
    except json.JSONDecodeError:
        return {}

    return {
        "telegram_id": user.get("id"),
        "username": user.get("username"),
        "first_name": user.get("first_name"),
        "photo_url": user.get("photo_url"),
    }


def normalize_telegram_id(raw_value: Any) -> int:
    try:
        telegram_id = int(str(raw_value).strip())
    except (TypeError, ValueError) as error:
        raise ValueError("Telegram user id must be a positive integer.") from error

    if telegram_id <= 0:
        raise ValueError("Telegram user id must be positive.")

    return telegram_id


def resolve_telegram_context(flask_request: Request) -> dict[str, Any]:
    init_data = flask_request.headers.get("X-Telegram-Init-Data", "").strip()
    parsed_user = extract_telegram_user(init_data) if init_data else {}

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    is_verified = validate_telegram_init_data(init_data, bot_token) if init_data and bot_token else bool(init_data)

    header_id = flask_request.headers.get("X-Telegram-Id", "").strip()
    query_id = (flask_request.args.get("telegram_id") or "").strip()
    env_id = os.getenv("LOCAL_TEST_TELEGRAM_ID", "").strip()

    logger.info(
        "[Auth] Incoming Telegram auth payload | has_init_data=%s parsed_user_id=%s header_id=%s query_id=%s has_bot_token=%s verified=%s",
        bool(init_data),
        parsed_user.get("telegram_id"),
        bool(header_id),
        bool(query_id),
        bool(bot_token),
        is_verified,
    )

    raw_id = header_id or query_id or parsed_user.get("telegram_id") or env_id
    if not raw_id:
        raise ValueError(
            "Telegram user id is missing. Provide X-Telegram-Init-Data/X-Telegram-Id "
            "or set LOCAL_TEST_TELEGRAM_ID."
        )

    telegram_id = normalize_telegram_id(raw_id)
    logger.info("[Auth] Resolved telegram_id=%s source=%s", telegram_id, (
        "header" if header_id else "query" if query_id else "init_data" if parsed_user.get("telegram_id") else "env"
    ))
    username = (
        flask_request.headers.get("X-Telegram-Username", "").strip()
        or (parsed_user.get("username") or "").strip()
        or os.getenv("LOCAL_TEST_USERNAME", "").strip()
        or f"local_{telegram_id}"
    )
    first_name = (
        flask_request.headers.get("X-Telegram-First-Name", "").strip()
        or (parsed_user.get("first_name") or "").strip()
        or os.getenv("LOCAL_TEST_FIRST_NAME", "").strip()
        or "Local Tester"
    )

    context = {
        "telegram_id": telegram_id,
        "username": username,
        "first_name": first_name,
        "photo_url": (parsed_user.get("photo_url") or "").strip(),
        "is_test_user": not is_verified,
        "is_verified": is_verified,
    }
    logger.info(
        "[Auth] Final context telegram_id=%s username=%s first_name=%s is_test_user=%s",
        context["telegram_id"],
        context["username"],
        context["first_name"],
        context["is_test_user"],
    )
    return context


def get_or_create_user(context: dict[str, Any]) -> dict[str, Any]:
    with get_db_cursor(commit=True) as cursor:
        cursor.execute(
            '''
            INSERT INTO users (telegram_id, username, first_name, is_test_user)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (telegram_id)
            DO UPDATE SET
                username = COALESCE(NULLIF(EXCLUDED.username, ''), users.username),
                first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), users.first_name),
                is_test_user = EXCLUDED.is_test_user,
                updated_at = NOW()
            RETURNING id, telegram_id, username, first_name, is_test_user
            ''',
            (
                context["telegram_id"],
                context["username"],
                context["first_name"],
                context["is_test_user"],
            ),
        )
        user = dict(cursor.fetchone())

    user["photo_url"] = context.get("photo_url") or ""
    user["is_verified"] = bool(context.get("is_verified"))
    return user


def resolve_current_user(flask_request: Request) -> dict[str, Any]:
    return get_or_create_user(resolve_telegram_context(flask_request))
