import { useDeferredValue, useEffect, useRef, useState } from "react";
import { AssetTable } from "./components/AssetTable";
import { CandlestickChart } from "./components/CandlestickChart";
import { CategoryPulse } from "./components/CategoryPulse";
import { PortfolioPanel } from "./components/PortfolioPanel";
import { SignalPanel } from "./components/SignalPanel";
import { TradePanel } from "./components/TradePanel";
import {
  ASSETS,
  ASSET_BY_ID,
  BASE_ASSET_ID,
  DEFAULT_HOLDINGS,
  DEFAULT_MANUAL_PRICES,
  DEFAULT_SIGNAL_RULES,
} from "./data/assets";
import { usePersistentState } from "./hooks/usePersistentState";
import { formatCompactCurrency, formatCurrency, formatPercent, formatPrice } from "./lib/format";
import { summarizeTrend } from "./lib/indicators";
import { fetchAssetCandles, fetchMarketQuotes, getRangeConfig } from "./lib/market";
import { evaluateSignals } from "./lib/signals";
import { getChartCache, getRecentSnapshots, saveMarketSnapshot, setChartCache } from "./lib/storage";
import type {
  AssetCategory,
  CandlePoint,
  HistoryRange,
  MarketQuoteMap,
  MarketSnapshotRecord,
  SignalMetric,
  SignalRule,
} from "./types";

const QUOTE_STORAGE_KEY = "ct-miner-latest-quotes";
const HOLDINGS_STORAGE_KEY = "ct-miner-holdings";
const SIGNALS_STORAGE_KEY = "ct-miner-signals";
const MANUAL_PRICES_STORAGE_KEY = "ct-miner-manual-prices";

function readStoredQuotes() {
  try {
    const raw = window.localStorage.getItem(QUOTE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MarketQuoteMap) : {};
  } catch {
    return {};
  }
}

function buildSignalLabel(assetId: string, metric: SignalMetric, threshold: number) {
  const asset = ASSET_BY_ID[assetId];

  switch (metric) {
    case "price_above":
      return `${asset.symbol} price > ${formatCurrency(threshold)}`;
    case "price_below":
      return `${asset.symbol} price < ${formatCurrency(threshold)}`;
    case "change_above":
      return `${asset.symbol} 24h > ${threshold}%`;
    case "change_below":
      return `${asset.symbol} 24h < ${threshold}%`;
    case "position_value_above":
      return `${asset.symbol} position > ${formatCurrency(threshold)}`;
    case "position_value_below":
      return `${asset.symbol} position < ${formatCurrency(threshold)}`;
    case "sma20_above_sma50":
      return `${asset.symbol} SMA20 > SMA50`;
    case "rsi_above":
      return `${asset.symbol} RSI > ${threshold}`;
    case "rsi_below":
      return `${asset.symbol} RSI < ${threshold}`;
  }
}

