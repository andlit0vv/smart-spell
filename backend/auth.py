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


def _is_permissive_auth_mode() -> bool:
    return os.getenv("TELEGRAM_AUTH_MODE", "strict").strip().lower() in {"permissive", "dev"}


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
        "last_name": user.get("last_name"),
        "language_code": user.get("language_code"),
        "is_premium": bool(user.get("is_premium")),
        "allows_write_to_pm": bool(user.get("allows_write_to_pm")),
        "photo_url": user.get("photo_url"),
        "raw_user": user,
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
    fallback_user_header = flask_request.headers.get("X-Telegram-User", "").strip()
    parsed_user: dict[str, Any] = {}

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    is_verified = False

    permissive_mode = _is_permissive_auth_mode()

    if init_data:
        parsed_user = extract_telegram_user(init_data)

        if not bot_token:
            if permissive_mode and parsed_user.get("telegram_id"):
                logger.warning(
                    "[Auth] TELEGRAM_BOT_TOKEN is missing, accepting unsigned init_data because TELEGRAM_AUTH_MODE=%s.",
                    os.getenv("TELEGRAM_AUTH_MODE", "strict"),
                )
            else:
                raise RuntimeError("TELEGRAM_BOT_TOKEN is required to verify Telegram init data.")

        if bot_token:
            is_verified = validate_telegram_init_data(init_data, bot_token)
            if not is_verified:
                if permissive_mode and parsed_user.get("telegram_id"):
                    logger.warning(
                        "[Auth] Telegram init_data signature validation failed, but request accepted in permissive mode."
                    )
                else:
                    raise ValueError("Telegram init data signature verification failed.")
    elif fallback_user_header:
        try:
            raw_user = json.loads(fallback_user_header)
        except json.JSONDecodeError as error:
            raise ValueError("X-Telegram-User header must be a valid JSON object.") from error

        parsed_user = {
            "telegram_id": raw_user.get("id"),
            "username": raw_user.get("username"),
            "first_name": raw_user.get("first_name"),
            "last_name": raw_user.get("last_name"),
            "language_code": raw_user.get("language_code"),
            "is_premium": bool(raw_user.get("is_premium")),
            "allows_write_to_pm": bool(raw_user.get("allows_write_to_pm")),
            "photo_url": raw_user.get("photo_url"),
            "raw_user": raw_user,
        }
        logger.warning("[Auth] Falling back to unsigned X-Telegram-User header because init_data is missing.")
    elif permissive_mode:
        fallback_telegram_id = os.getenv("DEV_TELEGRAM_USER_ID", "").strip()
        if not fallback_telegram_id:
            raise ValueError(
                "Telegram init data is missing in X-Telegram-Init-Data header. "
                "For development set DEV_TELEGRAM_USER_ID and TELEGRAM_AUTH_MODE=permissive, "
                "or pass X-Telegram-User header."
            )
        parsed_user = {
            "telegram_id": fallback_telegram_id,
            "username": os.getenv("DEV_TELEGRAM_USERNAME", "").strip() or f"dev_{fallback_telegram_id}",
            "first_name": os.getenv("DEV_TELEGRAM_FIRST_NAME", "").strip() or "Dev User",
            "last_name": "",
            "language_code": "",
            "is_premium": False,
            "allows_write_to_pm": False,
            "photo_url": "",
            "raw_user": {},
        }
        logger.warning(
            "[Auth] Telegram auth headers are missing; using DEV_TELEGRAM_USER_ID=%s in permissive mode.",
            fallback_telegram_id,
        )
    else:
        raise ValueError("Telegram init data is missing in X-Telegram-Init-Data header.")

    logger.info(
        "[Auth] Incoming Telegram auth payload | has_init_data=%s parsed_user_id=%s has_bot_token=%s verified=%s",
        bool(init_data),
        parsed_user.get("telegram_id"),
        bool(bot_token),
        is_verified,
    )

    raw_id = parsed_user.get("telegram_id")
    if not raw_id:
        raise ValueError("Telegram user id is missing in init data.")

    telegram_id = normalize_telegram_id(raw_id)
    logger.info("[Auth] Resolved telegram_id=%s source=init_data", telegram_id)
    username = (
        (parsed_user.get("username") or "").strip()
        or f"telegram_{telegram_id}"
    )
    first_name = (
        (parsed_user.get("first_name") or "").strip()
        or "Telegram User"
    )

    context = {
        "telegram_id": telegram_id,
        "username": username,
        "first_name": first_name,
        "last_name": (parsed_user.get("last_name") or "").strip(),
        "language_code": (parsed_user.get("language_code") or "").strip(),
        "is_premium": bool(parsed_user.get("is_premium")),
        "allows_write_to_pm": bool(parsed_user.get("allows_write_to_pm")),
        "photo_url": (parsed_user.get("photo_url") or "").strip(),
        "raw_init_data": init_data,
        "raw_user": parsed_user.get("raw_user") or {},
        "is_verified": is_verified,
    }
    logger.info(
        "[Auth] Final context telegram_id=%s username=%s first_name=%s verified=%s",
        context["telegram_id"],
        context["username"],
        context["first_name"],
        context["is_verified"],
    )
    return context


def get_or_create_user(context: dict[str, Any]) -> dict[str, Any]:
    with get_db_cursor(commit=True) as cursor:
        cursor.execute(
            '''
            INSERT INTO users (telegram_id, username, first_name, is_test_user)
            VALUES (%s, %s, %s, FALSE)
            ON CONFLICT (telegram_id)
            DO UPDATE SET
                username = COALESCE(NULLIF(EXCLUDED.username, ''), users.username),
                first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), users.first_name),
                is_test_user = FALSE,
                updated_at = NOW()
            RETURNING id, telegram_id, username, first_name, is_test_user
            ''',
            (
                context["telegram_id"],
                context["username"],
                context["first_name"],
            ),
        )
        user = dict(cursor.fetchone())

    user["photo_url"] = context.get("photo_url") or ""
    user["last_name"] = context.get("last_name") or ""
    user["language_code"] = context.get("language_code") or ""
    user["is_premium"] = bool(context.get("is_premium"))
    user["allows_write_to_pm"] = bool(context.get("allows_write_to_pm"))
    user["is_verified"] = bool(context.get("is_verified"))
    return user


def resolve_current_user(flask_request: Request) -> dict[str, Any]:
    return get_or_create_user(resolve_telegram_context(flask_request))
