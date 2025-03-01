from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import random
from typing import Dict, Optional, Literal
from functools import wraps

app = Flask(__name__)
CORS(app)

# Version tracking
VERSION = "1.0.0"

# Middleware to check version compatibility
def check_version_compatibility():
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get frontend version from headers
            frontend_version = request.headers.get('X-Frontend-Version')
            if not frontend_version:
                return jsonify({
                    "error": "Version mismatch",
                    "message": "Frontend version header is missing. API requests must include X-Frontend-Version header.",
                    "backend_version": VERSION,
                    "frontend_version": None
                }), 409  # Conflict status code
            elif frontend_version != VERSION:
                return jsonify({
                    "error": "Version mismatch",
                    "message": f"Your application (v{frontend_version}) is out of date with the server (v{VERSION}). Please refresh your browser.",
                    "backend_version": VERSION,
                    "frontend_version": frontend_version
                }), 409  # Conflict status code
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def process_transcription(job_id: str, audio_data: bytes):
    """Mock function to simulate async transcription processing. Returns a random transcription."""
    time.sleep(random.randint(5, 20))
    return random.choice([
        "I've always been fascinated by cars, especially classic muscle cars from the 60s and 70s. The raw power and beautiful design of those vehicles is just incredible.",
        "Bald eagles are such majestic creatures. I love watching them soar through the sky and dive down to catch fish. Their white heads against the blue sky is a sight I'll never forget.",
        "Deep sea diving opens up a whole new world of exploration. The mysterious creatures and stunning coral reefs you encounter at those depths are unlike anything else on Earth."
    ])


def categorize_transcription(transcription_string: str, user_id: str):
    # TODO: Implement transcription categorization
    model_to_use = get_user_model_from_db(user_id)
    if model_to_use == "openai":
        # TODO: Implement OpenAI categorization
        pass
    elif model_to_use == "anthropic":
        # TODO: Implement Anthropic categorization
        pass


def get_user_model_from_db(user_id: str) -> Literal["openai", "anthropic"]:
    """
    Mocks a slow and expensive function to simulate fetching a user's preferred LLM model from database
    Returns either 'openai' or 'anthropic' after a random delay.
    """
    time.sleep(random.randint(2, 8))
    return random.choice(["openai", "anthropic"])


@app.route('/version', methods=['GET'])
def get_version():
    """Return the current API version"""
    return jsonify({"version": VERSION})

@app.route('/transcribe', methods=['POST'])
@check_version_compatibility()
def transcribe_audio():
    result = process_transcription("xyz", "abcde")

    # TODO: Implement categorization
    # result = categorize_transcription(result, "user_id")

    return jsonify({
        "transcription": result,
        "version": VERSION
        # TODO: Add category
    })


if __name__ == '__main__':
    print(f"Starting server with version: {VERSION}")
    print("Registered routes:")
    for rule in app.url_map.iter_rules():
        print(f"  {rule.endpoint}: {rule}")
    app.run(host='0.0.0.0', port=8000, debug=True)
