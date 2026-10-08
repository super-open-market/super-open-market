// One function per DoorDash11 endpoint (see doordash-spec.json). Responses are
// returned raw; src/normalize turns them into small stable shapes.
import { request } from "./http.js";

type Id = string | number;
type Raw = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const TTL = { search: 120, page: 900, reviews: 3600, address: 86_400 } as const;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Optional location context accepted by many retail endpoints. */
export interface Locality {
  lat?: number;
  lng?: number;
  district_id?: Id;
  submarket_id?: Id;
  consumer_id?: Id;
}

// ── Addresses ──────────────────────────────────────────────────────────────

export const addressAutocomplete = (p: { input: string; lat?: number; lng?: number; radius?: number }) =>
  request<Raw>({ path: "/v1/addresses/autocomplete", query: p, ttl: TTL.address });

export const addressDetails = (p: { place_id?: string; geo_address_id?: Id }) =>
  request<Raw>({ path: "/v2/addresses/details", query: p, ttl: TTL.address });

export const addresses = (p: Partial<LatLng> = {}) =>
  request<Raw>({ path: "/v2/addresses", query: { ...p }, ttl: TTL.address });

// ── Search ─────────────────────────────────────────────────────────────────

/** Store and item suggestions. The API only answers for uppercase fulfillment types. */
export const autocomplete = (p: LatLng & { query: string; fulfillment_type?: string; consumer?: LatLng }) =>
  request<Raw>({
    path: "/v2/autocomplete/",
    query: {
      query: p.query,
      lat: p.lat,
      lng: p.lng,
      consumer_lat: p.consumer?.lat ?? p.lat,
      consumer_lng: p.consumer?.lng ?? p.lng,
      fulfillment_type: (p.fulfillment_type ?? "PICKUP").toUpperCase(),
    },
    ttl: TTL.search,
  });

/** Places matching a name that are NOT on DoorDash (each has `has_requested`). */
export const externalStores = (p: LatLng & { query: string }) =>
  request<Raw>({ path: "/v1/consumer_external_stores", query: { ...p }, ttl: TTL.search });

export const storesByIds = (p: LatLng & { store_ids: Id[]; consumer?: LatLng; is_pickup_map?: boolean }) =>
  request<Raw>({
    path: "/v1/nearby/stores_by_ids",
    query: {
      store_ids: p.store_ids.map(String),
      lat: p.lat,
      lng: p.lng,
      consumer_lat: p.consumer?.lat ?? p.lat,
      consumer_lng: p.consumer?.lng ?? p.lng,
      is_pickup_map: p.is_pickup_map ?? false,
    },
    ttl: TTL.search,
  });

/** Requires district_id, which no endpoint returns. Not used by the CLI/MCP in v1. */
export const suggestedSearches = (p: LatLng & { district_id: Id; page?: string }) =>
  request<Raw>({ path: "/v1/search/suggested_searches/", query: { ...p }, ttl: TTL.page });

/** Requires district_id and submarket_id, which no endpoint returns. Not used by the CLI/MCP in v1. */
export const browseList = (
  p: LatLng & { district_id: Id; submarket_id: Id; cursor?: string; vertical_ids?: string; business_id?: Id; consumer_id?: Id },
) => request<Raw>({ path: "/v1/browse/list", query: { ...p }, ttl: TTL.page });

// ── Restaurants ────────────────────────────────────────────────────────────

export const storePage = (storeId: Id) =>
  request<Raw>({ path: "/v2/stores/{store_id}/", pathParams: { store_id: storeId }, ttl: TTL.page });

export const chefStorePage = (storeId: Id) =>
  request<Raw>({ path: "/v1/chef/stores/{store_id}", pathParams: { store_id: storeId }, ttl: TTL.page });

export const menuItem = (p: {
  item_id: Id;
  store_id: Id;
  fulfillment_type?: string;
  language?: string;
  consumer_id?: Id;
  submarket_id?: Id;
  scheduled_min_time_utc?: string;
  scheduled_max_time_utc?: string;
  cursor?: string;
}) =>
  request<Raw>({
    path: "/v2/items/{item_id}",
    pathParams: { item_id: p.item_id },
    query: {
      store_id: p.store_id,
      fulfillment_type: p.fulfillment_type ?? "delivery",
      consumer_id: p.consumer_id,
      submarket_id: p.submarket_id,
      scheduled_min_time_utc: p.scheduled_min_time_utc,
      scheduled_max_time_utc: p.scheduled_max_time_utc,
      cursor: p.cursor,
    },
    headers: { "X-DD-MENU-LANGUAGE": p.language },
    ttl: TTL.page,
  });

