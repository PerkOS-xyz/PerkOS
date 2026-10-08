# Agent rail layout

## Problem

The project-detail rail rendered teammates as a responsive multi-column grid. In
the narrow right rail, six agents became four very thin cards followed by a
second row. Agent names, task names and status text were truncated or wrapped
one word per line, making the team difficult to scan.

## Decision

Render one compact horizontal card per agent. The rail is a vertical timeline:
avatar on the left, readable identity and live status on the right, followed by
the current task, progress and conversation action. This fits the rail's actual
width and remains the same single-column pattern on mobile.

## Behavior

- Show the complete agent name instead of ellipsis.
- Keep delivered count in a compact badge.
- Preserve waiting dependencies, live duration and three-step progress.
- Use smaller avatars without changing the generated avatar system.
- Connect seats with a vertical flow line instead of a horizontal grid line.
- Preserve the existing accessible conversation action and all seat states.

## Validation

- `tests/ProjectTeamStage.test.tsx`: 7 tests passed.
- `npm run build`: production build and TypeScript passed.
- Empty, ready, starting, waiting, working, review, delivered and resting states
  continue to use the same derivation logic; this change is presentation-only.
