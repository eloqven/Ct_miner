import { useDeferredValue, useEffect, useRef, useState } from "react";
import { AssetTable } from "./components/AssetTable";
import { CandlestickChart } from "./components/CandlestickChart";
import { CategoryPulse } from "./components/CategoryPulse";
import { PortfolioPanel } from "./components/PortfolioPanel";
import { SignalPanel } from "./components/SignalPanel";
import { StatementImporter } from "./components/StatementImporter";
import { TradePanel } from "./components/TradePanel";
import {
  ASSETS,
  ASSET_BY_ID,
  ASSET_BY_SYMBOL,
  BASE_ASSET_ID,
  DEFAULT_HOLDINGS,
  DEFAULT_MANUAL_PRICES,
  DEFAULT_SIGNAL_RULES,
} from "./data/assets";
import { usePersistentState } from "./hooks/usePersistentState";
import { formatCompactCurrency, formatCurrency, formatPercent, formatPrice } from "./lib/format";
import { summarizeTrend } from "./lib/indicators";
import { fetchAssetCandles, fetchMarketQuotes, getRangeConfig, mergeManualQuotes } from "./lib/market";
import { evaluateSignals } from "./lib/signals";
import { parseWalletStatementPdf } from "./lib/statementImport";
import { getChartCache, getRecentSnapshots, saveMarketSnapshot, setChartCache } from "./lib/storage";
import type {
  AssetCategory,
  CandlePoint,
  HistoryRange,
  MarketQuoteMap,
  MarketSnapshotRecord,
  SignalMetric,
  SignalRule,
  WalletStatementSnapshot,
} from "./types";

const QUOTE_STORAGE_KEY = "ct-miner-latest-quotes";
const HOLDINGS_STORAGE_KEY = "ct-miner-holdings";
const SIGNALS_STORAGE_KEY = "ct-miner-signals";
const MANUAL_PRICES_STORAGE_KEY = "ct-miner-manual-prices";
const STATEMENT_IMPORTS_STORAGE_KEY = "nc-wallet-tracker-statement-imports";

function readStoredQuotes() {
  try {
    const raw = window.localStorage.getItem(QUOTE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MarketQuoteMap) : {};
  } catch {
    return {};
  }
}

function getValidPrice(price: number | null | undefined) {
  return typeof price === "number" && Number.isFinite(price) ? price : null;
}

function buildSignalLabel(assetId: string, metric: SignalMetric, threshold: number) {
  const asset = ASSET_BY_ID[assetId];
  const label = asset?.symbol ?? assetId;

  switch (metric) {
    case "price_above":
      return `${label} price > ${formatCurrency(threshold)}`;
    case "price_below":
      return `${label} price < ${formatCurrency(threshold)}`;
    case "change_above":
      return `${label} 24h > ${threshold}%`;
    case "change_below":
      return `${label} 24h < ${threshold}%`;
    case "position_value_above":
      return `${label} position > ${formatCurrency(threshold)}`;
    case "position_value_below":
      return `${label} position < ${formatCurrency(threshold)}`;
    case "sma20_above_sma50":
      return `${label} SMA20 > SMA50`;
    case "rsi_above":
      return `${label} RSI > ${threshold}`;
    case "rsi_below":
      return `${label} RSI < ${threshold}`;
  }
}

