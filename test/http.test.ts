import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, lastQuota, request, setCacheEnabled } from "../src/client/http.js";
import { LISTING_URL, PRICING_URL } from "../src/links.js";

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;

/** Stubs fetch with a queue of replies and returns the mock for call inspection. */
function mockFetch(...replies: Reply[]) {
  const fn = vi.fn(async () => {
    const r = replies.shift();
    if (!r) throw new Error("no more stubbed replies");
    if (r instanceof Error) throw r;
    const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {});
    return new Response(body, { status: r.status ?? 200, headers: r.headers });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const calledUrl = (fn: ReturnType<typeof mockFetch>, i = 0) => String((fn.mock.calls[i] as unknown[])[0]);
const calledInit = (fn: ReturnType<typeof mockFetch>, i = 0) => (fn.mock.calls[i] as unknown[])[1] as RequestInit;

let path = 0;
/** A unique path per test so cache entries never leak between tests. */
const freshPath = () => `/test/${++path}/{id}`;

beforeEach(() => setCacheEnabled(true));
afterEach(() => {
  process.env.RAPIDAPI_KEY = "test-key";
});

describe("request: live mode", () => {
  it("sends RapidAPI headers, user agent and caller headers", async () => {
    const fn = mockFetch({ body: { ok: true } });
    await request({ path: freshPath(), pathParams: { id: 1 }, headers: { "X-DD-MENU-LANGUAGE": "es-US", skipped: undefined } });
    const headers = calledInit(fn).headers as Record<string, string>;
    expect(headers["x-rapidapi-key"]).toBe("test-key");
    expect(headers["x-rapidapi-host"]).toBe("doordash11.p.rapidapi.com");
    expect(headers["user-agent"]).toMatch(/^super-open-market\/\d+\.\d+\.\d+$/);
    expect(headers["X-DD-MENU-LANGUAGE"]).toBe("es-US");
    expect(headers).not.toHaveProperty("skipped");
  });

  it("returns parsed JSON", async () => {
    mockFetch({ body: { results: [1, 2] } });
    await expect(request({ path: freshPath(), pathParams: { id: 1 } })).resolves.toEqual({ results: [1, 2] });
  });

  it("records quota headers", async () => {
    mockFetch({
      body: {},
      headers: {
        "x-ratelimit-requests-limit": "500000",
        "x-ratelimit-requests-remaining": "499000",
        "x-ratelimit-requests-reset": "3600",
      },
    });
    await request({ path: freshPath(), pathParams: { id: 1 } });
    expect(lastQuota).toEqual({ limit: 500000, remaining: 499000, resetSeconds: 3600 });
  });
});

describe("request: caching", () => {
  it("serves a repeat call from cache within the TTL", async () => {
    const fn = mockFetch({ body: { n: 1 } }, { body: { n: 2 } });
    const p = freshPath();
    expect(await request({ path: p, pathParams: { id: 1 }, ttl: 60 })).toEqual({ n: 1 });
    expect(await request({ path: p, pathParams: { id: 1 }, ttl: 60 })).toEqual({ n: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("keys the cache on query params", async () => {
    const fn = mockFetch({ body: { n: 1 } }, { body: { n: 2 } });
    const p = freshPath();
    await request({ path: p, pathParams: { id: 1 }, query: { q: "a" }, ttl: 60 });
    expect(await request({ path: p, pathParams: { id: 1 }, query: { q: "b" }, ttl: 60 })).toEqual({ n: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not cache when ttl is 0", async () => {
    const fn = mockFetch({ body: { n: 1 } }, { body: { n: 2 } });
    const p = freshPath();
    await request({ path: p, pathParams: { id: 1 } });
    expect(await request({ path: p, pathParams: { id: 1 } })).toEqual({ n: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("bypasses the cache when disabled", async () => {
    const fn = mockFetch({ body: { n: 1 } }, { body: { n: 2 } });
    const p = freshPath();
    setCacheEnabled(false);
    await request({ path: p, pathParams: { id: 1 }, ttl: 60 });
    expect(await request({ path: p, pathParams: { id: 1 }, ttl: 60 })).toEqual({ n: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never caches errors", async () => {
    const fn = mockFetch({ status: 404, body: { message: "nope" } }, { body: { n: 2 } });
    const p = freshPath();
    await expect(request({ path: p, pathParams: { id: 1 }, ttl: 60 })).rejects.toThrow(ApiError);
    expect(await request({ path: p, pathParams: { id: 1 }, ttl: 60 })).toEqual({ n: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("request: retries", () => {
  it("retries 5xx and then succeeds", async () => {
    const fn = mockFetch({ status: 502 }, { status: 503 }, { body: { ok: 1 } });
    expect(await request({ path: freshPath(), pathParams: { id: 1 } })).toEqual({ ok: 1 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("retries a rate-limit 429", async () => {
    const fn = mockFetch({ status: 429, body: { message: "Too many requests" } }, { body: { ok: 1 } });
    expect(await request({ path: freshPath(), pathParams: { id: 1 } })).toEqual({ ok: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries network errors", async () => {
    const fn = mockFetch(new TypeError("fetch failed"), { body: { ok: 1 } });
    expect(await request({ path: freshPath(), pathParams: { id: 1 } })).toEqual({ ok: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 retries", async () => {
    const fn = mockFetch({ status: 500 }, { status: 500 }, { status: 500 }, { status: 500, body: { message: "boom" } });
    const err = await request({ path: freshPath(), pathParams: { id: 1 } }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toContain("boom");
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("reports a network failure after retries", async () => {
    mockFetch(...Array.from({ length: 4 }, () => new TypeError("fetch failed")));
    await expect(request({ path: freshPath(), pathParams: { id: 1 } })).rejects.toThrow(/Network error.*fetch failed/);
  });

  it("does not retry 4xx errors", async () => {
    const fn = mockFetch({ status: 400, body: { message: "bad" } });
    await expect(request({ path: freshPath(), pathParams: { id: 1 } })).rejects.toThrow(ApiError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("request: friendly errors", () => {
  it("turns 'not subscribed' into free-key instructions", async () => {
    mockFetch({ status: 403, body: { message: "You are not subscribed to this API." } });
    const err = await request({ path: freshPath(), pathParams: { id: 1 } }).catch((e) => e);
    expect(err.status).toBe(403);
    expect(err.message).toContain("You are not subscribed to this API.");
    expect(err.message).toContain(LISTING_URL);
    expect(err.message).toContain("export RAPIDAPI_KEY=");
  });

  it("turns an invalid key (401) into free-key instructions", async () => {
    mockFetch({ status: 401, body: { message: "Invalid API key." } });
    await expect(request({ path: freshPath(), pathParams: { id: 1 } })).rejects.toThrow(LISTING_URL);
  });

  it("points an exhausted quota at the pricing page without retrying", async () => {
    const fn = mockFetch({ status: 429, body: { message: "You have exceeded the MONTHLY quota for Requests" } });
    await expect(request({ path: freshPath(), pathParams: { id: 1 } })).rejects.toThrow(PRICING_URL);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reports 404 as not found", async () => {
    mockFetch({ status: 404, body: { message: "Resource not found" } });
    await expect(request({ path: freshPath(), pathParams: { id: 1 } })).rejects.toThrow(/^Not found: Resource not found/);
  });

  it("reports a non-JSON error body as text", async () => {
    mockFetch({ status: 400, body: "<html>Bad Gateway</html>" });
    await expect(request({ path: freshPath(), pathParams: { id: 1 } })).rejects.toThrow("<html>Bad Gateway</html>");
  });

  it("does not show key instructions for an unrelated 403", async () => {
    mockFetch({ status: 403, body: { message: "Forbidden region" } });
    const err = await request({ path: freshPath(), pathParams: { id: 1 } }).catch((e) => e);
    expect(err.message).not.toContain(LISTING_URL);
  });
});

describe("request: missing key", () => {
  it("explains how to get a free key without touching the network", async () => {
    process.env.RAPIDAPI_KEY = "";
    const fn = mockFetch();
    const err = await request({ path: freshPath(), pathParams: { id: 1 } }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toMatch(/^RAPIDAPI_KEY is not set/);
    expect(err.message).toContain(LISTING_URL);
    expect(fn).not.toHaveBeenCalled();
  });

  it("fails on a missing path parameter before any call", async () => {
    const fn = mockFetch();
    await expect(request({ path: "/v2/stores/{store_id}/" })).rejects.toThrow("missing path parameter: store_id");
    expect(fn).not.toHaveBeenCalled();
  });
});
