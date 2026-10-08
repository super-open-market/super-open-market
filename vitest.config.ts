import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["test/setup.ts"],
    // Live tests spend real API quota, so they only run via `npm run test:live`.
    exclude: process.env.SOM_LIVE === "1" ? ["node_modules/**"] : ["node_modules/**", "test/live.test.ts"],
  },
});
