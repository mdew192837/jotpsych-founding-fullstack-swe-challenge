interface APIResponse<T> {
  data?: T;
  error?: string;
  version?: string;
}

interface TranscriptionJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  result: string | null;
  error: string | null;
}

type VersionChangeCallback = (backendVersion: string, frontendVersion: string) => void;

class APIService {
  private baseUrl: string = "http://localhost:8000";
  private currentVersion: string = "1.0.0";
  private backendVersion: string = "";
  private userID: string = "";
  private versionMismatch: boolean = false;
  private versionChangeCallbacks: VersionChangeCallback[] = [];
  private versionCheckInterval: number | null = null;
  private readonly USER_ID_KEY = "jotpsych_user_id";

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

  // Generic request handler
  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: FormData | object
  ): Promise<APIResponse<T>> {
    try {
      // Don't make requests if there's a version mismatch
      if (this.versionMismatch && endpoint !== '/version' && endpoint !== '/user') {
        return {
          error: `Version mismatch detected: Your app (${this.currentVersion}) needs to be updated to match the server (${this.backendVersion}). Please refresh your browser.`
        };
      }

      const headers: HeadersInit = {
        'X-Frontend-Version': this.currentVersion
      };
      
      // Only add user ID if it's initialized and not a request to get a user ID
      if (this.userID && endpoint !== '/user') {
        headers['X-User-ID'] = this.userID;
      }

      // Add Content-Type header if body is a plain object (not FormData)
      if (body && !(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      const requestOptions: RequestInit = {
        method,
        headers,
        body: body instanceof FormData ? body : JSON.stringify(body),
      };

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

  // Updated transcribeAudio to start a transcription job
  async transcribeAudio(audioBlob: Blob): Promise<APIResponse<{job_id: string; status: string}>> {
    const formData = new FormData();
    formData.append("audio", audioBlob);

    return this.makeRequest<{job_id: string; status: string}>("/transcribe", "POST", formData);
  }
  
  // Get status of a specific transcription job
  async getJobStatus(jobId: string): Promise<APIResponse<TranscriptionJob>> {
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
      return { error: `Failed to get job status: ${error}` };
    }
  }
  
  // Get all transcription jobs
  async getAllJobs(): Promise<APIResponse<{jobs: TranscriptionJob[]}>> {
    console.log('Fetching all jobs from server');
    try {
      const response = await this.makeRequest<{jobs: TranscriptionJob[]}>("/jobs", "GET");
      console.log('All jobs response:', response);
      
      if (response.error) {
        console.error('Error in getAllJobs response:', response.error);
      } else if (!response.data) {
        console.error('No data in getAllJobs response');
        return { error: 'No data returned from server' };
      }
      
      return response;
    } catch (error) {
      console.error('Error getting all jobs:', error);
      return { error: `Failed to get all jobs: ${error}` };
    }
  }

  // Public method to check if there's a version mismatch
  public hasVersionMismatch(): boolean {
    return this.versionMismatch;
  }

  // Get version information
  public getVersionInfo(): { frontend: string, backend: string | null } {
    return {
      frontend: this.currentVersion,
      backend: this.backendVersion || null
    };
  }
}

export default new APIService();
