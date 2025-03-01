import React, { useState, useEffect } from "react";
import AudioRecorder from "./components/AudioRecorder";
import APIService from "./services/APIService";
import { Alert, Button, Snackbar, Typography, Box, Paper, Divider } from "@mui/material";

interface Transcription {
  id: string;
  text: string;
  timestamp: Date;
}

function App() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{ backend: string; frontend: string } | null>(null);
  const [userId, setUserId] = useState<string>("");
  
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
    
    // Get user ID after a short delay to ensure it's initialized
    const timer = setTimeout(() => {
      setUserId(APIService.getUserID());
    }, 1000);
    
    // Clean up subscription and timer on unmount
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleTranscriptionComplete = (text: string, jobId: string) => {
    // Add the new transcription to the list
    const newTranscription: Transcription = {
      id: jobId,
      text: text,
      timestamp: new Date()
    };
    
    setTranscriptions(prev => [newTranscription, ...prev]);
  };
  
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-2">Audio Transcription Demo</h1>
      {userId && (
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          User ID: {userId.substring(0, 8)}...
        </Typography>
      )}
      
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
      
      {transcriptions.length > 0 && (
        <Box className="mt-8 w-full max-w-2xl">
          <Typography variant="h6" gutterBottom>Transcriptions ({transcriptions.length})</Typography>
          <Divider sx={{ mb: 2 }} />
          
          {transcriptions.map((item, index) => (
            <Paper key={item.id} elevation={1} sx={{ p: 3, mb: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" color="primary">Job ID: {item.id.split('-')[0]}...</Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.timestamp.toLocaleTimeString()}
                </Typography>
              </Box>
              <Typography variant="body1">{item.text}</Typography>
            </Paper>
          ))}
        </Box>
      )}
    </div>
  );
}

export default App;
