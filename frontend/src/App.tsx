import React, { useState, useEffect } from "react";
import AudioRecorder from "./components/AudioRecorder";
import APIService from "./services/APIService";
import { Alert, Button, Snackbar } from "@mui/material";

function App() {
  const [transcription, setTranscription] = useState<string>("");
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{ backend: string; frontend: string } | null>(null);
  
  useEffect(() => {
    // Register for version change notifications
    const unsubscribe = APIService.onVersionChange((backendVersion, frontendVersion) => {
      if (backendVersion !== frontendVersion) {
        setVersionMismatch(true);
        setVersionInfo({
          backend: backendVersion,
          frontend: frontendVersion
        });
      } else {
        setVersionMismatch(false);
        setVersionInfo(null);
      }
    });
    
    // Clean up subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleTranscriptionComplete = (text: string) => {
    setTranscription(text);
  };
  
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-8">Audio Transcription Demo</h1>
      
      {/* Version mismatch snackbar */}
      <Snackbar 
        open={versionMismatch} 
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ width: '100%', maxWidth: '600px' }}
      >
        <Alert 
          severity="warning" 
          variant="filled"
          sx={{ width: '100%' }}
          action={
            <Button color="inherit" variant="outlined" size="small" onClick={handleRefresh}>
              REFRESH NOW
            </Button>
          }
        >
          <strong>Version Mismatch Detected</strong><br />
          Your app version ({versionInfo?.frontend}) is out of sync with the server ({versionInfo?.backend}).<br />
          Please refresh to update your app to the latest version.
        </Alert>
      </Snackbar>
      
      <AudioRecorder 
        onTranscriptionComplete={handleTranscriptionComplete} 
        disabled={versionMismatch} 
      />
      {transcription && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h2 className="font-semibold mb-2">Transcription:</h2>
          <p>{transcription}</p>
        </div>
      )}
    </div>
  );
}

export default App;
