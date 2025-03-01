THIS IS THE MOST IMPORTANT FILE IN THE ENTIRE REPO! HUMAN WRITING ONLY! NO AI ALLOWED!

# 1. Recording State Bug

- Had to update my SSH key and remove some stuff from unknown hosts
- From the app realized a few things weren't happening.
- First needed to update the useEffect to take the recordingTime and stopRecording as dependencies in the array so the counter updates properly.
- Need to set the recording time to 0 when stop recording
- Need to filter the text so that it only displays recording time when not recording.
- Stop recording was not having a message that was right (5 - ), updated.

# 2. Adding a loading state for transcribing

- Decided to use the React Spinners library since I had used it before and seemed good.
- The styling was too barebones so decided to install material ui and do some basic styling.

# 3. Adding the version checking

- This took me a while. Did not anticipate it being very difficult. Didn't get to do much cleanup for time reasons.
- Implemented it by adding version tracking, a /version endpoint
- Used this in middleware decorator check_version_compatibiltiy() that checks for X-Frontend-Version, returns 409 if mismatch
- ApiService doesn't allow calls if mismatch
- Note did not do any auto updating of frontend version
- Exposed methods so that UI components can know when mismatch is detected and UI is updated. (snackbar alert + disabled prop)

# 4. Adding concurrency

- This was much funner than I thought it was going to be!
- Backend Changes
  - In-memory job queue with UUIDs
  - Pending, processing, completed, failed states
  - Progress tracking with percentage completion
  - Timestamping for job state changes
  - Used python's threading module to handle multiple jobs
  - API returns immediately with a job ID
  - Backend processing using daemon threads
  - Simulated transcription with delays, mocked categories, sentiment, and confidence scores for future use cases (saw a categorization llm thing later in the doc)
  - Endpoints to transcribe, get job by id, and retrieve all jobs
- Frontend changes:
  - Managed state in ActiveJobs
  - Implemented display using cards with progress bars and status chips, sorting by job status
  - Polling mechanism for job status updates
  - Dyanmic UI updates based on progress

Production considerations:

## Job Queue Management

- Using a distributed task queue such as celery
- Message brokers like redis or RabbitMQ to handle job distribution
- Store the jobs in PostgreSQL or MongoDB instead of in memory

## Scaling Considerations

- Split into separate services for API, job processing, and storage
- Multiple workers to process jobs in parallel
- Distribute incoming requests using nginx or kubernetes
- Adjust worker count based on queue size

## Real time updates

- Websocket connections for real-time job updates
- Could use server-sent events
- Implement push notifications for job completion

## Error handling

- Retry logic - implement exponential backoff for failed jobs
- Circuit breakers to prevent cascading failures
- Failed job queues for analysis
- Could monitor system using something like prometheus and grafana

## Security

- Proper user auth (OAuth / JWT)
- RBAC for job management
- Rate limiting on the API
- Encrypt sensitive data at rest and in transit

## Transcription

- Integrate with APIs but maybe have hybrid approach for cloud APIs and self-hosted models
- Caching (I know we see it below)
- Batch processing