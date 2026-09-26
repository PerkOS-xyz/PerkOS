import type { RuntimeOs } from "./downloads";

/** A plain mark for each system: the command key, the circle of friends, four panes. */
export function PlatformGlyph({ os }: { os: RuntimeOs }) {
  if (os === "macos") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
      </svg>
    );
  }
  if (os === "ubuntu") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden fill="none">
        <g transform="translate(2.2 0)">
          <path
            d="M12.42 17.99A6 6 0 0 1 6.61 14.63M6.61 9.37A6 6 0 0 1 12.42 6.02M16.97 8.65A6 6 0 0 1 16.97 15.36"
            stroke="currentColor"
            strokeWidth="2.4"
          />
          <circle cx="3.1" cy="12" r="2.6" fill="currentColor" />
          <circle cx="16.45" cy="4.29" r="2.6" fill="currentColor" />
          <circle cx="16.45" cy="19.71" r="2.6" fill="currentColor" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <rect x="3" y="3" width="8.25" height="8.25" rx="1" />
      <rect x="12.75" y="3" width="8.25" height="8.25" rx="1" />
      <rect x="3" y="12.75" width="8.25" height="8.25" rx="1" />
      <rect x="12.75" y="12.75" width="8.25" height="8.25" rx="1" />
    </svg>
  );
}
