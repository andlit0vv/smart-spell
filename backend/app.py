from flask import Flask, jsonify, request

from llm import LLMError, analyze_term
from translation import TranslationError, translate_word_to_russian
from dialog import register_dialog_endpoints
from reading import register_reading_endpoints

app = Flask(__name__)
register_dialog_endpoints(app)
register_reading_endpoints(app)

# Temporary in-memory storage for a single local user profile.
# NOTE: This survives only while Flask process is running.
CURRENT_PROFILE = {
    'name': '',
    'bio': '',
    'englishLevel': '',
}

CURRENT_DICTIONARY = []


@app.get('/api/profile')
def get_profile():
    # Return current in-memory profile values (reset on backend restart).
    return jsonify({'profile': CURRENT_PROFILE})


@app.post('/api/profile')
def save_profile():
    data = request.get_json(silent=True) or {}
    if 'name' in data:
        CURRENT_PROFILE['name'] = (data.get('name') or '').strip()
    if 'bio' in data:
        CURRENT_PROFILE['bio'] = (data.get('bio') or '').strip()
    if 'englishLevel' in data:
        CURRENT_PROFILE['englishLevel'] = (data.get('englishLevel') or '').strip()

    print(
        "[Profile] Saved profile: "
        f"name='{CURRENT_PROFILE['name']}', "
        f"bio='{CURRENT_PROFILE['bio']}', "
        f"englishLevel='{CURRENT_PROFILE['englishLevel']}'",
        flush=True,
    )

    return jsonify({
        'message': 'Profile saved',
        'profile': CURRENT_PROFILE,
    })


@app.get('/api/dictionary')
def get_dictionary():
    return jsonify({'words': CURRENT_DICTIONARY})


@app.post('/api/dictionary')
def add_dictionary_word():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()
    definition = (data.get('definition') or '').strip()

    if not word or not definition:
        return jsonify({'error': 'word and definition are required'}), 400

    saved_word = {
        'word': word,
        'domain': (data.get('domain') or '').strip(),
        'relevance': data.get('relevance') if isinstance(data.get('relevance'), int) else 0,
        'definition': definition,
    }

    for index, existing in enumerate(CURRENT_DICTIONARY):
        if existing['word'].lower() == word.lower():
            CURRENT_DICTIONARY[index] = saved_word
            break
    else:
        CURRENT_DICTIONARY.insert(0, saved_word)

    print(f"[Dictionary] Saved word: {word}", flush=True)

    return jsonify({
        'message': 'Word added',
        'word': saved_word,
        'words': CURRENT_DICTIONARY,
    })


@app.delete('/api/dictionary')
def delete_dictionary_word():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()

    if not word:
        return jsonify({'error': 'word is required'}), 400

    initial_count = len(CURRENT_DICTIONARY)
    CURRENT_DICTIONARY[:] = [
        item for item in CURRENT_DICTIONARY if item['word'].lower() != word.lower()
    ]

    if len(CURRENT_DICTIONARY) == initial_count:
        return jsonify({'error': 'Word not found'}), 404

    print(f"[Dictionary] Deleted word: {word}", flush=True)

    return jsonify({
        'message': 'Word deleted',
        'words': CURRENT_DICTIONARY,
    })


@app.get('/health')
def health_check():
    # Basic endpoint to quickly verify that backend is alive.
    return jsonify({'status': 'ok'})


@app.post('/api/translation')
def translation_input():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()

    if not word:
        return jsonify({'error': 'word is required'}), 400

    print(f"[Translation] Received word: {word}", flush=True)

    try:
        analysis = analyze_term(
            word,
            user_bio=CURRENT_PROFILE.get('bio', ''),
            user_level=CURRENT_PROFILE.get('englishLevel', ''),
        )
    except LLMError as error:
        return jsonify({'error': str(error)}), 502

    translated_word = ''
    try:
        translated_word = translate_word_to_russian(word)
    except TranslationError as error:
        print(f"[Translation] Russian translation failed for '{word}': {error}", flush=True)

    return jsonify({
        'received': True,
        'word': word,
        'analysis': analysis.to_dict(),
        'translationRu': translated_word,
    })


@app.post('/api/translate')
def translate_only():
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()

    if not text:
        return jsonify({'error': 'text is required'}), 400

    try:
        translation_ru = translate_word_to_russian(text)
    except TranslationError as error:
        return jsonify({'error': str(error)}), 502

    return jsonify({
        'text': text,
        'translationRu': translation_ru,
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
