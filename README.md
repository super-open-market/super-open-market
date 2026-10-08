# super-open-market

**DoorDash restaurant and grocery data for AI agents and the terminal.**
Search stores, read full menus and item options, browse grocery aisles, search products inside a store and pull ratings and reviews, all through the [DoorDash API on RapidAPI](https://rapidapi.com/doordashapi/api/doordash11).

Inspired by [open-supermarkets](https://github.com/abracadabra50/open-supermarkets): one interface for people and agents, applied to DoorDash data.

> **Status: early.** The typed API client and test suite are done. The `som` CLI and the MCP server for Claude, Cursor and other agents are in progress (see [Roadmap](#roadmap)).

## Get a free API key

1. Open the [DoorDash API on RapidAPI](https://rapidapi.com/doordashapi/api/doordash11).
2. Click **Subscribe** and choose the free plan.
3. Copy your `X-RapidAPI-Key`.

## Quickstart

```bash
git clone https://github.com/super-open-market/super-open-market.git
cd super-open-market
npm install
cp .env.example .env        # then paste your key into RAPIDAPI_KEY
```

Call the API from TypeScript:

```ts
// example.mts (run with: npx tsx example.mts)
import * as dd from "./src/client/endpoints.js";

const sf = { lat: 37.7749, lng: -122.4194 };

// Find stores
const { results } = await dd.autocomplete({ query: "7-eleven", ...sf });
console.log(results[0].name, results[0].id); // 7-Eleven 1042320

// Read a restaurant menu
const store = await dd.storePage(336663);

// Search products inside a grocery/convenience store
const milk = await dd.productSearch(1042320, "milk");

// Ratings and reviews
const reviews = await dd.storeReviews(336663, { limit: 5 });
```

## What you can do: endpoint coverage

Every endpoint of the API has a typed function in [`src/client/endpoints.ts`](src/client/endpoints.ts).

| Feature | Function | Endpoint |
|---|---|---|
| Address search | `addressAutocomplete` | `GET /v1/addresses/autocomplete` |
| Address details (lat/lng) | `addressDetails` | `GET /v2/addresses/details` |
| Nearby addresses | `addresses` | `GET /v2/addresses` |
| Store and item search | `autocomplete` | `GET /v2/autocomplete/` |
| Places not on DoorDash | `externalStores` | `GET /v1/consumer_external_stores` |
| Store status by IDs | `storesByIds` | `GET /v1/nearby/stores_by_ids` |
| Suggested searches | `suggestedSearches` | `GET /v1/search/suggested_searches/` |
| Stores of a business | `browseList` | `GET /v1/browse/list` |
| Restaurant page and full menu | `storePage` | `GET /v2/stores/{store_id}/` |
| Chef / virtual store page | `chefStorePage` | `GET /v1/chef/stores/{store_id}` |
| Menu item, options and price | `menuItem` | `GET /v2/items/{item_id}` |
| Grocery store home | `convenienceHome` | `GET /v1/convenience/stores/{storeId}/home` |
| Aisles, categories, deals | `navigation` | `GET /v2/retail/navigation_l1s` |
| Collection / aisle page | `collectionPage` | `GET /v2/retail/collection_page` |
| Search products in a store | `productSearch` | `GET /v2/retail/stores/{storeId}/substitution_search` |
| Product search suggestions | `productSearchAutocomplete` | `GET /v2/retail/stores/{storeId}/substitution_search_autocomplete` |
| Product details | `convenienceProduct` | `GET /v1/convenience/stores/{storeId}/products/{productId}` |
| Product by merchant SKU | `merchantProduct` | `GET /v1/browse/merchants/{businessId}/products/{itemMsId}` |
| Universal product page | `universalProduct` | `GET /v1/browse/universal/products/{dd_sic}` |
| Sponsored product | `sponsoredProduct` | `GET /v1/convenience/ad/products/{productId}` |
| Store reviews | `storeReviews` | `GET /v1/ratings/page` |
| Review details | `reviewDetails` | `GET /v1/ratings/details` |
| Reviews mentioning an item | `itemReviews` | `GET /v1/ratings/consumer_reviews_for_items` |

The client also handles:

- **Errors you can act on.** A missing or unsubscribed key prints the steps to get a free one, and a used-up quota links to the plans page.
- **Retries** on rate limits, server errors and network failures, with backoff.
- **Short-lived caching** in `~/.cache/super-open-market`, so repeat lookups don't spend quota. Set `SOM_NO_CACHE=1` to turn it off.
- **Quota tracking** from the `x-ratelimit-*` response headers.

### Tips

- Use `autocomplete` to find stores. `externalStores` returns places that are **not** on DoorDash, and their IDs don't work with the store endpoints.
- `suggestedSearches` and `browseList` need a `district_id`, and `sponsoredProduct` needs a `consumer_id`. No endpoint returns these, so you must supply them yourself.
- Restaurant and grocery pages are large (250 KB to 1.8 MB). Keep only the fields you need before handing results to an LLM.

## Configuration

| Variable | Purpose |
|---|---|
| `RAPIDAPI_KEY` | Your RapidAPI key. Read from the environment, `./.env` or `~/.config/super-open-market/.env` |
| `SOM_NO_CACHE=1` | Disable the response cache |
| `SOM_CONFIG_DIR`, `SOM_CACHE_DIR` | Override the config and cache folders |

Never commit your key: `.env` is already in `.gitignore`.

## Roadmap

- [x] Typed client for all 23 endpoints, retries, cache, friendly errors
- [x] Tests: unit, spec contract, live smoke
- [ ] Compact results for menus, products and reviews, small enough for LLMs
- [ ] `som` CLI: `som search`, `som menu`, `som find`, `som compare`, `som reviews`
- [ ] MCP server for Claude, Cursor and other MCP clients
- [ ] Cross-store price comparison for grocery items
- [ ] Order planner: build a basket, price it from live menus, then open it on DoorDash to check out
- [ ] Copy-paste examples in curl, Python and Node for every endpoint

The API is read-only: it has no cart or checkout endpoints, so this project never places orders.

## Development

```bash
npm test             # unit and contract tests, offline, no API key needed
npm run test:live    # live smoke test, uses about 6 requests of your quota
npm run typecheck
```

## Contributing

Issues and pull requests are welcome. Please never include API keys in code, tests, issues or logs.

## License

MIT
