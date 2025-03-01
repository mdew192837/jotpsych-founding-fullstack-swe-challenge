from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import random
import uuid
import threading
import json
from typing import Dict, Optional, Literal, List, Any
from functools import wraps
from datetime import datetime, timedelta
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Version tracking
VERSION = "1.0.0"

# Job queue to store transcription jobs
job_queue = {}

# In-memory caches
user_model_cache = {}  # Cache for user's preferred LLM model
llm_categorization_cache = {}  # Cache for LLM categorization results

# Job status enum
JOB_STATUS = {
    "PENDING": "pending",
    "PROCESSING": "processing",
    "COMPLETED": "completed",
    "FAILED": "failed"
}

# Middleware to check version compatibility and log user ID
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
                
            # Log user ID if present
            user_id = request.headers.get('X-User-ID')
            if user_id:
                logger.info(f"Request to {request.path} from user {user_id}")
            else:
                logger.info(f"Request to {request.path} from unknown user")
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def process_transcription(job_id: str, audio_data: bytes = None):
    """Mock function to simulate async transcription processing. Returns a random transcription."""
    try:
        print(f"Starting processing for job {job_id}")
        # Update job status to processing
        job_queue[job_id]["status"] = JOB_STATUS["PROCESSING"]
        job_queue[job_id]["progress"] = 10
        job_queue[job_id]["updated_at"] = datetime.now().isoformat()
        print(f"Job {job_id} status updated to: {job_queue[job_id]['status']}, progress: {job_queue[job_id]['progress']}%")
        
        # Simulate different processing stages - shorter times for testing
        processing_steps = 3
        for step in range(processing_steps):
            # Simulate work - shorter times for testing (1-2 seconds per step)
            time.sleep(random.randint(1, 2))
            # Update progress (from 10% to 90%)
            progress = 10 + int((step + 1) * (80 / processing_steps))
            job_queue[job_id]["progress"] = progress
            job_queue[job_id]["updated_at"] = datetime.now().isoformat()
            print(f"Job {job_id} progress updated to: {progress}%")
        
        # Generate random transcription
        transcription = random.choice([
            "I've always been fascinated by cars, especially classic muscle cars from the 60s and 70s. The raw power and beautiful design of those vehicles is just incredible.",
            "Bald eagles are such majestic creatures. I love watching them soar through the sky and dive down to catch fish. Their white heads against the blue sky is a sight I'll never forget.",
            "Deep sea diving opens up a whole new world of exploration. The mysterious creatures and stunning coral reefs you encounter at those depths are unlike anything else on Earth."
        ])
        
        # Add optional processing step for categorization
        print(f"Categorizing transcription for job {job_id}")
        categories = categorize_transcription(transcription)
        
        # Update job with completed status and result
        job_queue[job_id]["status"] = JOB_STATUS["COMPLETED"]
        job_queue[job_id]["progress"] = 100
        job_queue[job_id]["result"] = transcription
        job_queue[job_id]["categories"] = categories
        job_queue[job_id]["completed_at"] = datetime.now().isoformat()
        job_queue[job_id]["updated_at"] = datetime.now().isoformat()
        print(f"Job {job_id} completed with result: {transcription[:30]}...")
        print(f"Categories: {categories}")
        
        return transcription
    except Exception as e:
        # Handle errors by updating job status
        if job_id in job_queue:
            job_queue[job_id]["status"] = JOB_STATUS["FAILED"]
            job_queue[job_id]["error"] = str(e)
            job_queue[job_id]["updated_at"] = datetime.now().isoformat()
            print(f"Job {job_id} failed with error: {str(e)}")
        return None


def categorize_transcription(transcription_string: str, user_id: str = None):
    """Categorize transcription text using the user's preferred LLM model."""
    if not transcription_string:
        return {
            "categories": ["General"],
            "sentiment": "neutral",
            "confidence": 0.5
        }
        
    # Log user ID if provided
    if user_id:
        logger.info(f"Categorizing transcription for user {user_id}")
    
    # Generate a cache key based on the transcription content
    # Using first 100 chars of transcription for the cache key is usually sufficient
    # and keeps the cache keys to a reasonable size
    cache_key = transcription_string[:100].strip().lower()
    
    # Check if we have this result cached
    if cache_key in llm_categorization_cache and llm_categorization_cache[cache_key]['expires_at'] > datetime.now():
        logger.info("Cache hit for transcription categorization")
        return llm_categorization_cache[cache_key]['result']
    
    # Get the user's preferred model
    model_provider = "openai"  # Default model
    if user_id:
        try:
            model_provider = get_user_model_from_db(user_id)
        except Exception as e:
            logger.error(f"Error getting user model preference: {str(e)}")
    
    # Make LLM API call - we'll mock this for now
    logger.info(f"Using {model_provider} to categorize transcription")
    result = mock_llm_categorization(transcription_string, model_provider)
    
    # Cache the result for 24 hours
    llm_categorization_cache[cache_key] = {
        'result': result,
        'expires_at': datetime.now() + timedelta(hours=24)
    }
    
    return result


