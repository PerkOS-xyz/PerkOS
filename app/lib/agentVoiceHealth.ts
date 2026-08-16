/**
 * Client helpers for owner-visible Voice Health (codes + playbooks only).
 */
export type VoiceHealthCode =
  | "contract_invalid"
  | "config_invalid"
  | "runtime_unhealthy"
  | "runtime_not_ready"
  | "runtime_response_failed"
  | "runtime_response_too_slow"
  | "media_unavailable"
  | "speech_unavailable"
  | "control_plane_unavailable"
  | "capability_publish_unavailable"
  | "session_grant_failed"
  | "session_media_failed"
  | "session_runtime_failed"
  | "session_stage_failed";

export type VoiceHealthPlaybook = {
  code: VoiceHealthCode;
  title: string;
  ownerActions: string[];
  platformNotes: string[];
};

export type VoiceHealthView = {
  available: boolean;
  status: "ready" | "unavailable" | "stale" | "unknown";
  ready: boolean;
  codes: VoiceHealthCode[];
  checkedAt?: string;
  source?: string;
  stage?: string;
  playbooks: VoiceHealthPlaybook[];
  capabilityAvailable?: boolean;
  capabilityStatus?: string;
  capabilityReason?: string;
  capabilityExpiresAt?: string;
};

export type VoiceHealthEvent = {
  ready: boolean;
  codes: VoiceHealthCode[];
  checkedAt?: string;
  source?: string;
  stage?: string;
  recordedAt?: string;
  playbooks: VoiceHealthPlaybook[];
};

export function summarizeVoiceHealthCodes(codes: readonly string[]): string {
  if (codes.length === 0) return "No issues reported";
  return codes.join(", ");
}
