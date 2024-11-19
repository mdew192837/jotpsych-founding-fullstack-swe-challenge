import React from "react";
import { useState } from "react";
import AudioRecorder from "./components/AudioRecorder";

function App() {
  const [transcription, setTranscription] = useState<string>("");

  const handleTranscriptionComplete = (text: string) => {
    setTranscription(text);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-8">Audio Transcription Demo</h1>
      <AudioRecorder onTranscriptionComplete={handleTranscriptionComplete} />
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