function App() {
  const [liveQuotes, setLiveQuotes] = useState<MarketQuoteMap>(readStoredQuotes);
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
  const [statementSnapshots, setStatementSnapshots] = usePersistentState<WalletStatementSnapshot[]>(
    STATEMENT_IMPORTS_STORAGE_KEY,
    [],
  );
  const [snapshots, setSnapshots] = useState<MarketSnapshotRecord[]>([]);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [candlesByAsset, setCandlesByAsset] = useState<Record<string, CandlePoint[]>>({});
  const [chartRange, setChartRange] = useState<HistoryRange>("7D");
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [statementImportError, setStatementImportError] = useState<string | null>(null);
  const [statementImporting, setStatementImporting] = useState(false);
  const [notificationsPermission, setNotificationsPermission] = useState<NotificationPermission>(
    typeof Notification === "undefined" ? "denied" : Notification.permission,
  );
  const bootstrappedSignalsRef = useRef(false);
  const previousSignalMapRef = useRef<Record<string, boolean>>({});
  const manualPricesRef = useRef(manualPrices);
  const quotes = mergeManualQuotes(liveQuotes, manualPrices);
  const latestStatement = [...statementSnapshots].sort(
    (left, right) =>
      right.statementTimestamp - left.statementTimestamp || right.importedAt - left.importedAt,
  )[0] ?? null;

  useEffect(() => {
    manualPricesRef.current = manualPrices;
  }, [manualPrices]);

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
    const price = getValidPrice(quote?.price);
    return {
      assetId: asset.id,
      quantity,
      price,
      value: quantity > 0 && price !== null ? quantity * price : 0,
    };
  })
    .filter((position) => position.quantity > 0)
    .sort((left, right) => right.value - left.value);

  const basePrice = getValidPrice(quotes[BASE_ASSET_ID]?.price) ?? 1;
  const cashValue = (holdings[BASE_ASSET_ID] ?? 0) * basePrice;
  const investedValue = portfolioPositions
    .filter((position) => position.assetId !== BASE_ASSET_ID)
    .reduce((total, position) => total + position.value, 0);
  const totalValue = cashValue + investedValue;

  const categoryBuckets = new Map<string, { total: number; count: number }>();
  for (const asset of ASSETS) {
    const quote = quotes[asset.id];
    if (!quote || quote.change24h === null || !Number.isFinite(quote.change24h)) {
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
        const price = getValidPrice(quote?.price);
        if (price === null || quantity === 0) {
          return total;
        }

        return total + quantity * price;
      }, 0),
    )
    .filter((value) => Number.isFinite(value) && value > 0);

  const signalEvaluations = evaluateSignals(signalRules, quotes, holdings, candlesByAsset);
  const manualPriceEntries = Object.entries(manualPrices).filter(([assetId]) => ASSET_BY_ID[assetId]);

  async function importStatementFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setStatementImporting(true);
    setStatementImportError(null);

    try {
      const parsedSnapshots = await Promise.all(Array.from(files).map((file) => parseWalletStatementPdf(file)));

      setStatementSnapshots((current) => {
        const next = [...current];
        for (const snapshot of parsedSnapshots) {
          const existingIndex = next.findIndex((entry) => entry.id === snapshot.id);
          if (existingIndex >= 0) {
            next[existingIndex] = snapshot;
          } else {
            next.push(snapshot);
          }
        }

        return next
          .sort(
            (left, right) =>
              right.statementTimestamp - left.statementTimestamp || right.importedAt - left.importedAt,
          )
          .slice(0, 40);
      });
    } catch (error) {
      setStatementImportError(error instanceof Error ? error.message : "Unable to parse the statement PDF.");
    } finally {
      setStatementImporting(false);
    }
  }

  function applyImportedBalances() {
    if (!latestStatement) {
      return;
    }

    setHoldings((current) => {
      const next = { ...current };

      for (const [symbol, amount] of Object.entries(latestStatement.balances)) {
        const asset = ASSET_BY_SYMBOL[symbol];
        if (!asset) {
          continue;
        }

        next[asset.id] = Number(amount.toFixed(8));
      }

      return next;
    });
  }

  async function loadSnapshots() {
    const recent = await getRecentSnapshots(Date.now() - 7 * 24 * 60 * 60 * 1000);
    setSnapshots(recent);
  }

  async function persistLiveQuotes(nextQuotes: MarketQuoteMap) {
    setLiveQuotes(nextQuotes);
    window.localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(nextQuotes));
  }

  async function refreshMarketData() {
    try {
      const freshQuotes = await fetchMarketQuotes(ASSETS);
      const snapshotQuotes = mergeManualQuotes(freshQuotes, manualPricesRef.current);
      setMarketError(null);
      setLastSyncedAt(Date.now());
      await persistLiveQuotes(freshQuotes);
      await saveMarketSnapshot(snapshotQuotes);
      await loadSnapshots();
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
        new Notification("NC Wallet Tracker signal", {
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

  function executeTrade(draft: { fromAssetId: string; toAssetId: string; usdAmount: number }) {
    if (draft.usdAmount < 7) {
      return "Minimum notional is $7 for the fee-free swap emulator.";
    }

    if (draft.fromAssetId === draft.toAssetId) {
      return "Choose two different assets for the swap.";
    }

    if (!ASSET_BY_ID[draft.fromAssetId] || !ASSET_BY_ID[draft.toAssetId]) {
      return "Both swap assets must exist in the tracked list.";
    }

    const fromQuote = quotes[draft.fromAssetId];
    const toQuote = quotes[draft.toAssetId];
    if (!fromQuote || !toQuote) {
      return "Missing price data for one of the selected assets.";
    }

    if (!Number.isFinite(fromQuote.price) || fromQuote.price <= 0) {
      return "Source asset price must be greater than zero before swapping.";
    }
    if (!Number.isFinite(toQuote.price) || toQuote.price <= 0) {
      return "Target asset price must be greater than zero before swapping.";
    }

    const sourceQuantity = holdings[draft.fromAssetId] ?? 0;
    const sourceValueUsd = sourceQuantity * fromQuote.price;
    if (sourceValueUsd < draft.usdAmount) {
      return `Not enough ${ASSET_BY_ID[draft.fromAssetId].symbol} value to simulate that swap.`;
    }

    const sourceQuantityDelta = draft.usdAmount / fromQuote.price;
    const targetQuantityDelta = draft.usdAmount / toQuote.price;

    setHoldings((current) => {
      const nextSource = Math.max(0, (current[draft.fromAssetId] ?? 0) - sourceQuantityDelta);
      const nextTarget = (current[draft.toAssetId] ?? 0) + targetQuantityDelta;

      return {
        ...current,
        [draft.fromAssetId]: Number(nextSource.toFixed(8)),
        [draft.toAssetId]: Number(nextTarget.toFixed(8)),
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
          <p className="eyebrow">NC Wallet Tracker</p>
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
          <StatementImporter
            latestSnapshot={latestStatement}
            importCount={statementSnapshots.length}
            importing={statementImporting}
            importError={statementImportError}
            onImportFiles={importStatementFiles}
            onApplyBalances={applyImportedBalances}
          />
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
                  {ASSET_BY_ID[selectedAssetId].name} - {ASSET_BY_ID[selectedAssetId].symbol}
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
                <strong
                  className={
                    typeof selectedQuote?.change24h === "number" && Number.isFinite(selectedQuote.change24h)
                      ? selectedQuote.change24h >= 0
                        ? "positive"
                        : "negative"
                      : ""
                  }
                >
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
              {manualPriceEntries.map(([assetId, price]) => (
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
            holdings={holdings}
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
