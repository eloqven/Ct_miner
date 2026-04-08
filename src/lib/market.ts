import { ASSET_BY_ID } from "../data/assets";
import type { AssetMeta, CandlePoint, HistoryRange, MarketQuoteMap } from "../types";
import { groupPricesToCandles } from "./indicators";

const API_BASE = "https://api.coingecko.com/api/v3";

const RANGE_CONFIG: Record<
  HistoryRange,
  { days: number; interval?: "hourly" | "daily"; bucketMs: number; ttlMs: number }
> = {
  "1D": { days: 1, bucketMs: 30 * 60 * 1000, ttlMs: 5 * 60 * 1000 },
  "7D": { days: 7, interval: "hourly", bucketMs: 4 * 60 * 60 * 1000, ttlMs: 20 * 60 * 1000 },
  "30D": { days: 30, interval: "daily", bucketMs: 24 * 60 * 60 * 1000, ttlMs: 90 * 60 * 1000 },
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const suffix = response.status === 429 ? " Rate limit reached." : "";
    throw new Error(`Market request failed with ${response.status}.${suffix}`.trim());
  }

  return response.json() as Promise<T>;
}

export function getLiveAssets(assets: AssetMeta[]) {
  return assets.filter((asset) => asset.priceMode !== "manual");
}

export async function fetchMarketQuotes(assets: AssetMeta[], manualPrices: Record<string, number>) {
  const liveAssets = getLiveAssets(assets);
  const ids = liveAssets.map((asset) => asset.id).join(",");
  const map: MarketQuoteMap = {};

  if (ids.length > 0) {
    const url =
      `${API_BASE}/coins/markets?vs_currency=usd` +
      `&ids=${ids}&order=market_cap_desc&per_page=${liveAssets.length}&page=1` +
      `&sparkline=false&price_change_percentage=24h`;

    const data = await getJson<
      Array<{
        id: string;
        current_price: number;
        price_change_percentage_24h: number | null;
        market_cap: number | null;
        total_volume: number | null;
        last_updated: string | null;
      }>
    >(url);

    for (const item of data) {
      map[item.id] = {
        assetId: item.id,
        price: item.current_price,
        change24h: item.price_change_percentage_24h,
        marketCap: item.market_cap,
        volume24h: item.total_volume,
        lastUpdated: item.last_updated,
        source: "live",
      };
    }
  }

  for (const [assetId, price] of Object.entries(manualPrices)) {
    const asset = ASSET_BY_ID[assetId];
    if (!asset) {
      continue;
    }

    map[assetId] = {
      assetId,
      price,
      change24h: null,
      marketCap: null,
      volume24h: null,
      lastUpdated: new Date().toISOString(),
      source: "manual",
    };
  }

  return map;
}

export function getRangeConfig(range: HistoryRange) {
  return RANGE_CONFIG[range];
}

export async function fetchAssetCandles(assetId: string, range: HistoryRange): Promise<CandlePoint[]> {
  const asset = ASSET_BY_ID[assetId];
  if (!asset || asset.priceMode === "manual") {
    return [];
  }

  const config = RANGE_CONFIG[range];
  const intervalQuery = config.interval ? `&interval=${config.interval}` : "";
  const url =
    `${API_BASE}/coins/${assetId}/market_chart?vs_currency=usd&days=${config.days}${intervalQuery}`;

  const data = await getJson<{ prices: Array<[number, number]> }>(url);
  return groupPricesToCandles(data.prices, config.bucketMs);
}
