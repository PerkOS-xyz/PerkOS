# Projects and organizations view toggle

## Design

Projects and Organizations each receive an independent, persistent Cards/List
preference. Cards are the default and use a responsive 1/2/3-column grid;
List preserves compact scanning and bulk operations. The segmented icon
control exposes pressed state and localized accessible labels.

Project cards surface name, goal, status, agent/task counts, and recent
activity. Selection remains outside the navigation link. Organization cards
surface active/default state, project count, owner context, members, rename,
and active-organization controls. Existing data loading, filtering, mutation,
and navigation flows remain unchanged.

## Acceptance criteria

- Both screens default to Cards and remember independent choices.
- Cards use three, two, and one columns at desktop, tablet, and mobile.
- List mode preserves current compact behavior and project bulk selection.
- Buttons are keyboard accessible and expose `aria-pressed`.
- Long names and goals remain contained inside cards.
