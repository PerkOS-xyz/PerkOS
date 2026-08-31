# Chat layout hardening

## Goal

Keep every chat composer visible and usable at desktop, tablet, and mobile sizes without route-local viewport subtraction constants.

## Design

- The authenticated app shell owns the viewport height on `/chat` routes.
- Header, organization picker, active-session strip, and mobile navigation are fixed-size siblings; the content slot receives the remaining space through `flex-1 min-h-0`.
- The chat layout fills that slot. Only message history scrolls; the composer is a non-shrinking footer with safe-area padding.
- Agent detail presents text chat before voice. Voice remains available in a native, accessible disclosure so it no longer pushes the primary composer below the first viewport.

## Verification

- Unit tests protect the height contract.
- Source-order tests protect the Chat-before-Voice hierarchy.
- Browser checks measure the composer against `window.innerHeight` at desktop and mobile viewports.
