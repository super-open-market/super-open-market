import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as dd from "../src/client/endpoints.js";
import { setCacheEnabled } from "../src/client/http.js";

const SF = { lat: 37.7749, lng: -122.4194 };
let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(() => setCacheEnabled(false));
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
});

/** The URL and headers of the single request the last call made. */
function sent() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const u = new URL(url);
  const q = (k: string) => u.searchParams.getAll(k);
  return { path: u.pathname, query: Object.fromEntries(u.searchParams), q, headers: init.headers as Record<string, string> };
}

describe("addresses", () => {
  it("addressAutocomplete", async () => {
    await dd.addressAutocomplete({ input: "1 Market", lat: 1, lng: 2, radius: 500 });
    expect(sent()).toMatchObject({ path: "/v1/addresses/autocomplete", query: { input: "1 Market", lat: "1", lng: "2", radius: "500" } });
  });

  it("addressDetails by place_id", async () => {
    await dd.addressDetails({ place_id: "abc" });
    expect(sent()).toMatchObject({ path: "/v2/addresses/details", query: { place_id: "abc" } });
  });

  it("addresses with no location sends no query", async () => {
    await dd.addresses();
    expect(sent()).toMatchObject({ path: "/v2/addresses", query: {} });
  });
});

describe("search", () => {
  it("autocomplete uppercases fulfillment_type and defaults consumer location", async () => {
    await dd.autocomplete({ query: "pizza", ...SF, fulfillment_type: "delivery" });
    expect(sent()).toMatchObject({
      path: "/v2/autocomplete/",
      query: { query: "pizza", lat: "37.7749", lng: "-122.4194", consumer_lat: "37.7749", consumer_lng: "-122.4194", fulfillment_type: "DELIVERY" },
    });
  });

  it("autocomplete defaults to PICKUP and accepts a separate consumer location", async () => {
    await dd.autocomplete({ query: "x", ...SF, consumer: { lat: 1, lng: 2 } });
    expect(sent().query).toMatchObject({ fulfillment_type: "PICKUP", consumer_lat: "1", consumer_lng: "2" });
  });

  it("externalStores", async () => {
    await dd.externalStores({ query: "cafe", ...SF });
    expect(sent()).toMatchObject({ path: "/v1/consumer_external_stores", query: { query: "cafe" } });
  });

  it("storesByIds repeats store_ids and defaults is_pickup_map", async () => {
    await dd.storesByIds({ store_ids: [1, "2"], ...SF });
    const s = sent();
    expect(s.path).toBe("/v1/nearby/stores_by_ids");
    expect(s.q("store_ids")).toEqual(["1", "2"]);
    expect(s.query).toMatchObject({ is_pickup_map: "false", consumer_lat: "37.7749" });
  });

  it("suggestedSearches", async () => {
    await dd.suggestedSearches({ ...SF, district_id: 7, page: "search_landing" });
    expect(sent()).toMatchObject({ path: "/v1/search/suggested_searches/", query: { district_id: "7", page: "search_landing" } });
  });

  it("browseList", async () => {
    await dd.browseList({ ...SF, district_id: 7, submarket_id: 8 });
    expect(sent()).toMatchObject({ path: "/v1/browse/list", query: { district_id: "7", submarket_id: "8" } });
  });
});

describe("restaurants", () => {
  it("storePage keeps the trailing slash", async () => {
    await dd.storePage(336663);
    expect(sent().path).toBe("/v2/stores/336663/");
  });

  it("chefStorePage", async () => {
    await dd.chefStorePage(5);
    expect(sent().path).toBe("/v1/chef/stores/5");
  });

  it("menuItem defaults to delivery and sends the menu language header", async () => {
    await dd.menuItem({ item_id: 9, store_id: 5, language: "es-US" });
    const s = sent();
    expect(s).toMatchObject({ path: "/v2/items/9", query: { store_id: "5", fulfillment_type: "delivery" } });
    expect(s.headers["X-DD-MENU-LANGUAGE"]).toBe("es-US");
  });

  it("menuItem omits the language header when not given", async () => {
    await dd.menuItem({ item_id: 9, store_id: 5 });
    expect(sent().headers).not.toHaveProperty("X-DD-MENU-LANGUAGE");
  });
});

