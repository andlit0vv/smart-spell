import json
import os
import re
from typing import Any
from urllib.parse import parse_qs, urlencode

from flask import Flask, jsonify, request
import psycopg2

from db import get_db_cursor
from dialog import register_dialog_endpoints
from llm import LLMError, analyze_term
from reading import register_reading_endpoints

app = Flask(__name__)
register_dialog_endpoints(app)
register_reading_endpoints(app)


def normalize_word(value: str) -> str:
    return re.sub(r'\s+', ' ', (value or '').strip().lower())


def _parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    return False


def _parse_telegram_init_data(raw_init_data: str) -> dict[str, Any]:
    params = parse_qs(raw_init_data, keep_blank_values=True)
    user_payload = params.get('user', [''])[0]
    if not user_payload:
        return {}

    try:
        user = json.loads(user_payload)
    except json.JSONDecodeError:
        return {}

    return {
        'telegram_id': user.get('id'),
        'username': user.get('username'),
        'first_name': user.get('first_name'),
    }


def _normalize_telegram_id(raw_value: Any) -> int:
    try:
        telegram_id = int(str(raw_value).strip())
    except (TypeError, ValueError) as error:
        raise ValueError('Telegram user id must be a positive integer.') from error

    if telegram_id <= 0:
        raise ValueError('Telegram user id must be positive.')

    return telegram_id


def resolve_telegram_context() -> dict[str, Any]:
    init_data = request.headers.get('X-Telegram-Init-Data', '').strip()
    parsed_init_data = _parse_telegram_init_data(init_data) if init_data else {}

    header_id = request.headers.get('X-Telegram-Id', '').strip()
    query_id = (request.args.get('telegram_id') or '').strip()
    env_id = os.getenv('LOCAL_TEST_TELEGRAM_ID', '').strip()

    raw_id = header_id or query_id or parsed_init_data.get('telegram_id') or env_id
    if not raw_id:
        raise ValueError(
            'Telegram user id is missing. Provide X-Telegram-Init-Data/X-Telegram-Id '
            'or set LOCAL_TEST_TELEGRAM_ID.'
        )

    telegram_id = _normalize_telegram_id(raw_id)

    username = (
        request.headers.get('X-Telegram-Username', '').strip()
        or (parsed_init_data.get('username') or '').strip()
        or os.getenv('LOCAL_TEST_USERNAME', '').strip()
        or f'local_{telegram_id}'
    )
    first_name = (
        request.headers.get('X-Telegram-First-Name', '').strip()
        or (parsed_init_data.get('first_name') or '').strip()
        or os.getenv('LOCAL_TEST_FIRST_NAME', '').strip()
        or 'Local Tester'
    )

    return {
        'telegram_id': telegram_id,
        'username': username,
        'first_name': first_name,
        'is_test_user': not bool(init_data),
    }


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
                context['telegram_id'],
                context['username'],
                context['first_name'],
                context['is_test_user'],
            ),
        )
        return dict(cursor.fetchone())


def resolve_current_user() -> dict[str, Any]:
    return get_or_create_user(resolve_telegram_context())


def fetch_user_profile(user_id: int) -> dict[str, str]:
    with get_db_cursor() as cursor:
        cursor.execute(
            '''
            SELECT display_name, bio, english_level
            FROM user_profiles
            WHERE user_id = %s
            ''',
            (user_id,),
        )
        row = cursor.fetchone()

    if not row:
        return {'name': '', 'bio': '', 'englishLevel': ''}

    return {
        'name': row.get('display_name') or '',
        'bio': row.get('bio') or '',
        'englishLevel': row.get('english_level') or '',
    }


def _json_bad_request(error: Exception):
    return jsonify({'error': str(error)}), 400


def _json_db_unavailable(error: Exception):
    message = str(error)
    dns_hint = 'could not translate host name' in message

    details = {
        'error': 'Database is temporarily unavailable.',
        'details': message,
    }
    if dns_hint:
        details['hint'] = (
            'Direct Supabase host DNS is not resolvable from current environment. '
            'Set DATABASE_POOLER_URL in backend/.env and retry.'
        )

    return jsonify(details), 503


@app.errorhandler(psycopg2.OperationalError)
def handle_db_operational_error(error: psycopg2.OperationalError):
    return _json_db_unavailable(error)


@app.get('/api/profile')
def get_profile():
    try:
        user = resolve_current_user()
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    return jsonify({'profile': fetch_user_profile(user['id']), 'user': user})


@app.post('/api/profile')
def save_profile():
    data = request.get_json(silent=True) or {}

    try:
        user = resolve_current_user()
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    incoming_name = (data.get('name') or '').strip()
    incoming_bio = (data.get('bio') or '').strip()
    incoming_level = (data.get('englishLevel') or '').strip()
    force_update_level = bool(data.get('forceUpdateEnglishLevel', False))

    current_profile = fetch_user_profile(user['id'])
    if current_profile['englishLevel'] and incoming_level and not force_update_level:
        return jsonify({
            'error': 'englishLevel is already set. Use forceUpdateEnglishLevel to change it.',
            'profile': current_profile,
        }), 409

    next_name = incoming_name if 'name' in data else current_profile['name']
    next_bio = incoming_bio if 'bio' in data else current_profile['bio']
    next_level = incoming_level if 'englishLevel' in data else current_profile['englishLevel']

    with get_db_cursor(commit=True) as cursor:
        cursor.execute(
            '''
            INSERT INTO user_profiles (user_id, display_name, bio, english_level)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id)
            DO UPDATE SET
                display_name = EXCLUDED.display_name,
                bio = EXCLUDED.bio,
                english_level = EXCLUDED.english_level,
                updated_at = NOW()
            ''',
            (user['id'], next_name, next_bio, next_level),
        )

    return jsonify({'message': 'Profile saved', 'profile': fetch_user_profile(user['id'])})


