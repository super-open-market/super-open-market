// Runs before every test file, before any source module is imported.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "som-test-"));
process.env.SOM_CONFIG_DIR = join(dir, "config");
process.env.SOM_CACHE_DIR = join(dir, "cache");
process.env.SOM_RETRY_BASE_MS = "1";

if (process.env.SOM_LIVE !== "1") {
  // A fixed fake key stops the project's real .env from being loaded, and the
  // fetch guard fails any test that would reach the network without a stub.
  process.env.RAPIDAPI_KEY = "test-key";
  vi.stubGlobal("fetch", () => {
    throw new Error("unexpected network call in a unit test: stub fetch first");
  });
}
