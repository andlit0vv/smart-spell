from flask import Flask, jsonify, request

from llm import LLMError, analyze_term

app = Flask(__name__)

# Temporary in-memory storage for a single local user profile.
# NOTE: This survives only while Flask process is running.
CURRENT_PROFILE = {
    'name': '',
    'bio': '',
}

CURRENT_DICTIONARY = [
    {
        'word': 'Negotiate',
        'domain': 'General',
        'relevance': 7,
        'definition': 'To discuss something in order to reach an agreement.',
    },
    {
        'word': 'Asynchronous',
        'domain': 'IT',
        'relevance': 9,
        'definition': 'A communication method where operations occur independently, without waiting for others to finish.',
    },
    {
        'word': 'Containerization',
        'domain': 'IT',
        'relevance': 8,
        'definition': 'Packaging software with its dependencies into isolated, portable containers for deployment.',
    },
    {
        'word': 'Protocol',
        'domain': 'General/IT',
        'relevance': 7,
        'definition': 'A formal set of rules governing data transmission between systems or networks.',
    },
    {
        'word': 'Myocardial',
        'domain': 'Medicine',
        'relevance': 6,
        'definition': 'Relating to the muscular tissue of the heart, the myocardium.',
    },
    {
        'word': 'Deployment',
        'domain': 'IT',
        'relevance': 8,
        'definition': 'The process of releasing software to a production environment for end users.',
    },
]


@app.get('/api/profile')
def get_profile():
    # Return current in-memory profile values (reset on backend restart).
    return jsonify({'profile': CURRENT_PROFILE})


@app.post('/api/profile')
def save_profile():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    bio = (data.get('bio') or '').strip()

    CURRENT_PROFILE['name'] = name
    CURRENT_PROFILE['bio'] = bio

    print(f"[Profile] Saved profile: name='{name}', bio='{bio}'", flush=True)

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
        'domain': 'New Word',
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
        analysis = analyze_term(word, user_bio=CURRENT_PROFILE.get('bio', ''))
    except LLMError as error:
        return jsonify({'error': str(error)}), 502

    return jsonify({
        'received': True,
        'word': word,
        'analysis': analysis.to_dict(),
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