describe("grocery", () => {
  it("convenienceHome", async () => {
    await dd.convenienceHome(1042320, { ...SF, cursor: "c1" });
    expect(sent()).toMatchObject({ path: "/v1/convenience/stores/1042320/home", query: { cursor: "c1", lat: "37.7749" } });
  });

  it("navigation defaults to aisles", async () => {
    await dd.navigation({ store_id: 1 });
    expect(sent()).toMatchObject({ path: "/v2/retail/navigation_l1s", query: { store_id: "1", surface: "aisles" } });
  });

  it("navigation accepts deals", async () => {
    await dd.navigation({ store_id: 1, surface: "deals" });
    expect(sent().query.surface).toBe("deals");
  });

  it("collectionPage turns on pagination and repeats aggregate_store_ids", async () => {
    await dd.collectionPage({ collection_id: "c", store_id: 1, aggregate_store_ids: [2, 3] });
    const s = sent();
    expect(s).toMatchObject({ path: "/v2/retail/collection_page", query: { collection_id: "c", supports_pagination: "true" } });
    expect(s.q("aggregate_store_ids")).toEqual(["2", "3"]);
  });
});

describe("products", () => {
  it("productSearch omits disable_spell_check by default", async () => {
    await dd.productSearch(1, "milk");
    expect(sent()).toMatchObject({ path: "/v2/retail/stores/1/substitution_search", query: { q: "milk" } });
    expect(sent().query).not.toHaveProperty("disable_spell_check");
  });

  it("productSearch can disable spell check", async () => {
    await dd.productSearch(1, "mlik", true);
    expect(sent().query.disable_spell_check).toBe("true");
  });

  it("productSearchAutocomplete", async () => {
    await dd.productSearchAutocomplete(1, "mi");
    expect(sent()).toMatchObject({ path: "/v2/retail/stores/1/substitution_search_autocomplete", query: { q: "mi" } });
  });

  it("convenienceProduct", async () => {
    await dd.convenienceProduct(1, 2, { ms_id: "m" });
    expect(sent()).toMatchObject({ path: "/v1/convenience/stores/1/products/2", query: { ms_id: "m" } });
  });

  it("merchantProduct encodes the item id", async () => {
    await dd.merchantProduct(335808, "a/b c");
    expect(sent().path).toBe("/v1/browse/merchants/335808/products/a%2Fb%20c");
  });

  it("universalProduct", async () => {
    await dd.universalProduct("sic1", { store_id: 3 });
    expect(sent()).toMatchObject({ path: "/v1/browse/universal/products/sic1", query: { store_id: "3" } });
  });

  it("sponsoredProduct", async () => {
    await dd.sponsoredProduct(4, { ...SF, consumer_id: 99 });
    expect(sent()).toMatchObject({ path: "/v1/convenience/ad/products/4", query: { consumer_id: "99" } });
  });
});

describe("reviews", () => {
  it("storeReviews prefixes the target with store_", async () => {
    await dd.storeReviews(336663, { limit: 5, offset: 10 });
    expect(sent()).toMatchObject({ path: "/v1/ratings/page", query: { target: "store_336663", limit: "5", offset: "10" } });
  });

  it("reviewDetails repeats the uuid param", async () => {
    await dd.reviewDetails(["u1", "u2"]);
    expect(sent().q("consumerReviewUuids")).toEqual(["u1", "u2"]);
  });

  it("itemReviews", async () => {
    await dd.itemReviews(1, 2);
    expect(sent()).toMatchObject({ path: "/v1/ratings/consumer_reviews_for_items", query: { store_id: "1", item_id: "2" } });
  });
});
