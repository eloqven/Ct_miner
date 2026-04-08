import { openDB } from "idb";
import type { ChartCacheEntry, HistoryRange, MarketQuoteMap, MarketSnapshotRecord } from "../types";

const DB_NAME = "ct-miner";
const DB_VERSION = 1;
const SNAPSHOT_STORE = "market-snapshots";
const CHART_CACHE_STORE = "chart-cache";
const MAX_SNAPSHOTS = 720;

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(database) {
    if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
      const snapshotStore = database.createObjectStore(SNAPSHOT_STORE, { keyPath: "id" });
      snapshotStore.createIndex("timestamp", "timestamp");
    }

    if (!database.objectStoreNames.contains(CHART_CACHE_STORE)) {
      const chartStore = database.createObjectStore(CHART_CACHE_STORE, { keyPath: "key" });
      chartStore.createIndex("updatedAt", "updatedAt");
    }
  },
});

export async function saveMarketSnapshot(quotes: MarketQuoteMap) {
  const db = await dbPromise;
  const record: MarketSnapshotRecord = {
    id: `${Date.now()}`,
    timestamp: Date.now(),
    quotes,
  };

  await db.put(SNAPSHOT_STORE, record);

  const allSnapshots = await db.getAllFromIndex(SNAPSHOT_STORE, "timestamp");
  if (allSnapshots.length > MAX_SNAPSHOTS) {
    const stale = allSnapshots.slice(0, allSnapshots.length - MAX_SNAPSHOTS) as MarketSnapshotRecord[];
    await Promise.all(stale.map((entry) => db.delete(SNAPSHOT_STORE, entry.id)));
  }
}

export async function getRecentSnapshots(since: number) {
  const db = await dbPromise;
  const range = IDBKeyRange.lowerBound(since);
  return db.getAllFromIndex(SNAPSHOT_STORE, "timestamp", range) as Promise<MarketSnapshotRecord[]>;
}

export async function getChartCache(assetId: string, range: HistoryRange) {
  const db = await dbPromise;
  return db.get(CHART_CACHE_STORE, `${assetId}:${range}`) as Promise<ChartCacheEntry | undefined>;
}

export async function setChartCache(entry: ChartCacheEntry) {
  const db = await dbPromise;
  await db.put(CHART_CACHE_STORE, entry);
}