@app.get('/api/dictionary')
def get_dictionary():
    try:
        user = resolve_current_user()
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    with get_db_cursor() as cursor:
        cursor.execute(
            '''
            SELECT word, definition, relevance, created_at
            FROM dictionary_words
            WHERE user_id = %s
            ORDER BY created_at DESC
            ''',
            (user['id'],),
        )
        rows = cursor.fetchall()

    words = [
        {
            'word': row['word'],
            'definition': row['definition'],
            'relevance': int(row['relevance'] or 0),
            'domain': '',
            'createdAt': row['created_at'].isoformat() if row['created_at'] else None,
        }
        for row in rows
    ]
    return jsonify({'words': words})


@app.post('/api/dictionary')
def add_dictionary_word():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()
    definition = (data.get('definition') or '').strip()
    if not word or not definition:
        return jsonify({'error': 'word and definition are required'}), 400

    try:
        user = resolve_current_user()
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    relevance = data.get('relevance') if isinstance(data.get('relevance'), int) else 0
    relevance = max(0, min(relevance, 10))

    with get_db_cursor(commit=True) as cursor:
        cursor.execute(
            '''
            INSERT INTO dictionary_words (user_id, word, normalized_word, definition, relevance)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (user_id, normalized_word)
            DO UPDATE SET
                word = EXCLUDED.word,
                definition = EXCLUDED.definition,
                relevance = EXCLUDED.relevance,
                updated_at = NOW()
            RETURNING word, definition, relevance, created_at
            ''',
            (user['id'], word, normalize_word(word), definition, relevance),
        )
        saved = cursor.fetchone()

    return jsonify({
        'message': 'Word added',
        'word': {
            'word': saved['word'],
            'definition': saved['definition'],
            'relevance': int(saved['relevance'] or 0),
            'domain': '',
            'createdAt': saved['created_at'].isoformat() if saved['created_at'] else None,
        },
    })


@app.delete('/api/dictionary')
def delete_dictionary_word():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()
    if not word:
        return jsonify({'error': 'word is required'}), 400

    try:
        user = resolve_current_user()
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    with get_db_cursor(commit=True) as cursor:
        cursor.execute(
            '''
            DELETE FROM dictionary_words
            WHERE user_id = %s AND normalized_word = %s
            RETURNING id
            ''',
            (user['id'], normalize_word(word)),
        )
        deleted = cursor.fetchone()

    if not deleted:
        return jsonify({'error': 'Word not found'}), 404
    return jsonify({'message': 'Word deleted'})


@app.post('/api/test-user/starter-pack')
def create_test_user_starter_pack():
    data = request.get_json(silent=True) or {}

    telegram_id = _normalize_telegram_id(data.get('telegramId') or os.getenv('LOCAL_TEST_TELEGRAM_ID') or 1000000001)
    username = (data.get('username') or os.getenv('LOCAL_TEST_USERNAME') or f'local_{telegram_id}').strip()
    first_name = (data.get('firstName') or os.getenv('LOCAL_TEST_FIRST_NAME') or 'Local').strip()

    with get_db_cursor(commit=True) as cursor:
        cursor.execute(
            '''
            INSERT INTO local_test_user_pool (telegram_id, username, first_name, is_reserved)
            VALUES (%s, %s, %s, FALSE)
            ON CONFLICT (telegram_id)
            DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name
            ''',
            (telegram_id, username, first_name),
        )

    user = get_or_create_user({
        'telegram_id': telegram_id,
        'username': username,
        'first_name': first_name,
        'is_test_user': True,
    })

    init_data = urlencode({
        'query_id': f'local-{telegram_id}',
        'user': json.dumps({'id': telegram_id, 'username': username, 'first_name': first_name}, separators=(',', ':')),
        'auth_date': '1735689600',
        'hash': 'local-dev-no-signature',
    })

    return jsonify({
        'message': 'Local Telegram starter pack is ready',
        'user': user,
        'initData': init_data,
        'headersExample': {
            'X-Telegram-Init-Data': init_data,
            'X-Telegram-Id': str(telegram_id),
        },
    })


@app.get('/health')
def health_check():
    return jsonify({'status': 'ok'})


@app.post('/api/translation')
def translation_input():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()
    if not word:
        return jsonify({'error': 'word is required'}), 400

    try:
        user = resolve_current_user()
        profile = fetch_user_profile(user['id'])
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    try:
        analysis = analyze_term(word, user_bio=profile.get('bio', ''), user_level=profile.get('englishLevel', ''))
    except LLMError as error:
        return jsonify({'error': str(error)}), 502

    return jsonify({'received': True, 'word': word, 'analysis': analysis.to_dict()})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
