# Billing card overflow fix

## Problem

The dashboard sidebar is 280 px wide, but the Billing metrics switch to four
columns based on the viewport breakpoint. On desktop this leaves each metric
too narrow and values such as `Sponsored` escape the card.

## Design

- Use a stable two-column metric grid because the component normally lives in
  a narrow sidebar.
- Add `min-w-0` to grid cells and their text containers so flex/grid children
  may shrink correctly.
- Allow long labels and values to wrap as a defensive fallback instead of
  clipping, shrinking to an unreadable size, or widening the dashboard.
- Keep the existing typography and information hierarchy.

## Acceptance criteria

- `Sponsored` remains entirely inside its metric tile and the Billing card.
- No horizontal document overflow at desktop, tablet, or mobile widths.
- Longer localized labels and numeric values wrap inside their tile.

