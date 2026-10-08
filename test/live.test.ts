// Live smoke test against the real API. Spends about 6 requests of quota.
// Run with: npm run test:live  (needs RAPIDAPI_KEY in the environment or .env)
import { beforeAll, describe, expect, it } from "vitest";
import * as dd from "../src/client/endpoints.js";
import { lastQuota, setCacheEnabled } from "../src/client/http.js";
import { apiKey } from "../src/config.js";

const SF = { lat: 37.7749, lng: -122.4194 };
const RESTAURANT = 336663;
const CONVENIENCE = 1042320; // 7-Eleven, San Francisco

beforeAll(() => {
  setCacheEnabled(false);
  if (!apiKey()) throw new Error("live tests need RAPIDAPI_KEY");
});

describe("live API", { timeout: 60_000 }, () => {
  it("autocomplete finds real DoorDash stores", async () => {
    const r = await dd.autocomplete({ query: "7-eleven", ...SF });
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results[0]).toHaveProperty("id");
    expect(lastQuota.remaining).toBeTypeOf("number");
  });

  it("address autocomplete returns place ids", async () => {
    const r = await dd.addressAutocomplete({ input: "1 Market St San Francisco" });
    expect(JSON.stringify(r)).toMatch(/place_id/);
  });

  it("restaurant store page has display modules", async () => {
    const r = await dd.storePage(RESTAURANT);
    expect(Array.isArray(r.display_modules)).toBe(true);
  });

  it("convenience home returns the store", async () => {
    const r = await dd.convenienceHome(CONVENIENCE, SF);
    expect(r.store.id).toBe(CONVENIENCE);
  });

  it("in-store product search answers", async () => {
    const r = await dd.productSearch(CONVENIENCE, "milk");
    expect(r).toBeTypeOf("object");
  });

  it("store reviews answer", async () => {
    const r = await dd.storeReviews(RESTAURANT, { limit: 3 });
    expect(r).toBeTypeOf("object");
  });
});
