# Browser voice call control

The agent profile polls the authenticated API for a fresh, redacted capability on an assigned project. It enables Call only for a current ready decision. Start creates and starts an ephemeral, recording-off meeting, obtains the existing human LiveKit token with voice-processing consent, connects microphone audio, then creates the exact agent voice session for the gateway to claim. Remote audio is attached without exposing tokens or transcripts. End cancels the gateway session, disconnects media, and closes the meeting with no saved transcript content. Error, reconnect, end, and retry states remain explicit.

Session polling starts from React state only after session creation returns. Refs retain the latest session solely for disconnect, cancellation, and unmount cleanup; they no longer decide whether the initial polling effect runs.
