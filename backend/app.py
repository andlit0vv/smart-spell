from flask import Flask, jsonify, request

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
    # Read JSON safely, even if client sends invalid/missing body.
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()

    if not word:
        return jsonify({'error': 'word is required'}), 400

    # Print to terminal to visibly confirm Frontend → Backend connection.
    print(f"[Translation] Received word: {word}", flush=True)

    return jsonify({
        'received': True,
        'word': word,
        'message': f'Word "{word}" was received by backend',
    })


@app.post('/api/profile')
def profile_input():
    # Accept both fields from frontend profile form.
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    bio = (data.get('bio') or '').strip()

    # Persist values in temporary memory so GET /api/profile can return last saved values.
    CURRENT_PROFILE['name'] = name
    CURRENT_PROFILE['bio'] = bio

    # Print values to IDE terminal so you can see each profile save request.
    print(f"[Profile] Name: {name}", flush=True)
    print(f"[Profile] Bio: {bio}", flush=True)

    return jsonify({
        'saved': True,
        'profile': CURRENT_PROFILE,
        'message': 'Profile data was received by backend',
    })


@app.get('/api/profile')
def get_profile():
    # Return the last profile values stored in backend memory.
    return jsonify({'profile': CURRENT_PROFILE})


if __name__ == '__main__':
    # Expose backend on local network and keep debug mode for development.
    app.run(host='0.0.0.0', port=5000, debug=True)
