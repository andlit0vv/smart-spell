
import logging
import os
from typing import Any

from flask import Flask, jsonify, request
import psycopg2

from db import get_db_cursor
from dialog import register_dialog_endpoints
from llm import LLMError, analyze_term
from reading import register_reading_endpoints
from auth import resolve_current_user

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

app = Flask(__name__)
logger = logging.getLogger(__name__)
register_dialog_endpoints(app)
register_reading_endpoints(app)


def _parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    return False


def _parse_topics(raw_topics: Any) -> list[str]:
    if raw_topics is None:
        return []

    if isinstance(raw_topics, str):
        candidates = [item.strip() for item in raw_topics.split(',')]
    elif isinstance(raw_topics, list):
        candidates = [str(item).strip() for item in raw_topics]
    else:
        raise ValueError('topics must be an array of strings or comma-separated string')

    seen: set[str] = set()
    topics: list[str] = []
    for candidate in candidates:
        if not candidate:
            continue
        lowered = candidate.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        topics.append(candidate)

    return topics



def _fetch_word_topics_map(user_id: int, word_ids: list[int] | None = None) -> dict[int, list[str]]:
    query = '''
        SELECT dwt.word_id, t.name AS topic
        FROM dictionary_word_topics dwt
        JOIN dictionary_words dw ON dw.id = dwt.word_id
        JOIN dictionary_topics t ON t.id = dwt.topic_id
        WHERE dw.user_id = %s
    '''
    params: list[Any] = [user_id]

    if word_ids:
        query += ' AND dwt.word_id = ANY(%s::int[])'
        params.append(word_ids)

    query += ' ORDER BY t.name ASC'

    with get_db_cursor() as cursor:
        cursor.execute(query, tuple(params))
        topic_rows = cursor.fetchall()

    topics_by_word: dict[int, list[str]] = {}
    for row in topic_rows:
        topics_by_word.setdefault(row['word_id'], []).append(row['topic'])

    return topics_by_word


def _replace_word_topics(cursor: Any, user_id: int, word_id: int, topics: list[str]) -> list[str]:
    cursor.execute(
        '''
        DELETE FROM dictionary_word_topics
        WHERE word_id = %s
        ''',
        (word_id,),
    )

    if topics:
        cursor.execute(
            '''
            INSERT INTO dictionary_topics (user_id, name)
            SELECT %s, topic_name
            FROM unnest(%s::text[]) AS topic_name
            ON CONFLICT (user_id, name)
            DO UPDATE SET name = EXCLUDED.name
            ''',
            (user_id, topics),
        )

        cursor.execute(
            '''
            INSERT INTO dictionary_word_topics (word_id, topic_id)
            SELECT %s, dt.id
            FROM dictionary_topics dt
            WHERE dt.user_id = %s AND dt.name = ANY(%s::text[])
            ON CONFLICT (word_id, topic_id) DO NOTHING
            ''',
            (word_id, user_id, topics),
        )

    cursor.execute(
        '''
        SELECT t.name AS topic
        FROM dictionary_word_topics dwt
        JOIN dictionary_topics t ON t.id = dwt.topic_id
        WHERE dwt.word_id = %s
        ORDER BY t.name ASC
        ''',
        (word_id,),
    )
    rows = cursor.fetchall()
    return [row['topic'] for row in rows]


def fetch_user_profile(user_id: int, fallback_name: str = "", avatar_url: str = "") -> dict[str, str]:
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
        return {'name': fallback_name or '', 'bio': '', 'englishLevel': '', 'avatarUrl': avatar_url or ''}

    resolved_name = row.get('display_name') or fallback_name or ''
    return {
        'name': resolved_name,
        'bio': row.get('bio') or '',
        'englishLevel': row.get('english_level') or '',
        'avatarUrl': avatar_url or '',
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
            'Set user/password/host/port/dbname (or DATABASE_URL) in backend/.env and retry.'
        )

    return jsonify(details), 503


@app.errorhandler(psycopg2.OperationalError)
def handle_db_operational_error(error: psycopg2.OperationalError):
    return _json_db_unavailable(error)


@app.get('/api/profile')
def get_profile():
    try:
        user = resolve_current_user(request)
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    logger.info('[Auth] /api/profile resolved user_id=%s telegram_id=%s verified=%s', user.get('id'), user.get('telegram_id'), user.get('is_verified'))
    return jsonify({'profile': fetch_user_profile(user['id'], fallback_name=user.get('first_name', ''), avatar_url=user.get('photo_url', '')), 'user': user})


