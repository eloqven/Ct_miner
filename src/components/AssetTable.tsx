import { startTransition } from "react";
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
          const positionValue = quote ? quantity * quote.price : 0;
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
                <strong>{quote ? formatPrice(quote.price) : "..."}</strong>
              </div>

              <div className="asset-cell">
                <small>24h</small>
                <strong className={quote && (quote.change24h ?? 0) >= 0 ? "positive" : "negative"}>
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
                  type="number"
                  step="any"
                  min="0"
                  value={quantity === 0 ? "" : quantity}
                  placeholder="0"
                  onChange={(event) => onQuantityChange(asset.id, event.target.value)}
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
                      type="number"
                      step="any"
                      min="0"
                      value={manualPrices[asset.id] ?? ""}
                      placeholder="0"
                      onChange={(event) => onManualPriceChange(asset.id, event.target.value)}
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
