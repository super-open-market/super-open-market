import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR, apiKey } from "../config.js";
import { API_HOST, GET_KEY_HELP, PRICING_URL } from "../links.js";

const VERSION = "0.1.0";
const USER_AGENT = `super-open-market/${VERSION}`;
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

export type QueryValue = string | number | boolean | undefined | null | Array<string | number>;

export interface RequestOptions {
  /** Path template from the spec, e.g. "/v2/stores/{store_id}/". */
  path: string;
  pathParams?: Record<string, string | number>;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string | undefined>;
  /** Cache lifetime in seconds; 0 disables caching for this call. */
  ttl?: number;
}

export interface Quota {
  limit?: number;
  remaining?: number;
  resetSeconds?: number;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export const lastQuota: Quota = {};
let cacheEnabled = process.env.SOM_NO_CACHE !== "1";

export function setCacheEnabled(enabled: boolean): void {
  cacheEnabled = enabled;
}

export function buildUrl(opts: RequestOptions): string {
  const path = opts.path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = opts.pathParams?.[name];
    if (value === undefined) throw new Error(`missing path parameter: ${name}`);
    return encodeURIComponent(String(value));
  });
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    // Repeatable params (store_ids, consumerReviewUuids, …) are sent as key=a&key=b.
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v));
  }
  const qs = params.toString();
  return `https://${API_HOST}${path}${qs ? `?${qs}` : ""}`;
}

function cachePath(url: string, headers: Record<string, string>): string {
  const key = createHash("sha1").update(url + JSON.stringify(headers)).digest("hex");
  return join(CACHE_DIR, `${key}.json`);
}

function readCache(file: string, ttl: number): unknown | undefined {
  try {
    const entry = JSON.parse(readFileSync(file, "utf8")) as { at: number; body: unknown };
    if (Date.now() - entry.at < ttl * 1000) return entry.body;
  } catch {
    // Missing or corrupt entries are treated as a miss.
  }
  return undefined;
}

function writeCache(file: string, body: unknown): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify({ at: Date.now(), body }));
  } catch {
    // Caching is best-effort.
  }
}

function recordQuota(res: Response): void {
  const num = (name: string) => {
    const v = res.headers.get(name);
    return v === null ? undefined : Number(v);
  };
  lastQuota.limit = num("x-ratelimit-requests-limit") ?? lastQuota.limit;
  lastQuota.remaining = num("x-ratelimit-requests-remaining") ?? lastQuota.remaining;
  lastQuota.resetSeconds = num("x-ratelimit-requests-reset") ?? lastQuota.resetSeconds;
}

function errorFor(status: number, body: unknown): ApiError {
  const upstream =
    (body as { message?: string })?.message ?? (typeof body === "string" ? body : JSON.stringify(body));
  if (status === 401 || (status === 403 && /subscribe/i.test(upstream))) {
    return new ApiError(`${upstream}\n\n${GET_KEY_HELP}`, status, body);
  }
  if (status === 429 && /quota/i.test(upstream)) {
    return new ApiError(`${upstream}\n\nSee plans with higher limits: ${PRICING_URL}`, status, body);
  }
  if (status === 404) {
    return new ApiError(`Not found: ${upstream}`, status, body);
  }
  return new ApiError(`DoorDash API error ${status}: ${upstream}`, status, body);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number) => Number(process.env.SOM_RETRY_BASE_MS ?? 500) * 2 ** attempt;

export async function request<T = unknown>(opts: RequestOptions): Promise<T> {
  const url = buildUrl(opts);
  const key = apiKey();
  if (!key) throw new ApiError(`RAPIDAPI_KEY is not set.\n\n${GET_KEY_HELP}`, 0);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.headers ?? {})) if (v) headers[k] = v;

  const ttl = opts.ttl ?? 0;
  const file = cachePath(url, headers);
  if (cacheEnabled && ttl > 0) {
    const hit = readCache(file, ttl);
    if (hit !== undefined) return hit as T;
  }

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          ...headers,
          "x-rapidapi-key": key,
          "x-rapidapi-host": API_HOST,
          "user-agent": USER_AGENT,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(backoff(attempt));
        continue;
      }
      throw new ApiError(`Network error calling DoorDash API: ${(err as Error).message}`, 0);
    }
    recordQuota(res);

    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Non-JSON error pages are reported as text.
    }

    if (res.ok) {
      if (cacheEnabled && ttl > 0) writeCache(file, body);
      return body as T;
    }
    const retryable = res.status >= 500 || (res.status === 429 && !/quota/i.test(text));
    if (retryable && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
      continue;
    }
    throw errorFor(res.status, body);
  }
}
