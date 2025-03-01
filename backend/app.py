from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import random
import uuid
import threading
from typing import Dict, Optional, Literal, List
from functools import wraps
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Version tracking
VERSION = "1.0.0"

# Job queue to store transcription jobs
job_queue = {}

# Job status enum
JOB_STATUS = {
    "PENDING": "pending",
    "PROCESSING": "processing",
    "COMPLETED": "completed",
    "FAILED": "failed"
}

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
    """Mock function to categorize transcription text."""
    # Simulate processing time
    time.sleep(0.5)
    
    # Simple keyword-based categorization
    categories = []
    
    if any(word in transcription_string.lower() for word in ["car", "muscle", "power", "vehicle"]):
        categories.append("Automotive")
    
    if any(word in transcription_string.lower() for word in ["eagle", "bird", "sky", "soar", "creature"]):
        categories.append("Wildlife")
        
    if any(word in transcription_string.lower() for word in ["sea", "diving", "ocean", "coral", "depths"]):
        categories.append("Ocean/Marine")
    
    if not categories:
        categories.append("General")
        
    return {
        "categories": categories,
        "sentiment": random.choice(["positive", "neutral", "negative"]),
        "confidence": random.uniform(0.7, 0.95)
    }


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
        # Generate a unique job ID
        job_id = str(uuid.uuid4())
        print(f"Creating new transcription job with ID: {job_id}")
        
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
            "error": None
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
