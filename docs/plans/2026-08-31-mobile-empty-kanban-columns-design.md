# Compact empty Kanban columns on mobile

## Problem

The Tasks Kanban stacks three columns on mobile. Every empty drop zone keeps a
120 px minimum height, so empty phases consume most of the first viewport and
look like broken whitespace.

## Design

- Show an explicit localized `No tasks in this phase` message in every empty
  column.
- Empty drop zones use a compact 56 px minimum height on mobile and retain 120
  px from the tablet breakpoint for desktop drag-and-drop.
- Non-empty columns keep the existing minimum height and behavior.
- Preserve each full phase header and count; do not hide workflow phases.

## Acceptance criteria

- Empty mobile phases have explanatory copy and no large blank region.
- All three phase names and counts remain visible.
- Empty columns remain valid drop targets.
- Tablet/desktop Kanban behavior is unchanged.

