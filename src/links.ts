export const API_HOST = "doordash11.p.rapidapi.com";
export const LISTING_URL = `https://rapidapi.com/doordashapi/api/doordash11`;
export const PRICING_URL = `https://rapidapi.com/doordashapi/api/doordash11/pricing`;

export const GET_KEY_HELP = [
  "Get a free DoorDash API key in under a minute:",
  `  1. Open ${LISTING_URL}`,
  "  2. Click Subscribe and choose the free plan",
  "  3. Copy your X-RapidAPI-Key and run: export RAPIDAPI_KEY=<your key>",
].join("\n");

export function storeUrl(storeId: string | number): string {
  return `https://www.doordash.com/store/${storeId}/`;
}
