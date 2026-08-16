# Local call-start tone

The authenticated click that starts a voice call also creates/resumes a Web Audio
context and plays a quiet two-frequency ring pattern while the session is connecting.
The tone is local-only: it is never published to LiveKit, sent to Bragi, recorded, or
persisted. It stops on joined, failed, cancelled, explicit End, or component unmount.
The existing visible connecting state and accessible call button remain authoritative;
failure to create or resume Web Audio never blocks the call.

## Network reconnection

LiveKit remains the first recovery layer: its JavaScript SDK resumes signaling and
performs an ICE restart when the phone changes network. The UI reports reconnecting
and returns to the active call on the SDK's reconnected event without creating a new
voice session.

If the SDK emits terminal disconnected, Web requests a fresh short-lived human media
grant and retries the same meeting with bounded backoff (immediate, then 1/2/4/8/15
seconds). The existing voice session and conversation context remain unchanged. A
successful recovery republishes the microphone with browser audio processing. If all
recovery attempts fail, Web cancels the voice session and ends the meeting so an
abandoned backend lease cannot remain active.
