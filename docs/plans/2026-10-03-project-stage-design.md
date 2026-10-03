# Project Stage design

## Goal

Make project knowledge understandable at a glance by borrowing the strongest visual language from PerkOS Runtime: an ordered team, explicit handoffs, readable work cards, and visible state.

## Direction

Use a hybrid presentation:

- Default: a deterministic 2D **Project Stage** showing the project goal, agents, their current work, status, and connected sources.
- Explore: retain the existing 3D knowledge graph behind an explicit secondary action.
- Expanded mode applies to whichever view is active.

This keeps the analytical graph available while making the default product view useful to a non-technical operator.

## Layout

- Project goal anchors the top of the stage.
- Agents appear as a horizontal handoff row, with the project manager first.
- Each agent owns a vertical work card containing its most recent tasks.
- Thin directional connectors communicate delegation and handoff order.
- Connected sources sit in a separate lower rail and feed the project, rather than competing with work items.
- Status is communicated with text, iconography, and color; color is never the only signal.

## Interaction

- Clicking a task opens its task page.
- “Show completed” continues to filter completed work.
- “Explore graph” switches to the existing interactive 3D view.
- The stage adapts to narrow screens using horizontal scrolling instead of shrinking content below legibility.

## Verification

- Component tests cover grouping, PM-first order, completed filtering, and switching to the 3D explorer.
- Production build verifies dynamic 3D loading remains valid.
- Browser QA checks desktop and narrow layouts with real project data.