// ── Grocery & convenience stores ───────────────────────────────────────────

export const convenienceHome = (storeId: Id, p: Locality & { cursor?: string } = {}) =>
  request<Raw>({ path: "/v1/convenience/stores/{storeId}/home", pathParams: { storeId }, query: { ...p }, ttl: TTL.page });

export const navigation = (p: Locality & { store_id: Id; surface?: "aisles" | "categories" | "deals" }) =>
  request<Raw>({
    path: "/v2/retail/navigation_l1s",
    query: { ...p, surface: p.surface ?? "aisles" },
    ttl: TTL.page,
  });

export const collectionPage = (
  p: Locality & {
    collection_id: string;
    store_id?: Id;
    cursor?: string;
    search_query?: string;
    collection_type?: string;
    show_categories?: boolean;
    supports_pagination?: boolean;
    aggregate_store_ids?: Id[];
  },
) =>
  request<Raw>({
    path: "/v2/retail/collection_page",
    query: {
      ...p,
      supports_pagination: p.supports_pagination ?? true,
      aggregate_store_ids: p.aggregate_store_ids?.map(String),
    },
    ttl: TTL.page,
  });

// ── Products ───────────────────────────────────────────────────────────────

export const productSearch = (storeId: Id, q: string, disableSpellCheck = false) =>
  request<Raw>({
    path: "/v2/retail/stores/{storeId}/substitution_search",
    pathParams: { storeId },
    query: { q, disable_spell_check: disableSpellCheck || undefined },
    ttl: TTL.search,
  });

export const productSearchAutocomplete = (storeId: Id, q: string) =>
  request<Raw>({
    path: "/v2/retail/stores/{storeId}/substitution_search_autocomplete",
    pathParams: { storeId },
    query: { q },
    ttl: TTL.search,
  });

export const convenienceProduct = (storeId: Id, productId: Id, p: { ms_id?: string; aggregate_store_ids?: Id[] } = {}) =>
  request<Raw>({
    path: "/v1/convenience/stores/{storeId}/products/{productId}",
    pathParams: { storeId, productId },
    query: { ms_id: p.ms_id, aggregate_store_ids: p.aggregate_store_ids?.map(String) },
    ttl: TTL.page,
  });

export const merchantProduct = (businessId: Id, itemMsId: string) =>
  request<Raw>({
    path: "/v1/browse/merchants/{businessId}/products/{itemMsId}",
    pathParams: { businessId, itemMsId },
    ttl: TTL.page,
  });

export const universalProduct = (ddSic: string, p: Locality & { store_id?: Id; business_id?: Id; ms_id?: string } = {}) =>
  request<Raw>({ path: "/v1/browse/universal/products/{dd_sic}", pathParams: { dd_sic: ddSic }, query: { ...p }, ttl: TTL.page });

/** Requires consumer_id, which no endpoint returns. Not used by the CLI/MCP in v1. */
export const sponsoredProduct = (
  productId: Id,
  p: LatLng & { consumer_id: Id; preferred_store_id?: Id; ms_id?: string; district_id?: Id; submarket_id?: Id },
) =>
  request<Raw>({ path: "/v1/convenience/ad/products/{productId}", pathParams: { productId }, query: { ...p }, ttl: TTL.page });

// ── Ratings & reviews ──────────────────────────────────────────────────────

export const storeReviews = (storeId: Id, p: { limit?: number; offset?: number } = {}) =>
  request<Raw>({ path: "/v1/ratings/page", query: { target: `store_${storeId}`, ...p }, ttl: TTL.reviews });

export const reviewDetails = (uuids: string[]) =>
  request<Raw>({ path: "/v1/ratings/details", query: { consumerReviewUuids: uuids }, ttl: TTL.reviews });

export const itemReviews = (storeId: Id, itemId: Id) =>
  request<Raw>({ path: "/v1/ratings/consumer_reviews_for_items", query: { store_id: storeId, item_id: itemId }, ttl: TTL.reviews });
