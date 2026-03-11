from flask import Flask, jsonify, request

from llm import LLMError, analyze_term

app = Flask(__name__)

# Temporary in-memory storage for a single local user profile.
# NOTE: This survives only while Flask process is running.
CURRENT_PROFILE = {
    'name': '',
    'bio': '',
}


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
        analysis = analyze_term(word)
    except LLMError as error:
        return jsonify({'error': str(error)}), 502

    return jsonify({
        'received': True,
        'word': word,
        'analysis': analysis.to_dict(),
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
