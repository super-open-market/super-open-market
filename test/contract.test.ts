import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildUrl } from "../src/client/http.js";

const spec = JSON.parse(readFileSync("doordash-spec.json", "utf8"));
const source = readFileSync("src/client/endpoints.ts", "utf8");
const clientPaths = new Set([...source.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]));

describe("client ↔ spec contract", () => {
  it("covers every endpoint in the spec", () => {
    expect([...clientPaths].sort()).toEqual(Object.keys(spec.paths).sort());
  });

  it("encodes path params and repeatable query params", () => {
    const url = buildUrl({
      path: "/v1/nearby/stores_by_ids",
      query: { store_ids: ["1", "2"], lat: 1, empty: "", skip: undefined },
    });
    expect(url).toBe("https://doordash11.p.rapidapi.com/v1/nearby/stores_by_ids?store_ids=1&store_ids=2&lat=1");
    expect(buildUrl({ path: "/v2/stores/{store_id}/", pathParams: { store_id: 42 } })).toBe(
      "https://doordash11.p.rapidapi.com/v2/stores/42/",
    );
  });
});
