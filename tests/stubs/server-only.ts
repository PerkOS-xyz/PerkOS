// Stub for Next.js's `server-only` guard module so server-side libs can
// be imported from vitest (jsdom env). In production builds Next replaces
// `server-only` with a real guard that errors on client-side bundling;
// in tests we don't need that signal.
export {};
