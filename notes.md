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

# 3.