import { startTransition, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { CATEGORY_ORDER } from "../data/assets";
import type { AssetCategory, AssetMeta, MarketQuoteMap } from "../types";
import { formatCompactCurrency, formatPercent, formatPrice } from "../lib/format";

interface AssetTableProps {
  assets: AssetMeta[];
  holdings: Record<string, number>;
  manualPrices: Record<string, number>;
  quotes: MarketQuoteMap;
  selectedAssetId: string;
  selectedCategory: AssetCategory | "All";
  search: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: AssetCategory | "All") => void;
  onAssetSelect: (assetId: string) => void;
  onQuantityChange: (assetId: string, rawValue: string) => void;
  onManualPriceChange: (assetId: string, rawValue: string) => void;
}

function isDecimalDraft(value: string) {
  return /^\d*(?:[.,]\d*)?$/.test(value);
}

function normalizeDecimalDraft(value: string) {
  return value.replace(",", ".");
}

function formatInputValue(value: number | undefined, fractionDigits?: number) {
  if (!value || !Number.isFinite(value)) {
    return "";
  }

  if (typeof fractionDigits === "number") {
    return value.toFixed(fractionDigits);
  }

  return String(value);
}

function syncDrafts(
  current: Record<string, string>,
  nextValues: Record<string, number>,
  fractionDigits?: number,
) {
  let changed = false;
  const nextDrafts = { ...current };

  for (const [key, draft] of Object.entries(current)) {
    const normalized = normalizeDecimalDraft(draft);
    const persistedValue = nextValues[key] ?? 0;

    if (normalized === "." || normalized === "") {
      if (normalized === "" && persistedValue === 0) {
        continue;
      }
      if (normalized === ".") {
        continue;
      }
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed !== persistedValue) {
      nextDrafts[key] = formatInputValue(persistedValue, fractionDigits);
      changed = true;
    }
  }

  return changed ? nextDrafts : current;
}

export function AssetTable({
  assets,
  holdings,
  manualPrices,
  quotes,
  selectedAssetId,
  selectedCategory,
  search,
  onSearchChange,
  onCategoryChange,
  onAssetSelect,
  onQuantityChange,
  onManualPriceChange,
}: AssetTableProps) {
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [manualPriceDrafts, setManualPriceDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setQuantityDrafts((current) => syncDrafts(current, holdings, 8));
  }, [holdings]);

  useEffect(() => {
    setManualPriceDrafts((current) => syncDrafts(current, manualPrices));
  }, [manualPrices]);

  function handleDraftChange(
    assetId: string,
    rawValue: string,
    setDrafts: Dispatch<SetStateAction<Record<string, string>>>,
    onValueChange: (assetId: string, rawValue: string) => void,
  ) {
    if (!isDecimalDraft(rawValue)) {
      return;
    }

    setDrafts((current) => ({
      ...current,
      [assetId]: rawValue,
    }));

    const normalized = normalizeDecimalDraft(rawValue);
    if (normalized === "") {
      onValueChange(assetId, "");
      return;
    }

    if (normalized === ".") {
      return;
    }

    onValueChange(assetId, normalized);
  }

  function handleDraftBlur(
    assetId: string,
    persistedValue: number,
    setDrafts: Dispatch<SetStateAction<Record<string, string>>>,
    fractionDigits?: number,
  ) {
    setDrafts((current) => ({
      ...current,
      [assetId]: formatInputValue(persistedValue, fractionDigits),
    }));
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Market universe</p>
          <h2>Watchlist and wallet inputs</h2>
        </div>
        <div className="panel-stat">
          <span>{assets.length}</span>
          <small>tracked assets</small>
        </div>
      </div>

      <div className="filter-grid">
        <label className="field">
          <span>Search</span>
          <input
            value={search}
            onChange={(event) => {
              startTransition(() => onSearchChange(event.target.value));
            }}
            placeholder="BTC, DeFi, HSH..."
          />
        </label>

        <label className="field">
          <span>Category</span>
          <select
            value={selectedCategory}
            onChange={(event) => onCategoryChange(event.target.value as AssetCategory | "All")}
          >
            {CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="asset-list">
        {assets.map((asset) => {
          const quote = quotes[asset.id];
          const quantity = holdings[asset.id] ?? 0;
          const hasPrice = typeof quote?.price === "number" && Number.isFinite(quote.price);
          const hasChange = typeof quote?.change24h === "number" && Number.isFinite(quote.change24h);
          const positionValue = hasPrice ? quantity * quote!.price : 0;
          const isManual = asset.priceMode === "manual";

          return (
            <button
              key={asset.id}
              type="button"
              className={`asset-row ${selectedAssetId === asset.id ? "selected" : ""}`}
              onClick={() => onAssetSelect(asset.id)}
            >
              <div className="asset-meta">
                <div className="asset-symbol-line">
                  <strong>{asset.symbol}</strong>
                  <span>{asset.name}</span>
                </div>
                <div className="tag-row">
                  {asset.categories.map((category) => (
                    <span key={category} className="tag">
                      {category}
                    </span>
                  ))}
                  {isManual ? <span className="tag manual-tag">Manual price</span> : null}
                </div>
              </div>

              <div className="asset-cell">
                <small>Price</small>
                <strong>{hasPrice ? formatPrice(quote?.price) : "..."}</strong>
              </div>

              <div className="asset-cell">
                <small>24h</small>
                <strong className={hasChange ? (quote!.change24h! >= 0 ? "positive" : "negative") : ""}>
                  {quote ? formatPercent(quote.change24h) : "..."}
                </strong>
              </div>

              <label
                className="asset-qty"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <span>Qty</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quantityDrafts[asset.id] ?? formatInputValue(quantity, 8)}
                  placeholder="0"
                  onChange={(event) =>
                    handleDraftChange(asset.id, event.target.value, setQuantityDrafts, onQuantityChange)
                  }
                  onBlur={() => handleDraftBlur(asset.id, quantity, setQuantityDrafts, 8)}
                />
              </label>

              <div className="asset-controls">
                {isManual ? (
                  <label
                    className="asset-qty"
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <span>Manual USD</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={manualPriceDrafts[asset.id] ?? formatInputValue(manualPrices[asset.id])}
                      placeholder="0"
                      onChange={(event) =>
                        handleDraftChange(asset.id, event.target.value, setManualPriceDrafts, onManualPriceChange)
                      }
                      onBlur={() =>
                        handleDraftBlur(asset.id, manualPrices[asset.id] ?? 0, setManualPriceDrafts)
                      }
                    />
                  </label>
                ) : (
                  <div className="asset-cell align-right">
                    <small>Position</small>
                    <strong>{positionValue > 0 ? formatCompactCurrency(positionValue) : "$0.00"}</strong>
                  </div>
                )}
              </div>

              {isManual ? (
                <div className="asset-cell align-right">
                  <small>Position</small>
                  <strong>{positionValue > 0 ? formatCompactCurrency(positionValue) : "$0.00"}</strong>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