@app.post('/api/profile')
def save_profile():
    data = request.get_json(silent=True) or {}

    try:
        user = resolve_current_user(request)
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    incoming_name = (data.get('name') or '').strip()
    incoming_bio = (data.get('bio') or '').strip()
    incoming_level = (data.get('englishLevel') or '').strip()
    force_update_level = bool(data.get('forceUpdateEnglishLevel', False))

    current_profile = fetch_user_profile(user['id'], fallback_name=user.get('first_name', ''), avatar_url=user.get('photo_url', ''))
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

    return jsonify({'message': 'Profile saved', 'profile': fetch_user_profile(user['id'], fallback_name=user.get('first_name', ''), avatar_url=user.get('photo_url', ''))})


@app.get('/api/dictionary')
def get_dictionary():
    try:
        user = resolve_current_user(request)
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    try:
        topic_filters = _parse_topics(request.args.getlist('topic') or request.args.get('topic'))
    except ValueError as error:
        return _json_bad_request(error)

    params: list[Any] = [user['id']]
    query = '''
        SELECT DISTINCT dw.id, dw.word, dw.definition, dw.relevance
        FROM dictionary_words dw
    '''

    if topic_filters:
        query += '''
            JOIN dictionary_word_topics dwt ON dwt.word_id = dw.id
            JOIN dictionary_topics dt ON dt.id = dwt.topic_id
        '''

    query += ' WHERE dw.user_id = %s'

    if topic_filters:
        query += ' AND dt.name = ANY(%s::text[])'
        params.append(topic_filters)

    query += ' ORDER BY dw.id DESC'

    with get_db_cursor() as cursor:
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

    topics_by_word = _fetch_word_topics_map(user['id'], [row['id'] for row in rows])

    words = [
        {
            'word': row['word'],
            'definition': row['definition'],
            'relevance': int(row['relevance'] or 0),
            'domain': '/'.join(topics_by_word.get(row['id'], [])),
            'topics': topics_by_word.get(row['id'], []),
            'createdAt': None,
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
        user = resolve_current_user(request)
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    relevance = data.get('relevance') if isinstance(data.get('relevance'), int) else 0
    relevance = max(0, min(relevance, 10))
    try:
        topics = _parse_topics(data.get('topics'))
    except ValueError as error:
        return _json_bad_request(error)

    with get_db_cursor(commit=True) as cursor:
        cursor.execute(
            '''
            INSERT INTO dictionary_words (user_id, word, definition, relevance)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, word)
            DO UPDATE SET
                definition = EXCLUDED.definition,
                relevance = EXCLUDED.relevance,
                updated_at = NOW()
            RETURNING id, word, definition, relevance
            ''',
            (user['id'], word, definition, relevance),
        )
        saved = cursor.fetchone()
        saved_topics = _replace_word_topics(cursor, user['id'], saved['id'], topics)

    return jsonify({
        'message': 'Word added',
        'word': {
            'word': saved['word'],
            'definition': saved['definition'],
            'relevance': int(saved['relevance'] or 0),
            'domain': '/'.join(saved_topics),
            'topics': saved_topics,
            'createdAt': None,
        },
    })




def _delete_words_from_dictionary(user_id: int, words: list[str]) -> dict[str, Any]:
    cleaned_words: list[str] = []
    seen: set[str] = set()

    for raw_word in words:
        word = (raw_word or '').strip()
        if not word or word in seen:
            continue
        seen.add(word)
        cleaned_words.append(word)

    if not cleaned_words:
        return {'deletedCount': 0, 'deletedWords': []}

    with get_db_cursor(commit=True) as cursor:
        cursor.execute(
            '''
            DELETE FROM dictionary_words
            WHERE user_id = %s AND word = ANY(%s::text[])
            RETURNING word
            ''',
            (user_id, cleaned_words),
        )
        deleted_rows = cursor.fetchall()

    deleted_words = [row['word'] for row in deleted_rows]
    return {'deletedCount': len(deleted_words), 'deletedWords': deleted_words}


@app.delete('/api/dictionary')
def delete_dictionary_word():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()
    context_sentence = str(data.get('context_sentence') or '').strip()
    if not word:
        return jsonify({'error': 'word is required'}), 400

    try:
        user = resolve_current_user(request)
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    result = _delete_words_from_dictionary(user['id'], [word])
    if result['deletedCount'] == 0:
        return jsonify({'error': 'Word not found'}), 404

    return jsonify({'message': 'Word deleted', 'deletedWords': result['deletedWords'], 'deletedCount': result['deletedCount']})


@app.post('/api/dictionary/learned')
def mark_dictionary_words_learned():
    data = request.get_json(silent=True) or {}
    raw_words = data.get('words')
    if not isinstance(raw_words, list):
        return jsonify({'error': 'words must be an array'}), 400

    try:
        user = resolve_current_user(request)
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    words = [str(item) for item in raw_words]
    result = _delete_words_from_dictionary(user['id'], words)

    return jsonify({
        'message': 'Words marked as learned',
        'deletedWords': result['deletedWords'],
        'deletedCount': result['deletedCount'],
    })


@app.patch('/api/dictionary/topics')
def update_dictionary_word_topics():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()
    context_sentence = str(data.get('context_sentence') or '').strip()
    if not word:
        return jsonify({'error': 'word is required'}), 400

    try:
        topics = _parse_topics(data.get('topics'))
        user = resolve_current_user(request)
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    with get_db_cursor() as cursor:
        cursor.execute(
            '''
            SELECT id
            FROM dictionary_words
            WHERE user_id = %s AND word = %s
            ''',
            (user['id'], word),
        )
        existing = cursor.fetchone()

    if not existing:
        return jsonify({'error': 'Word not found'}), 404

    with get_db_cursor(commit=True) as cursor:
        saved_topics = _replace_word_topics(cursor, user['id'], existing['id'], topics)
    return jsonify({'message': 'Topics updated', 'word': word, 'topics': saved_topics})



@app.post('/api/topics')
def create_topic():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400

    try:
        user = resolve_current_user(request)
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    with get_db_cursor(commit=True) as cursor:
        cursor.execute(
            '''
            INSERT INTO dictionary_topics (user_id, name)
            VALUES (%s, %s)
            ON CONFLICT (user_id, name)
            DO UPDATE SET name = EXCLUDED.name
            RETURNING id, name
            ''',
            (user['id'], name),
        )
        row = cursor.fetchone()

    return jsonify({'message': 'Topic saved', 'topic': {'id': row['id'], 'name': row['name']}})




@app.delete('/api/topics')
def delete_topics():
    data = request.get_json(silent=True) or {}

    try:
        user = resolve_current_user(request)
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    try:
        topics = _parse_topics(data.get('topics'))
    except ValueError as error:
        return _json_bad_request(error)

    if not topics:
        return jsonify({'error': 'topics must contain at least one item'}), 400

    with get_db_cursor(commit=True) as cursor:
        cursor.execute(
            '''
            DELETE FROM dictionary_topics
            WHERE user_id = %s AND name = ANY(%s::text[])
            RETURNING id
            ''',
            (user['id'], topics),
        )
        deleted_count = len(cursor.fetchall())

    return jsonify({'message': 'Topics deleted', 'deletedCount': deleted_count, 'topics': topics})

@app.get('/api/topics')
def get_topics():
    try:
        user = resolve_current_user(request)
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    with get_db_cursor() as cursor:
        cursor.execute(
            '''
            SELECT t.name, COUNT(dwt.word_id)::int AS words_count
            FROM dictionary_topics t
            LEFT JOIN dictionary_word_topics dwt ON dwt.topic_id = t.id
            WHERE t.user_id = %s
            GROUP BY t.id
            ORDER BY t.name ASC
            ''',
            (user['id'],),
        )
        rows = cursor.fetchall()

    return jsonify({'topics': [{'name': row['name'], 'wordsCount': row['words_count']} for row in rows]})


@app.get('/health')
def health_check():
    return jsonify({'status': 'ok'})


@app.post('/api/translation')
def translation_input():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()
    context_sentence = str(data.get('context_sentence') or '').strip()
    if not word:
        return jsonify({'error': 'word is required'}), 400

    try:
        user = resolve_current_user(request)
        profile = fetch_user_profile(user['id'])
    except (RuntimeError, ValueError) as error:
        return _json_bad_request(error)

    try:
        analysis = analyze_term(word, user_bio=profile.get('bio', ''), user_level=profile.get('englishLevel', ''), context_sentence=context_sentence)
    except LLMError as error:
        return jsonify({'error': str(error)}), 502

    return jsonify({'received': True, 'word': word, 'analysis': analysis.to_dict()})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
