# Tablet agent chat layout

## Verified problem

At a 1024 × 768 authenticated agent page, the conversation history was 672px tall and the message composer began below the viewport. The `md` breakpoint also displayed Conversation and Settings together, while the chat history imposed desktop minimum and maximum heights. The result required page scrolling to discover the input.

## Responsive behavior

- Phone: Conversation is the default tab. It uses a safe viewport-height surface above the bottom navigation; history scrolls internally and the composer remains in the surface.
- Tablet: Conversation and Settings remain mutually exclusive tabs. The conversation uses the dynamic viewport below the tablet top bar; the call control remains compact; history consumes the flexible remainder and the composer does not scroll away.
- Wide desktop (`xl` and above): the full agent document is restored. Conversation and Settings may both participate in document flow and the history receives its desktop reading height.

This uses layout behavior rather than device detection or a list of device-specific pixel heights. `svh` protects the phone layout from expanding browser chrome, while `dvh` follows the usable tablet viewport.

The live production check deliberately reserves a 24px tablet bottom inset: at 768 × 1024 portrait and 1024 × 768 landscape, both the textarea and Send control remain fully inside the viewport instead of touching its edge.

The mobile and tablet call surface also overrides the shared Card component's structural padding. Its phone/hang-up action remains an accessible 44px circle, status stays adjacent, and the larger padded treatment returns only on wide desktop. This removes decorative empty height without hiding call state, privacy mode, duration, mute, or errors.

## Accessibility and invariants

- Existing tab roles, labels, keyboard focus, call controls, Normal/Private policy, direct/project context, message behavior, and settings content are unchanged.
- History remains a labelled scroll region.
- The composer is a non-shrinking child with a visual boundary and safe-area padding.
- No API, Voice gateway, Chat service, A2A, agent runtime, or persistence behavior changes.
