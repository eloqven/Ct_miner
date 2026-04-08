import { useEffect, useState } from "react";
import { ASSETS } from "../data/assets";
import { formatCurrency, formatPrice, formatQuantity } from "../lib/format";
import type { MarketQuoteMap } from "../types";

interface TradePanelProps {
  quotes: MarketQuoteMap;
  selectedAssetId: string;
  holdings: Record<string, number>;
  onExecuteTrade: (draft: {
    fromAssetId: string;
    toAssetId: string;
    usdAmount: number;
  }) => string | null;
}

function isDecimalDraft(value: string) {
  return /^\d*(?:[.,]\d*)?$/.test(value);
}

function normalizeDecimalDraft(value: string) {
  return value.replace(",", ".");
}

function formatDraft(value: number | null, fractionDigits = 8) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(fractionDigits) : "";
}

export function TradePanel({
  quotes,
  selectedAssetId,
  holdings,
  onExecuteTrade,
}: TradePanelProps) {
  const [fromAssetId, setFromAssetId] = useState("tether");
  const [toAssetId, setToAssetId] = useState(selectedAssetId);
  const [usdAmount, setUsdAmount] = useState("25.00000000");
  const [fromQuantityInput, setFromQuantityInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setToAssetId(selectedAssetId);
  }, [selectedAssetId]);

  useEffect(() => {
    if (fromAssetId === toAssetId) {
      const fallback = ASSETS.find((candidate) => candidate.id !== toAssetId)?.id ?? "tether";
      setFromAssetId(fallback);
    }
  }, [fromAssetId, toAssetId]);

  const fromAsset = ASSETS.find((candidate) => candidate.id === fromAssetId);
  const toAsset = ASSETS.find((candidate) => candidate.id === toAssetId);
  const fromQuote = quotes[fromAssetId];
  const toQuote = quotes[toAssetId];
  const fromQuantity = holdings[fromAssetId] ?? 0;
  const fromValueUsd = fromQuote ? fromQuantity * fromQuote.price : 0;
  const parsedUsdAmount = Number(normalizeDecimalDraft(usdAmount));
  const parsedFromQuantity = Number(normalizeDecimalDraft(fromQuantityInput));
  const receivedQuantity =
    Number.isFinite(parsedUsdAmount) && parsedUsdAmount > 0 && toQuote?.price
      ? parsedUsdAmount / toQuote.price
      : null;

  function handleSwapPair() {
    setFromAssetId(toAssetId);
    setToAssetId(fromAssetId);
  }

  function syncFromQuantityToUsd(rawValue: string) {
    if (!isDecimalDraft(rawValue)) {
      return;
    }

    setFromQuantityInput(rawValue);
    const normalized = normalizeDecimalDraft(rawValue);
    if (normalized === "" || normalized === ".") {
      setUsdAmount("");
      return;
    }

    const quantityValue = Number(normalized);
    if (!Number.isFinite(quantityValue) || !fromQuote?.price) {
      return;
    }

    setUsdAmount((quantityValue * fromQuote.price).toFixed(8));
  }

  function applyMaxQuantity() {
    const maxQuantity = Number.isFinite(fromQuantity) ? fromQuantity : 0;
    const nextQuantity = maxQuantity.toFixed(8);
    setFromQuantityInput(nextQuantity);

    if (!fromQuote?.price || fromQuote.price <= 0) {
      setUsdAmount("0.00000000");
      return;
    }

    setUsdAmount((maxQuantity * fromQuote.price).toFixed(8));
  }

  function syncUsdToFromQuantity(rawValue: string) {
    if (!isDecimalDraft(rawValue)) {
      return;
    }

    setUsdAmount(rawValue);
    const normalized = normalizeDecimalDraft(rawValue);
    if (normalized === "" || normalized === ".") {
      setFromQuantityInput("");
      return;
    }

    const usdValue = Number(normalized);
    if (!Number.isFinite(usdValue) || !fromQuote?.price || fromQuote.price <= 0) {
      return;
    }

    setFromQuantityInput((usdValue / fromQuote.price).toFixed(8));
  }

  useEffect(() => {
    if (!fromQuote?.price || fromQuote.price <= 0) {
      return;
    }

    const normalized = normalizeDecimalDraft(usdAmount);
    if (normalized === "" || normalized === ".") {
      return;
    }

    const usdValue = Number(normalized);
    if (!Number.isFinite(usdValue)) {
      return;
    }

    setFromQuantityInput((usdValue / fromQuote.price).toFixed(8));
  }, [fromAssetId, fromQuote?.price]);

  useEffect(() => {
    if (!toQuote?.price || toQuote.price <= 0) {
      return;
    }

    if (typeof parsedUsdAmount === "number" && Number.isFinite(parsedUsdAmount) && parsedUsdAmount > 0) {
      return;
    }

    if (typeof parsedFromQuantity === "number" && Number.isFinite(parsedFromQuantity) && parsedFromQuantity > 0 && fromQuote?.price) {
      setUsdAmount((parsedFromQuantity * fromQuote.price).toFixed(8));
    }
  }, [fromQuote?.price, parsedFromQuantity, parsedUsdAmount, toQuote?.price]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Execution sandbox</p>
          <h2>Fee-free swap emulator</h2>
        </div>
      </div>

      <div className="trade-note">
        The emulator now follows your wallet rule: only swaps between listed assets, no fiat buy/sell flow, and a
        minimum notional of {formatCurrency(7)} per swap.
      </div>

      <div className="trade-grid trade-pair-grid">
        <label className="field">
          <span>From</span>
          <select value={fromAssetId} onChange={(event) => setFromAssetId(event.target.value)}>
            {ASSETS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.symbol} - {candidate.name}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="ghost-button swap-pair-button" onClick={handleSwapPair}>
          Swap
        </button>

        <label className="field">
          <span>To</span>
          <select value={toAssetId} onChange={(event) => setToAssetId(event.target.value)}>
            {ASSETS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.symbol} - {candidate.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="trade-grid trade-value-grid">
        <label className="field">
          <span>From qty</span>
          <div className="input-with-action">
            <input
              className="long-input"
              value={fromQuantityInput}
              placeholder="0.00000000"
              inputMode="decimal"
              onChange={(event) => syncFromQuantityToUsd(event.target.value)}
              onBlur={() => setFromQuantityInput(formatDraft(Number(normalizeDecimalDraft(fromQuantityInput))))}
            />
            <button type="button" className="ghost-button input-action-button" onClick={applyMaxQuantity}>
              Max
            </button>
          </div>
        </label>

        <label className="field">
          <span>Notional (USD equivalent)</span>
          <input
            className="long-input"
            value={usdAmount}
            placeholder="0.00000000"
            inputMode="decimal"
            onChange={(event) => syncUsdToFromQuantity(event.target.value)}
            onBlur={() => setUsdAmount(formatDraft(Number(normalizeDecimalDraft(usdAmount))))}
          />
        </label>
      </div>

      <div className="trade-context">
        <strong>
          {fromAsset?.symbol ?? "..."} to {toAsset?.symbol ?? "..."}
        </strong>
        <span>From spot: {fromQuote ? formatPrice(fromQuote.price) : "Awaiting price"}</span>
        <span>To spot: {toQuote ? formatPrice(toQuote.price) : "Awaiting price"}</span>
        <span>
          Available: {formatQuantity(fromQuantity)} {fromAsset?.symbol} ({formatCurrency(fromValueUsd)})
        </span>
        <span>
          Estimated receive: {receivedQuantity !== null ? formatQuantity(receivedQuantity) : "n/a"}{" "}
          {toAsset?.symbol ?? ""}
        </span>
      </div>

      <button
        type="button"
        className="primary-button"
        onClick={() => {
          const amount = Number(usdAmount);
          if (Number.isNaN(amount)) {
            setFeedback("Enter a valid USD amount.");
            return;
          }

          const result = onExecuteTrade({ fromAssetId, toAssetId, usdAmount: amount });
          setFeedback(
            result ??
              `Swap executed: ${fromAsset?.symbol ?? "?"} -> ${toAsset?.symbol ?? "?"} for ${formatCurrency(amount)}.`,
          );
        }}
      >
        Execute swap
      </button>

      {feedback ? <div className="trade-feedback">{feedback}</div> : null}
    </section>
  );
}
