import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Typography,
  CircularProgress,
  Paper,
  Stack,
  LinearProgress,
  Box,
  Chip
} from "@mui/material";
import { styled } from "@mui/material/styles";
import APIService from "../services/APIService";

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  width: "100%",
  maxWidth: "400px",
}));

/**
 * Represents a transcription job from the backend
 */
interface TranscriptionJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
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

/**
 * Props for the AudioRecorder component
 */
interface AudioRecorderProps {
  /** Callback fired when transcription is complete with the text and job ID */
  onTranscriptionComplete: (text: string, jobId: string) => void;
  /** Whether the recorder is disabled (e.g., due to version mismatch) */
  disabled?: boolean;
}

/**
 * AudioRecorder component allows users to record audio and get transcriptions
 */
const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscriptionComplete, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [recordingTime, setRecordingTime] = useState(0);
  const [finalRecordingTime, setFinalRecordingTime] = useState(0);
  const [activeJobs, setActiveJobs] = useState<TranscriptionJob[]>([]);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Maximum recording time in seconds
  const MAX_RECORDING_TIME = 60;
  
  /**
   * Formats time in seconds to MM:SS format
   * @param seconds - Time in seconds to format
   * @returns Formatted time string in MM:SS format
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Stops the current recording session
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setFinalRecordingTime(recordingTime);
      setIsRecording(false);
      setRecordingTime(0);
    }
  }, [mediaRecorder, recordingTime]);

  /**
   * Effect to handle recording timer
   */
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRecording) {
      // Simple incrementing timer with fixed 1-second intervals
      interval = setInterval(() => {
        setRecordingTime(prev => {
          // Check if we need to stop recording
          if (prev >= MAX_RECORDING_TIME - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000); // Update exactly every second
    }

    // Cleanup on component unmount or when recording stops
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording, MAX_RECORDING_TIME, stopRecording]);

  /**
   * Starts a new recording session
   */
  const startRecording = async (): Promise<void> => {
    try {
      setRecordingTime(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        
        try {
          console.log('Sending audio for transcription...');
          // Use APIService to submit audio for transcription
          const response = await APIService.transcribeAudio(audioBlob);
          
          if (response.error) {
            console.error("Error starting transcription job:", response.error);
            // Display error to user if needed
          } else if (response.data && response.data.job_id) {
            console.log('Received job ID:', response.data.job_id);
            
            // Add new job to active jobs
            const newJob: TranscriptionJob = {
              id: response.data.job_id,
              status: response.data.status as 'pending',
              progress: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null,
              result: null,
              error: null
            };
            
            console.log('Adding new job to active jobs:', newJob);
            setActiveJobs(prevJobs => {
              const newJobs = [...prevJobs, newJob];
              console.log('Updated active jobs:', newJobs);
              return newJobs;
            });
            
            // Start polling for job status if not already polling
            if (!isPolling) {
              console.log('Starting polling process');
              setIsPolling(true);
              
              // First poll immediately
              await pollJobsStatus();
              
              // Then set up interval
              console.log('Setting up polling interval');
              const interval = setInterval(() => {
                pollJobsStatus().catch(err => {
                  console.error('Error in polling interval:', err);
                });
              }, 1000);
              setPollingInterval(interval);
            }
          }
        } catch (error) {
          console.error("Error sending audio:", error);
        } finally {
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  /**
   * Polls for updates on active transcription jobs
   */
  const pollJobsStatus = async (): Promise<void> => {
    try {
      console.log('Polling for job status updates...', activeJobs);
      
      // Handle race condition: If component just initialized its state, we may have empty activeJobs
      // Let's also check for jobs in the backend
      if (activeJobs.length === 0) {
        console.log('No active jobs in state, checking backend for any jobs');
        try {
          const allJobsResponse = await APIService.getAllJobs();
          if (!allJobsResponse.error && allJobsResponse.data?.jobs?.length > 0) {
            console.log('Found jobs in backend:', allJobsResponse.data.jobs);
            // Update our state with all jobs from backend
            setActiveJobs(allJobsResponse.data.jobs);
            return; // Return and let the next polling cycle handle these jobs
          }
        } catch (err) {
          console.error('Error fetching all jobs:', err);
        }
      }
      
      // Find jobs that need polling (pending or processing)
      const pendingJobs = activeJobs.filter(job => 
        job.status === 'pending' || job.status === 'processing'
      );
      
      console.log(`Found ${pendingJobs.length} pending jobs to poll, total jobs: ${activeJobs.length}`);  
      
      // If no pending jobs but we have completed/failed jobs, we still want to show them
      // We'll just stop the polling
      if (pendingJobs.length === 0 && activeJobs.length > 0) {
        if (pollingInterval) {
          console.log('No more pending jobs, but keeping completed jobs visible');
          clearInterval(pollingInterval);
          setPollingInterval(null);
          setIsPolling(false);
        }
        return;
      }
      
      // If no jobs at all, no need to poll
      if (activeJobs.length === 0) {
        if (pollingInterval) {
          console.log('No active jobs at all, clearing polling interval');
          clearInterval(pollingInterval);
          setPollingInterval(null);
          setIsPolling(false);
        }
        return;
      }
      
      // Poll for each pending job
      for (const job of pendingJobs) {
        try {
          console.log(`Polling job ${job.id}...`);
          const response = await APIService.getJobStatus(job.id);
          if (!response.error && response.data) {
            console.log(`Job ${job.id} status update:`, {
              previousStatus: job.status,
              newStatus: response.data.status,
              id: response.data.id,
              data: response.data
            });
            
            // Update job in state with a proper state update to trigger re-renders
            setActiveJobs(prevJobs => {
              // Create completely new job object to ensure React detects the change
              const updatedJobs = prevJobs.map(j => 
                j.id === job.id ? {...response.data} : j
              );
              
              console.log('Updated jobs after polling:', updatedJobs);
              
              // Force a complete new array to ensure proper re-rendering
              return [...updatedJobs];
            });
            
            // If job is complete, notify parent component
            if (response.data.status === 'completed' && response.data.result) {
              console.log(`Job ${job.id} completed with result:`, response.data.result);
              onTranscriptionComplete(response.data.result, job.id);
              
              // Important: We keep the job in the activeJobs state even when complete
              // This ensures it remains visible in the UI
            }
          }
        } catch (error) {
          console.error(`Error polling job ${job.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in pollJobsStatus:', error);
    }
  };

  // Debug: Log active jobs when they change
  useEffect(() => {
    console.log('Active jobs updated:', activeJobs);
    
    // Log sorted jobs to see if sorting is working correctly
    const sortedJobs = [...activeJobs].sort((a, b) => {
      const priorities = {
        'processing': 0,
        'pending': 1,
        'completed': 2,
        'failed': 3
      };
      const priorityA = priorities[a.status as keyof typeof priorities] ?? 99;
      const priorityB = priorities[b.status as keyof typeof priorities] ?? 99;
      return priorityA - priorityB;
    });
    
    console.log('Jobs after sorting (debug):', sortedJobs.map(job => `${job.id.split('-')[0]}: ${job.status}`));
  }, [activeJobs]);
  
  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        console.log('Component unmounting, clearing polling interval');
        clearInterval(pollingInterval);
        setIsPolling(false);
      }
    };
  }, [pollingInterval]);
  
  // Function to get status chip color
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'warning';
      case 'processing': return 'info';
      case 'completed': return 'success';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  return (
    <StyledPaper>
      {disabled && (
        <Typography variant="body2" color="error" sx={{ mb: 2, textAlign: 'center', fontWeight: 'medium' }}>
          Recording disabled due to version mismatch.
          Please refresh the page to continue.
        </Typography>
      )}

      {!isRecording && finalRecordingTime > 0 && (
        <Typography variant="body2" color="text.secondary">
          Final recording time: {formatTime(finalRecordingTime)}
        </Typography>
      )}
      
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        variant="contained"
        color={isRecording ? "error" : "primary"}
        disabled={disabled}
        sx={{
          minWidth: 180, 
          py: 1,
          opacity: disabled ? 0.7 : 1
        }}
      >
        {isRecording
          ? `Stop Recording (${formatTime(recordingTime)})`
          : "Start Recording"}
      </Button>
      
      {isRecording && (
        <Typography variant="body2" color="text.secondary">
          Recording in progress (Current time: {formatTime(recordingTime)})
        </Typography>
      )}
      
      {/* Active jobs section */}
      {activeJobs.length > 0 && (
        <Box sx={{ width: '100%', mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">
              Transcription Jobs ({activeJobs.length}):
            </Typography>
            
            {activeJobs.some(job => job.status === 'completed' || job.status === 'failed') && (
              <Button 
                size="small" 
                variant="text" 
                color="secondary"
                onClick={() => {
                  // Filter out completed and failed jobs
                  setActiveJobs(prev => prev.filter(
                    job => job.status !== 'completed' && job.status !== 'failed'
                  ));
                }}
              >
                Clear Completed
              </Button>
            )}
          </Box>
          {/* Sort jobs: processing first, then pending, completed, and failed last */}
          {[...activeJobs]
            .sort((a, b) => {
              // Define priority order for status types
              const priorities = {
                'processing': 0,
                'pending': 1,
                'completed': 2,
                'failed': 3
              };
              
              // Extract priorities with fallback to high number for unknown statuses
              const priorityA = priorities[a.status as keyof typeof priorities] ?? 99;
              const priorityB = priorities[b.status as keyof typeof priorities] ?? 99;
              
              // Sort by priority (ascending = higher priority first)
              return priorityA - priorityB;
            })
            .map((job) => (
            <Box key={job.id} sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: 'background.paper', boxShadow: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  Job: {job.id.split('-')[0]}...
                </Typography>
                <Chip 
                  label={job.status}
                  size="small"
                  color={getStatusColor(job.status) as any}
                  variant={job.status === 'completed' ? 'filled' : 'outlined'}
                />
              </Box>
              
              <LinearProgress 
                variant="determinate" 
                value={job.progress} 
                sx={{ mb: 1, height: 6, borderRadius: 1 }}
                color={job.status === 'failed' ? 'error' : 'primary'}
              />
              
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  {job.status === 'completed' 
                    ? `Completed in ${Math.round((new Date(job.completed_at!).getTime() - new Date(job.created_at).getTime()) / 1000)}s` 
                    : job.status === 'failed' 
                      ? `Error: ${job.error}` 
                      : `Progress: ${job.progress}%`}
                </Typography>
                
                {job.status === 'completed' && job.result && (
                  <>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontSize: '0.7rem' }}>
                      Preview: {job.result.substring(0, 60)}...
                    </Typography>
                    
                    {job.categories && (
                      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {job.categories.categories.map((category, idx) => (
                          <Chip 
                            key={idx}
                            label={category}
                            size="small"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                            color={job.categories?.sentiment === 'positive' ? 'success' : 
                                   job.categories?.sentiment === 'negative' ? 'error' : 'default'}
                          />
                        ))}
                        <Chip 
                          label={`${(job.categories.confidence * 100).toFixed(0)}% conf.`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.65rem' }}
                        />
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </StyledPaper>
  );
};

export default AudioRecorder;
