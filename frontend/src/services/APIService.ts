// API Response types
interface APIResponse<T> {
  data?: T;
  error?: string;
  version?: string;
}

// Job status types
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Transcription Job interface
interface TranscriptionJob {
  id: string;
  status: JobStatus;
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  result: string | null;
  error: string | null;
  categories?: {
    categories: string[];
    sentiment: string;
    confidence: number;
  };
}

// Job response interfaces
interface TranscriptionJobResponse {
  job_id: string;
  status: JobStatus;
}

interface AllJobsResponse {
  jobs: TranscriptionJob[];
}

// Version callback type
type VersionChangeCallback = (backendVersion: string, frontendVersion: string) => void;

/**
 * APIService handles all communication with the backend API.
 * Includes version compatibility checking and user ID management.
 */
class APIService {
  // API configuration
  private readonly baseUrl: string = "http://localhost:8000";
  private readonly currentVersion: string = "1.0.0";
  private readonly USER_ID_KEY = "jotpsych_user_id";
  
  // State
  private backendVersion: string = "";
  private userID: string = "";
  private versionMismatch: boolean = false;
  private versionChangeCallbacks: VersionChangeCallback[] = [];
  private versionCheckInterval: number | null = null;

  constructor() {
    // Initialize user ID from localStorage or get from server
    this.initializeUserID();
    
    // Check version on initialization
    this.checkBackendVersion();
    
    // Set up periodic version checking (every 5 minutes)
    this.versionCheckInterval = window.setInterval(() => {
      this.checkBackendVersion();
    }, 5 * 60 * 1000);
  }
  
