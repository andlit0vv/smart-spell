from flask import Flask, request, jsonify

app = Flask(__name__)


@app.get('/health')
def health_check():
    return jsonify({'status': 'ok'})


@app.post('/api/translation')
def translation_input():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()

    if not word:
        return jsonify({'error': 'word is required'}), 400

    print(f"[Translation] Received word: {word}", flush=True)

    return jsonify({
        'received': True,
        'word': word,
        'message': f'Word "{word}" was received by backend'
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
