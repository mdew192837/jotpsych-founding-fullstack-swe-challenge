interface APIResponse<T> {
  data?: T;
  error?: string;
  version?: string;
}

type VersionChangeCallback = (backendVersion: string, frontendVersion: string) => void;

class APIService {
  private baseUrl: string = "http://localhost:8000";
  private currentVersion: string = "1.0.0";
  private backendVersion: string = "";
  private userID: string = "1234567890";
  private versionMismatch: boolean = false;
  private versionChangeCallbacks: VersionChangeCallback[] = [];
  private versionCheckInterval: number | null = null;

  constructor() {
    // Check version on initialization
    this.checkBackendVersion();
    
    // Set up periodic version checking (every 5 minutes)
    this.versionCheckInterval = window.setInterval(() => {
      this.checkBackendVersion();
    }, 5 * 60 * 1000);
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
      if (this.versionMismatch && endpoint !== '/version') {
        return {
          error: `Version mismatch detected: Your app (${this.currentVersion}) needs to be updated to match the server (${this.backendVersion}). Please refresh your browser.`
        };
      }

      const headers: HeadersInit = {
        'X-Frontend-Version': this.currentVersion,
        'X-User-ID': this.userID
      };

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

  // Updated transcribeAudio using the generic request handler
  async transcribeAudio(audioBlob: Blob): Promise<APIResponse<any>> {
    const formData = new FormData();
    formData.append("audio", audioBlob);

    return this.makeRequest<any>("/transcribe", "POST", formData);
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
