import React, { useState, useEffect } from "react";
import {
  Button,
  Typography,
  CircularProgress,
  Paper,
  Stack
} from "@mui/material";
import { styled } from "@mui/material/styles";

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

const AudioRecorder = ({ onTranscriptionComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [recordingTime, setRecordingTime] = useState(0);
  const [finalRecordingTime, setFinalRecordingTime] = useState(0);

  const MAX_RECORDING_TIME = 10;

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setFinalRecordingTime(recordingTime);
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  useEffect(() => {
    let interval;

    if (isRecording) {
      interval = setInterval(() => {
        if (recordingTime >= MAX_RECORDING_TIME) {
          stopRecording();
        } else {
          setRecordingTime(recordingTime + 1);
        }
      }, 1000);
    }

    return () => {
      clearInterval(interval);
    };
  }, [isRecording, recordingTime, stopRecording]);

  const startRecording = async () => {
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
        const formData = new FormData();
        formData.append("audio", audioBlob);

        try {
          setIsTranscribing(true);
          // TODO: Use APIService for api requests
          const response = await fetch("http://localhost:8000/transcribe", {
            method: "POST",
            body: formData,
          });
          const data = await response.json();
          onTranscriptionComplete(data.transcription);
        } catch (error) {
          console.error("Error sending audio:", error);
        } finally {
          setIsTranscribing(false);
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

  return (
    <StyledPaper>
      {!isRecording && !isTranscribing && finalRecordingTime > 0 && (
        <Typography variant="body2" color="text.secondary">
          Final recording time: {finalRecordingTime}s
        </Typography>
      )}
      {isTranscribing ? (
        <Stack direction="column" spacing={2} alignItems="center">
          <CircularProgress size={40} color="primary" />
          <Typography variant="body2" color="text.secondary">
            Transcribing audio...
          </Typography>
        </Stack>
      ) : (
        <>
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            variant="contained"
            color={isRecording ? "error" : "primary"}
            disabled={isTranscribing}
            sx={{ minWidth: 180, py: 1 }}
          >
            {isRecording
              ? `Stop Recording (${recordingTime}s)`
              : "Start Recording"}
          </Button>
          {isRecording && (
            <Typography variant="body2" color="text.secondary">
              Recording in progress (Current time: {recordingTime}s)
            </Typography>
          )}
        </>
      )}
    </StyledPaper>
  );
};

export default AudioRecorder;