def mock_llm_categorization(text: str, provider: str) -> Dict[str, Any]:
    """Mock function to simulate LLM categorization with different providers."""
    # Simulate processing time (would be API call in production)
    time.sleep(1.5)
    
    # Different mock behaviors based on provider
    try:
        if provider == "openai":
            # Simulate OpenAI response style
            categories = []
            
            if any(word in text.lower() for word in ["car", "muscle", "power", "vehicle"]):
                categories.append("Automotive")
            
            if any(word in text.lower() for word in ["eagle", "bird", "sky", "soar", "creature"]):
                categories.append("Wildlife")
                
            if any(word in text.lower() for word in ["sea", "diving", "ocean", "coral", "depths"]):
                categories.append("Ocean/Marine")
            
            if not categories:
                categories.append("General")
                
            # Formatting how OpenAI might return JSON
            mock_response = json.dumps({
                "categories": categories,
                "sentiment": random.choice(["positive", "neutral", "negative"]),
                "confidence": round(random.uniform(0.7, 0.95), 2),
                "model": "gpt-4"
            })
            
            # Parse the response to validate it's proper JSON
            return json.loads(mock_response)
            
        elif provider == "anthropic":
            # Simulate Anthropic response style
            categories = []
            
            # Slightly different categorization logic to simulate model differences
            if any(word in text.lower() for word in ["car", "vehicle", "drive", "road"]):
                categories.append("Transportation")
                
            if any(word in text.lower() for word in ["animal", "bird", "creature", "wildlife", "eagle"]):
                categories.append("Animals & Wildlife")
                
            if any(word in text.lower() for word in ["ocean", "sea", "water", "marine", "dive"]):
                categories.append("Marine & Aquatic")
                
            if not categories:
                categories.append("Miscellaneous")
            
            # Formatting how Anthropic might return JSON
            mock_response = json.dumps({
                "classification": {
                    "categories": categories,
                    "mood": random.choice(["positive", "neutral", "negative"]),
                    "certainty": round(random.uniform(0.65, 0.9), 2)
                },
                "model": "claude-3-opus"
            })
            
            # Parse and standardize to our expected format
            parsed_response = json.loads(mock_response)
            return {
                "categories": parsed_response["classification"]["categories"],
                "sentiment": parsed_response["classification"]["mood"],
                "confidence": parsed_response["classification"]["certainty"],
                "model": parsed_response["model"]
            }
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response: {str(e)}")
        # Fallback to basic categorization
        return {
            "categories": ["General"],
            "sentiment": "neutral",
            "confidence": 0.5,
            "error": "Failed to parse LLM response"
        }
    except Exception as e:
        logger.error(f"Error in LLM categorization: {str(e)}")
        return {
            "categories": ["General"],
            "sentiment": "neutral",
            "confidence": 0.5,
            "error": str(e)
        }


def get_user_model_from_db(user_id: str) -> Literal["openai", "anthropic"]:
    """
    Mocks a slow and expensive function to simulate fetching a user's preferred LLM model from database
    Returns either 'openai' or 'anthropic' after a random delay.
    With caching to avoid repeated calls.
    """
    # Check if we have a valid cached result
    if user_id in user_model_cache and user_model_cache[user_id]['expires_at'] > datetime.now():
        logger.info(f"Cache hit for user model preference: {user_id}")
        return user_model_cache[user_id]['model']
    
    # Simulate slow database query
    logger.info(f"Cache miss for user model preference: {user_id}, fetching from DB...")
    time.sleep(random.randint(2, 8))
    model = random.choice(["openai", "anthropic"])
    
    # Cache the result for 24 hours
    user_model_cache[user_id] = {
        'model': model,
        'expires_at': datetime.now() + timedelta(hours=24)
    }
    
    return model


