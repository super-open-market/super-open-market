import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CONFIG_DIR, DEFAULT_LOCATION, apiKey, currentLocation, readConfig, writeConfig } from "../src/config.js";
import { GET_KEY_HELP, LISTING_URL, PRICING_URL, storeUrl } from "../src/links.js";

afterEach(() => {
  process.env.RAPIDAPI_KEY = "test-key";
  rmSync(CONFIG_DIR, { recursive: true, force: true });
});

describe("config", () => {
  it("uses the temporary config dir from test setup", () => {
    expect(CONFIG_DIR).toBe(process.env.SOM_CONFIG_DIR);
  });

  it("reads the key from the environment and trims it", () => {
    process.env.RAPIDAPI_KEY = "  abc  ";
    expect(apiKey()).toBe("abc");
  });

  it("treats a blank key as missing", () => {
    process.env.RAPIDAPI_KEY = "   ";
    expect(apiKey()).toBeUndefined();
  });

  it("returns an empty config when no file exists", () => {
    expect(readConfig()).toEqual({});
  });

  it("round-trips a config file", () => {
    const location = { label: "Home", lat: 1, lng: 2, geoAddressId: "g" };
    writeConfig({ location });
    expect(existsSync(join(CONFIG_DIR, "config.json"))).toBe(true);
    expect(readConfig()).toEqual({ location });
    expect(currentLocation()).toEqual(location);
  });

  it("falls back to San Francisco", () => {
    expect(currentLocation()).toEqual(DEFAULT_LOCATION);
    expect(DEFAULT_LOCATION.label).toMatch(/San Francisco/);
  });
});

describe("links", () => {
  it("points at the DoorDash API listing on RapidAPI", () => {
    expect(LISTING_URL).toBe("https://rapidapi.com/doordashapi/api/doordash11");
    expect(PRICING_URL).toBe(`${LISTING_URL}/pricing`);
  });

  it("puts the listing link in the key help", () => {
    expect(GET_KEY_HELP).toContain(LISTING_URL);
    expect(GET_KEY_HELP).toContain("export RAPIDAPI_KEY=");
  });

  it("builds DoorDash store deep links", () => {
    expect(storeUrl(336663)).toBe("https://www.doordash.com/store/336663/");
  });
});
