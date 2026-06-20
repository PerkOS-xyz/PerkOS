# Community Agent Templates — Attribution

`communityTemplates.ts` embeds agent personas (SOUL.md) sourced from open-source
community repositories. All were security-reviewed (prompt-injection / backdoor /
exfiltration audit) before inclusion. See the per-card `origin` + `sourceUrl`.

## OpenClaw-origin templates (16)
- Source: https://github.com/mergisi/awesome-openclaw-agents
- License: MIT — Copyright (c) 2025 OpenClaw Community
- Templates: churn-predictor, seo-writer, social-media, cold-outreach,
  invoice-manager, recruiter, meeting-notes, review-responder
- Each card links to its exact SOUL.md on GitHub via `sourceUrl`.
- Edit: a sample-tweet URL (`crewclaw.com`) was neutralized to a placeholder.

## Hermes-origin templates (3)
- Source: https://github.com/NousResearch/hermes-agent (built-in personalities, cli.py)
- Templates: technical, creative, teacher

## Security note
SOUL.md content is shipped verbatim as the agent's system prompt. The audit found
no injection/backdoor/exfiltration. The real control surface remains least-privilege
at the TOOL layer — a system prompt cannot constrain a jailbroken runtime.