@app.route('/version', methods=['GET'])
def get_version():
    """Return the current API version"""
    # Log user ID if present
    user_id = request.headers.get('X-User-ID')
    if user_id:
        logger.info(f"Version request from user {user_id}")
    else:
        logger.info("Version request from unknown user")
        
    return jsonify({"version": VERSION})

@app.route('/cache/stats', methods=['GET'])
@check_version_compatibility()
def get_cache_stats():
    """Return statistics about the caching system"""
    # Count valid entries in user model cache
    user_cache_size = sum(1 for entry in user_model_cache.values() 
                         if entry['expires_at'] > datetime.now())
    
    # Count valid entries in categorization cache
    llm_cache_size = sum(1 for entry in llm_categorization_cache.values() 
                        if entry['expires_at'] > datetime.now())
    
    # Return cache statistics
    return jsonify({
        "user_model_cache_entries": user_cache_size,
        "llm_categorization_cache_entries": llm_cache_size,
        "version": VERSION
    })

@app.route('/user', methods=['GET'])
def generate_user_id():
    """Generate and return a unique user ID"""
    # Generate a unique user ID
    user_id = str(uuid.uuid4())
    logger.info(f"Generated new user ID: {user_id}")
    
    return jsonify({"user_id": user_id, "version": VERSION})

def start_transcription_job(job_id: str, audio_data=None):
    """Start a new transcription job in a separate thread"""
    thread = threading.Thread(
        target=process_transcription,
        args=(job_id, audio_data)
    )
    thread.daemon = True
    thread.start()

@app.route('/transcribe', methods=['POST'])
@check_version_compatibility()
def transcribe_audio():
    try:
        # Get user ID from headers
        user_id = request.headers.get('X-User-ID')
        
        # Generate a unique job ID
        job_id = str(uuid.uuid4())
        logger.info(f"Creating new transcription job with ID: {job_id} for user: {user_id or 'unknown'}")
        
        # Get the audio file from the request
        if 'audio' not in request.files:
            print("Error: No audio file in request")
            return jsonify({"error": "No audio file provided", "version": VERSION}), 400
            
        audio_file = request.files['audio']
        print(f"Received audio file: {audio_file.filename if audio_file.filename else 'unnamed'}")
        
        # Initialize job in queue
        job_queue[job_id] = {
            "id": job_id,
            "status": JOB_STATUS["PENDING"],
            "progress": 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "completed_at": None,
            "result": None,
            "error": None,
            "user_id": user_id
        }
        
        print(f"Job {job_id} initialized with status: {JOB_STATUS['PENDING']}")
        print(f"Current job queue has {len(job_queue)} jobs")
        
        # Read audio data
        audio_data = audio_file.read()
        print(f"Read {len(audio_data)} bytes of audio data")
        
        # Start processing in background
        start_transcription_job(job_id, audio_data)
        print(f"Started background processing for job {job_id}")
        
        # Return job ID immediately
        return jsonify({
            "job_id": job_id,
            "status": JOB_STATUS["PENDING"],
            "version": VERSION
        })
    except Exception as e:
        print(f"Error in transcribe_audio: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}", "version": VERSION}), 500

@app.route('/job/<job_id>', methods=['GET'])
@check_version_compatibility()
def get_job_status(job_id):
    """Get the status of a specific transcription job"""
    if job_id not in job_queue:
        return jsonify({
            "error": "Job not found",
            "version": VERSION
        }), 404
    
    job = job_queue[job_id]
    
    # Return job status and details
    return jsonify({
        **job,
        "version": VERSION
    })

@app.route('/jobs', methods=['GET'])
@check_version_compatibility()
def get_all_jobs():
    """Get status of all transcription jobs"""
    try:
        # Log the current job queue state
        print(f"Getting all jobs. Current job queue has {len(job_queue)} jobs")
        for job_id, job in job_queue.items():
            print(f"Job {job_id}: status={job['status']}, progress={job['progress']}")
        
        # Return list of all jobs (could be paginated in a real app)
        jobs_list = list(job_queue.values())
        print(f"Returning {len(jobs_list)} jobs to client")
        
        return jsonify({
            "jobs": jobs_list,
            "version": VERSION
        })
    except Exception as e:
        print(f"Error in get_all_jobs: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}", "version": VERSION}), 500


if __name__ == '__main__':
    print(f"Starting server with version: {VERSION}")
    print("Registered routes:")
    for rule in app.url_map.iter_rules():
        print(f"  {rule.endpoint}: {rule}")
    app.run(host='0.0.0.0', port=8000, debug=True)
