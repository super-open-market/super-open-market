import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const CONFIG_DIR = process.env.SOM_CONFIG_DIR ?? join(homedir(), ".config", "super-open-market");
export const CACHE_DIR = process.env.SOM_CACHE_DIR ?? join(homedir(), ".cache", "super-open-market");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface Location {
  label: string;
  lat: number;
  lng: number;
  geoAddressId?: string;
}

export interface Config {
  location?: Location;
}

let envLoaded = false;

/** Loads ./.env, then ~/.config/super-open-market/.env, without overriding real env vars. */
function loadEnvFiles(): void {
  if (envLoaded) return;
  envLoaded = true;
  for (const file of [join(process.cwd(), ".env"), join(CONFIG_DIR, ".env")]) {
    if (existsSync(file)) {
      try {
        process.loadEnvFile(file);
      } catch {
        // A malformed .env should not break the CLI; the key check reports what is missing.
      }
    }
  }
}

export function apiKey(): string | undefined {
  loadEnvFiles();
  const key = process.env.RAPIDAPI_KEY?.trim();
  return key ? key : undefined;
}

export function readConfig(): Config {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Config;
  } catch {
    return {};
  }
}

export function writeConfig(config: Config): void {
  mkdirSync(dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

/** Default location when none has been saved. */
export const DEFAULT_LOCATION: Location = { label: "San Francisco, CA", lat: 37.7749, lng: -122.4194 };

export function currentLocation(): Location {
  return readConfig().location ?? DEFAULT_LOCATION;
}
