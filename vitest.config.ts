import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // Next.js's `server-only` guard module isn't resolvable in jsdom;
      // alias it to an empty stub so server-side libs are importable
      // from tests without dragging in the Next runtime.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["app/lib/**/*.ts", "app/components/**/*.tsx"],
      exclude: ["**/*.test.*", "**/*.d.ts"],
    },
  },
});