function App() {
  const [quotes, setQuotes] = useState<MarketQuoteMap>(readStoredQuotes);
  const [selectedAssetId, setSelectedAssetId] = useState("bitcoin");
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | "All">("All");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [holdings, setHoldings] = usePersistentState<Record<string, number>>(
    HOLDINGS_STORAGE_KEY,
    DEFAULT_HOLDINGS,
  );
  const [manualPrices, setManualPrices] = usePersistentState<Record<string, number>>(
    MANUAL_PRICES_STORAGE_KEY,
    DEFAULT_MANUAL_PRICES,
  );
  const [signalRules, setSignalRules] = usePersistentState<SignalRule[]>(
    SIGNALS_STORAGE_KEY,
    DEFAULT_SIGNAL_RULES,
  );
  const [snapshots, setSnapshots] = useState<MarketSnapshotRecord[]>([]);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [candlesByAsset, setCandlesByAsset] = useState<Record<string, CandlePoint[]>>({});
  const [chartRange, setChartRange] = useState<HistoryRange>("7D");
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [notificationsPermission, setNotificationsPermission] = useState<NotificationPermission>(
    typeof Notification === "undefined" ? "denied" : Notification.permission,
  );
  const bootstrappedSignalsRef = useRef(false);
  const previousSignalMapRef = useRef<Record<string, boolean>>({});

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredAssets = ASSETS.filter((asset) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      asset.name.toLowerCase().includes(normalizedSearch) ||
      asset.symbol.toLowerCase().includes(normalizedSearch) ||
      asset.categories.some((category) => category.toLowerCase().includes(normalizedSearch));
    const matchesCategory =
      selectedCategory === "All" || asset.categories.includes(selectedCategory as AssetCategory);
    return matchesSearch && matchesCategory;
  });

  const portfolioPositions = ASSETS.map((asset) => {
    const quantity = holdings[asset.id] ?? 0;
    const quote = quotes[asset.id];
    return {
      assetId: asset.id,
      quantity,
      value: quantity > 0 && quote ? quantity * quote.price : 0,
    };
  })
    .filter((position) => position.quantity > 0)
    .sort((left, right) => right.value - left.value);

  const cashValue = (holdings[BASE_ASSET_ID] ?? 0) * (quotes[BASE_ASSET_ID]?.price ?? 1);
  const investedValue = portfolioPositions
    .filter((position) => position.assetId !== BASE_ASSET_ID)
    .reduce((total, position) => total + position.value, 0);
  const totalValue = cashValue + investedValue;

  const categoryBuckets = new Map<string, { total: number; count: number }>();
  for (const asset of ASSETS) {
    const quote = quotes[asset.id];
    if (!quote || quote.change24h === null) {
      continue;
    }

    for (const category of asset.categories) {
      const bucket = categoryBuckets.get(category) ?? { total: 0, count: 0 };
      bucket.total += quote.change24h;
      bucket.count += 1;
      categoryBuckets.set(category, bucket);
    }
  }

  const categoryPulse = Array.from(categoryBuckets.entries())
    .map(([category, bucket]) => ({
      category,
      averageChange: bucket.total / bucket.count,
      assetCount: bucket.count,
    }))
    .sort((left, right) => right.averageChange - left.averageChange);

  const selectedQuote = quotes[selectedAssetId];
  const selectedTrend = summarizeTrend(candles);

  const portfolioHistory = snapshots
    .map((snapshot) =>
      ASSETS.reduce((total, asset) => {
        const quantity = holdings[asset.id] ?? 0;
        const quote = snapshot.quotes[asset.id];
        if (!quote || quantity === 0) {
          return total;
        }

        return total + quantity * quote.price;
      }, 0),
    )
    .filter((value) => Number.isFinite(value) && value > 0);

  const signalEvaluations = evaluateSignals(signalRules, quotes, holdings, candlesByAsset);

  async function loadSnapshots() {
    const recent = await getRecentSnapshots(Date.now() - 7 * 24 * 60 * 60 * 1000);
    setSnapshots(recent);
  }

  async function persistQuotes(nextQuotes: MarketQuoteMap) {
    setQuotes(nextQuotes);
    window.localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(nextQuotes));
    await saveMarketSnapshot(nextQuotes);
    await loadSnapshots();
  }

  async function refreshMarketData() {
    try {
      const freshQuotes = await fetchMarketQuotes(ASSETS, manualPrices);
      setMarketError(null);
      setLastSyncedAt(Date.now());
      await persistQuotes(freshQuotes);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Unable to refresh market data.");
    }
  }

  useEffect(() => {
    void loadSnapshots();
    void refreshMarketData();
    const interval = window.setInterval(() => {
      void refreshMarketData();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (Object.keys(quotes).length === 0) {
      return;
    }

    const mergedQuotes: MarketQuoteMap = { ...quotes };
    for (const [assetId, price] of Object.entries(manualPrices)) {
      mergedQuotes[assetId] = {
        assetId,
        price,
        change24h: null,
        marketCap: null,
        volume24h: null,
        lastUpdated: new Date().toISOString(),
        source: "manual",
      };
    }

    void persistQuotes(mergedQuotes);
  }, [manualPrices]);

  useEffect(() => {
    let active = true;

    async function loadChart() {
      setChartLoading(true);
      setChartError(null);

      const cached = await getChartCache(selectedAssetId, chartRange);
      const cacheAge = cached ? Date.now() - cached.updatedAt : Number.POSITIVE_INFINITY;

      if (cached && active) {
        setCandles(cached.candles);
      }

      if (cached && cacheAge < getRangeConfig(chartRange).ttlMs) {
        if (active) {
          setChartLoading(false);
        }
        return;
      }

      try {
        const freshCandles = await fetchAssetCandles(selectedAssetId, chartRange);
        if (!active) {
          return;
        }

        setCandles(freshCandles);
        setChartLoading(false);
        await setChartCache({
          key: `${selectedAssetId}:${chartRange}`,
          assetId: selectedAssetId,
          range: chartRange,
          updatedAt: Date.now(),
          candles: freshCandles,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setChartLoading(false);
        setChartError(error instanceof Error ? error.message : "Unable to load chart history.");
      }
    }

    void loadChart();

    return () => {
      active = false;
    };
  }, [chartRange, selectedAssetId]);

  useEffect(() => {
    const indicatorAssets = Array.from(
      new Set(
        signalRules
          .filter((rule) => rule.metric === "sma20_above_sma50" || rule.metric === "rsi_above" || rule.metric === "rsi_below")
          .map((rule) => rule.assetId),
      ),
    );

    if (indicatorAssets.length === 0) {
      return;
    }

    let active = true;

    async function loadIndicatorCandles() {
      const updates: Record<string, CandlePoint[]> = {};

      for (const assetId of indicatorAssets) {
        if (candlesByAsset[assetId]) {
          continue;
        }

        try {
          updates[assetId] = await fetchAssetCandles(assetId, "30D");
        } catch {
          updates[assetId] = [];
        }
      }

      if (!active || Object.keys(updates).length === 0) {
        return;
      }

      setCandlesByAsset((current) => ({ ...current, ...updates }));
    }

    void loadIndicatorCandles();

    return () => {
      active = false;
    };
  }, [signalRules, candlesByAsset]);

  useEffect(() => {
    setCandlesByAsset((current) => ({ ...current, [selectedAssetId]: candles }));
  }, [candles, selectedAssetId]);

  useEffect(() => {
    if (!bootstrappedSignalsRef.current) {
      signalEvaluations.forEach((evaluation) => {
        previousSignalMapRef.current[evaluation.rule.id] = evaluation.triggered;
      });
      bootstrappedSignalsRef.current = true;
      return;
    }

    if (typeof Notification === "undefined" || notificationsPermission !== "granted") {
      signalEvaluations.forEach((evaluation) => {
        previousSignalMapRef.current[evaluation.rule.id] = evaluation.triggered;
      });
      return;
    }

    signalEvaluations.forEach((evaluation) => {
      const previous = previousSignalMapRef.current[evaluation.rule.id] ?? false;
      if (evaluation.triggered && !previous && evaluation.rule.notify) {
        new Notification("CT Miner signal", {
          body: evaluation.description,
        });
      }

      previousSignalMapRef.current[evaluation.rule.id] = evaluation.triggered;
    });
  }, [notificationsPermission, signalEvaluations]);

  function updateHolding(assetId: string, rawValue: string) {
    const parsed = rawValue === "" ? 0 : Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }

    setHoldings((current) => ({
      ...current,
      [assetId]: parsed,
    }));
  }

  function updateManualPrice(assetId: string, rawValue: string) {
    const parsed = rawValue === "" ? 0 : Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }

    setManualPrices((current) => ({
      ...current,
      [assetId]: parsed,
    }));
  }

  function requestNotifications() {
    if (typeof Notification === "undefined") {
      setMarketError("This browser does not support desktop notifications.");
      return;
    }

    void Notification.requestPermission().then((permission) => {
      setNotificationsPermission(permission);
    });
  }

  function addSignalRule(draft: {
    assetId: string;
    metric: SignalMetric;
    threshold: number;
    notify: boolean;
  }) {
    const nextRule: SignalRule = {
      id: globalThis.crypto.randomUUID(),
      assetId: draft.assetId,
      metric: draft.metric,
      threshold: draft.threshold,
      enabled: true,
      notify: draft.notify,
      createdAt: Date.now(),
      label: buildSignalLabel(draft.assetId, draft.metric, draft.threshold),
    };

    setSignalRules((current) => [nextRule, ...current]);
  }

  function toggleRule(ruleId: string, key: "enabled" | "notify") {
    setSignalRules((current) =>
      current.map((rule) => (rule.id === ruleId ? { ...rule, [key]: !rule[key] } : rule)),
    );
  }

  function deleteRule(ruleId: string) {
    setSignalRules((current) => current.filter((rule) => rule.id !== ruleId));
  }

  function executeTrade(draft: { assetId: string; side: "buy" | "sell"; usdAmount: number }) {
    if (draft.usdAmount < 7) {
      return "Minimum notional is $7 for the fee-free emulator.";
    }

    const quote = quotes[draft.assetId];
    if (!quote) {
      return "Live price missing for that asset.";
    }

    const basePrice = quotes[BASE_ASSET_ID]?.price ?? 1;
    const baseQuantity = holdings[BASE_ASSET_ID] ?? 0;
    const baseRequired = draft.usdAmount / basePrice;
    const assetQuantityDelta = draft.usdAmount / quote.price;

    if (draft.side === "buy" && baseQuantity < baseRequired) {
      return "Not enough USDT to simulate that buy.";
    }

    const currentAssetQuantity = holdings[draft.assetId] ?? 0;
    if (draft.side === "sell" && currentAssetQuantity * quote.price < draft.usdAmount) {
      return "Not enough asset value to simulate that sell.";
    }

    setHoldings((current) => {
      const nextBase = draft.side === "buy" ? baseQuantity - baseRequired : baseQuantity + baseRequired;
      const nextAsset =
        draft.side === "buy"
          ? currentAssetQuantity + assetQuantityDelta
          : Math.max(0, currentAssetQuantity - assetQuantityDelta);

      return {
        ...current,
        [BASE_ASSET_ID]: Number(nextBase.toFixed(8)),
        [draft.assetId]: Number(nextAsset.toFixed(8)),
      };
    });

    return null;
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">CT Miner</p>
          <h1>Trading desk for wallet emulation, cached market structure, and signal watch.</h1>
          <p className="hero-text">
            The old repo was a single static page. This rebuild turns it into a React workstation with manual
            CryptoTab asset pricing, persistent wallet state, cached history, and a signal engine you can extend.
          </p>
        </div>

        <div className="hero-actions">
          <div className="status-pill">
            <strong>{lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : "Cold start"}</strong>
            <small>last sync</small>
          </div>
          <button type="button" className="ghost-button" onClick={() => void refreshMarketData()}>
            Refresh now
          </button>
          <button type="button" className="primary-button" onClick={requestNotifications}>
            Notifications: {notificationsPermission}
          </button>
        </div>
      </header>

      {marketError ? <div className="banner error">{marketError}</div> : null}

      <div className="dashboard-grid">
        <div className="stack">
          <AssetTable
            assets={filteredAssets}
            holdings={holdings}
            manualPrices={manualPrices}
            quotes={quotes}
            selectedAssetId={selectedAssetId}
            selectedCategory={selectedCategory}
            search={search}
            onSearchChange={setSearch}
            onCategoryChange={setSelectedCategory}
            onAssetSelect={setSelectedAssetId}
            onQuantityChange={updateHolding}
            onManualPriceChange={updateManualPrice}
          />
          <CategoryPulse entries={categoryPulse} />
        </div>

        <div className="stack">
          <section className="panel chart-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Selected asset</p>
                <h2>
                  {ASSET_BY_ID[selectedAssetId].name} · {ASSET_BY_ID[selectedAssetId].symbol}
                </h2>
              </div>
              <div className="range-switcher">
                {(["1D", "7D", "30D"] as HistoryRange[]).map((range) => (
                  <button
                    key={range}
                    type="button"
                    className={`range-button ${chartRange === range ? "active" : ""}`}
                    onClick={() => setChartRange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            <div className="selected-asset-grid">
              <div className="selected-asset-stat">
                <small>Spot</small>
                <strong>{selectedQuote ? formatPrice(selectedQuote.price) : "..."}</strong>
              </div>
              <div className="selected-asset-stat">
                <small>24h</small>
                <strong className={selectedQuote && (selectedQuote.change24h ?? 0) >= 0 ? "positive" : "negative"}>
                  {selectedQuote ? formatPercent(selectedQuote.change24h) : "n/a"}
                </strong>
              </div>
              <div className="selected-asset-stat">
                <small>Source</small>
                <strong>{selectedQuote ? selectedQuote.source : "n/a"}</strong>
              </div>
            </div>

            {chartError ? <div className="banner error">{chartError}</div> : null}
            {chartLoading && candles.length === 0 ? <div className="empty-state">Loading cached history...</div> : null}
            {candles.length > 0 ? (
              <CandlestickChart candles={candles} />
            ) : (
              <div className="empty-state">
                No public candle history for this asset. Manual CryptoTab prices still work for wallet tracking,
                signals, and trade simulation.
              </div>
            )}

            <div className="analysis-grid">
              <div className="analysis-card">
                <small>Trend bias</small>
                <strong>{selectedTrend.bias}</strong>
              </div>
              <div className="analysis-card">
                <small>SMA 20</small>
                <strong>{selectedTrend.sma20 ? formatPrice(selectedTrend.sma20) : "n/a"}</strong>
              </div>
              <div className="analysis-card">
                <small>SMA 50</small>
                <strong>{selectedTrend.sma50 ? formatPrice(selectedTrend.sma50) : "n/a"}</strong>
              </div>
              <div className="analysis-card">
                <small>RSI 14</small>
                <strong>{selectedTrend.rsi14 ? selectedTrend.rsi14.toFixed(1) : "n/a"}</strong>
              </div>
            </div>
          </section>

          <SignalPanel
            rules={signalRules}
            evaluations={signalEvaluations}
            selectedAssetId={selectedAssetId}
            onAddRule={addSignalRule}
            onDeleteRule={deleteRule}
            onToggleRule={toggleRule}
          />
        </div>

        <div className="stack">
          <PortfolioPanel
            totalValue={totalValue}
            cashValue={cashValue}
            investedValue={investedValue}
            history={portfolioHistory}
            positions={portfolioPositions}
          />
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Manual crypto tab values</p>
                <h2>Wallet-specific pricing</h2>
              </div>
            </div>
            <div className="position-list">
              {Object.entries(manualPrices).map(([assetId, price]) => (
                <div key={assetId} className="position-row">
                  <div>
                    <strong>{ASSET_BY_ID[assetId].symbol}</strong>
                    <small>{ASSET_BY_ID[assetId].note}</small>
                  </div>
                  <strong>{formatPrice(price)}</strong>
                </div>
              ))}
            </div>
          </section>
          <TradePanel
            quotes={quotes}
            selectedAssetId={selectedAssetId}
            baseAssetQuantity={holdings[BASE_ASSET_ID] ?? 0}
            onExecuteTrade={executeTrade}
          />
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Desk summary</p>
                <h2>Current posture</h2>
              </div>
            </div>
            <div className="position-list">
              <div className="position-row">
                <div>
                  <strong>Total wallet</strong>
                  <small>Live + manual assets</small>
                </div>
                <strong>{formatCompactCurrency(totalValue)}</strong>
              </div>
              <div className="position-row">
                <div>
                  <strong>Invested slice</strong>
                  <small>All non-USDT positions</small>
                </div>
                <strong>{formatCompactCurrency(investedValue)}</strong>
              </div>
              <div className="position-row">
                <div>
                  <strong>Selected spot</strong>
                  <small>{ASSET_BY_ID[selectedAssetId].symbol}</small>
                </div>
                <strong>{selectedQuote ? formatPrice(selectedQuote.price) : "n/a"}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