  // User identity management
  private async initializeUserID(): Promise<void> {
    // Try to get user ID from localStorage
    const storedUserID = localStorage.getItem(this.USER_ID_KEY);
    
    if (storedUserID) {
      console.log("Using stored user ID:", storedUserID);
      this.userID = storedUserID;
    } else {
      // If no stored ID, request a new one from the backend
      try {
        const response = await fetch(`${this.baseUrl}/user`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Frontend-Version': this.currentVersion
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.user_id) {
            this.userID = data.user_id;
            localStorage.setItem(this.USER_ID_KEY, this.userID);
            console.log("Generated new user ID:", this.userID);
          }
        } else {
          console.error("Failed to get user ID from server");
          // Fall back to generating a client-side ID if server fails
          this.userID = this.generateClientSideID();
          localStorage.setItem(this.USER_ID_KEY, this.userID);
        }
      } catch (error) {
        console.error("Error getting user ID:", error);
        // Fall back to generating a client-side ID if request fails
        this.userID = this.generateClientSideID();
        localStorage.setItem(this.USER_ID_KEY, this.userID);
      }
    }
  }
  
  // Fallback method to generate a client-side ID if server request fails
  private generateClientSideID(): string {
    return 'client-' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  // Get the current user ID
  public getUserID(): string {
    return this.userID;
  }

  // Version compatibility functionality
  private async checkBackendVersion(): Promise<void> {
    try {
      // First check if the version endpoint exists
      const response = await fetch(`${this.baseUrl}/version`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // If the endpoint doesn't exist (404) or server error, just log and return
      if (!response.ok) {
        console.log(`Backend version endpoint not available: ${response.status}`);
        return;
      }
      
      // Try to parse the JSON response
      try {
        const data = await response.json();
        
        if (data.version && this.backendVersion !== data.version) {
          const previousVersion = this.backendVersion;
          this.backendVersion = data.version;
          
          // Check for version mismatch
          if (this.backendVersion !== this.currentVersion) {
            this.versionMismatch = true;
            this.notifyVersionChange(this.backendVersion, this.currentVersion);
          } else if (previousVersion && previousVersion !== this.currentVersion) {
            // Version was mismatched but is now fixed
            this.versionMismatch = false;
            this.notifyVersionChange(this.backendVersion, this.currentVersion);
          }
        }
      } catch (parseError) {
        console.error("Error parsing version response:", parseError);
      }
    } catch (error) {
      console.error("Error checking backend version:", error);
    }
  }

  // Register a callback for version changes
  public onVersionChange(callback: VersionChangeCallback): () => void {
    this.versionChangeCallbacks.push(callback);
    
    // If we already know there's a version mismatch, notify immediately
    if (this.versionMismatch && this.backendVersion) {
      callback(this.backendVersion, this.currentVersion);
    }
    
    // Return a function to unregister this callback
    return () => {
      this.versionChangeCallbacks = this.versionChangeCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyVersionChange(backendVersion: string, frontendVersion: string): void {
    this.versionChangeCallbacks.forEach((callback) => {
      callback(backendVersion, frontendVersion);
    });
  }

  /**
   * Generic request handler for all API calls
   * @param endpoint - API endpoint to call
   * @param method - HTTP method
   * @param body - Optional request body
   * @returns Promise with typed API response
   */
  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: FormData | object
  ): Promise<APIResponse<T>> {
    try {
      // Don't make requests if there's a version mismatch (except for version and user endpoints)
      if (this.versionMismatch && endpoint !== '/version' && endpoint !== '/user') {
        return {
          error: `Version mismatch detected: Your app (${this.currentVersion}) needs to be updated to match the server (${this.backendVersion}). Please refresh your browser.`
        };
      }

      // Prepare headers
      const headers: HeadersInit = {
        'X-Frontend-Version': this.currentVersion
      };
      
      // Add user ID to all requests except for /user endpoint
      if (this.userID && endpoint !== '/user') {
        headers['X-User-ID'] = this.userID;
      }

      // Set content type for JSON payloads
      if (body && !(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers,
        body: body instanceof FormData ? body : JSON.stringify(body),
      };

      // Make the request
      const response = await fetch(
        `${this.baseUrl}${endpoint}`,
        requestOptions
      );
      
      const data = await response.json();
      
      // Check for version mismatch in response
      if (response.status === 409 && data.error === "Version mismatch") {
        this.versionMismatch = true;
        this.backendVersion = data.backend_version;
        this.notifyVersionChange(data.backend_version, this.currentVersion);
        return { 
          error: `Version mismatch detected: Your app (${this.currentVersion}) needs to be updated to match the server (${data.backend_version}). Please refresh your browser.` 
        };
      }
      
      // Update backend version from response if available
      if (data.version && this.backendVersion !== data.version) {
        this.backendVersion = data.version;
        
        if (this.backendVersion !== this.currentVersion) {
          this.versionMismatch = true;
          this.notifyVersionChange(this.backendVersion, this.currentVersion);
        }
      }
      
      return { data: data, version: data.version };
    } catch (error) {
      return { error: `Request failed: ${error}` };
    }
  }

  /**
   * Uploads audio blob for transcription
   * @param audioBlob - The audio recording blob to transcribe
   * @returns Promise with job creation response
   */
  public async transcribeAudio(audioBlob: Blob): Promise<APIResponse<TranscriptionJobResponse>> {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    return this.makeRequest<TranscriptionJobResponse>("/transcribe", "POST", formData);
  }
  
  /**
   * Gets status of a specific transcription job
   * @param jobId - ID of the job to check
   * @returns Promise with job status
   */
  public async getJobStatus(jobId: string): Promise<APIResponse<TranscriptionJob>> {
    console.log(`Polling job status for job ${jobId}`);
    try {
      const response = await this.makeRequest<TranscriptionJob>(`/job/${jobId}`, "GET");
      console.log(`Got response for job ${jobId}:`, response);
      
      if (response.error) {
        console.error(`Error in getJobStatus response for job ${jobId}:`, response.error);
      } else if (!response.data) {
        console.error(`No data in getJobStatus response for job ${jobId}`);
        return { error: 'No data returned from server' };
      }
      
      return response;
    } catch (error) {
      console.error(`Error polling job ${jobId}:`, error);
      return { error: `Failed to get job status: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
  
  /**
   * Gets all transcription jobs
   * @returns Promise with all jobs
   */
  public async getAllJobs(): Promise<APIResponse<AllJobsResponse>> {
    console.log('Fetching all jobs from server');
    try {
      const response = await this.makeRequest<AllJobsResponse>("/jobs", "GET");
      
      if (response.error) {
        console.error('Error in getAllJobs response:', response.error);
      } else if (!response.data) {
        console.error('No data in getAllJobs response');
        return { error: 'No data returned from server' };
      }
      
      return response;
    } catch (error) {
      console.error('Error getting all jobs:', error);
      return { error: `Failed to get all jobs: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Check if there's a version mismatch between frontend and backend
   * @returns boolean indicating if versions don't match
   */
  public hasVersionMismatch(): boolean {
    return this.versionMismatch;
  }

  /**
   * Get current version information
   * @returns Object containing frontend and backend versions
   */
  public getVersionInfo(): { frontend: string, backend: string | null } {
    return {
      frontend: this.currentVersion,
      backend: this.backendVersion || null
    };
  }
}

export default new APIService();
