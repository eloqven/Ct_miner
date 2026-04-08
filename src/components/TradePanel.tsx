import { useEffect, useState } from "react";
import { ASSETS, BASE_ASSET_ID } from "../data/assets";
import { formatCurrency, formatPrice } from "../lib/format";
import type { MarketQuoteMap } from "../types";

interface TradePanelProps {
  quotes: MarketQuoteMap;
  selectedAssetId: string;
  baseAssetQuantity: number;
  onExecuteTrade: (draft: { assetId: string; side: "buy" | "sell"; usdAmount: number }) => string | null;
}

export function TradePanel({
  quotes,
  selectedAssetId,
  baseAssetQuantity,
  onExecuteTrade,
}: TradePanelProps) {
  const [assetId, setAssetId] = useState(selectedAssetId);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [usdAmount, setUsdAmount] = useState("25");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setAssetId(selectedAssetId);
  }, [selectedAssetId]);

  const asset = ASSETS.find((candidate) => candidate.id === assetId);
  const quote = quotes[assetId];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Execution sandbox</p>
          <h2>Fee-free trade emulator</h2>
        </div>
      </div>

      <div className="trade-note">
        Trades use {BASE_ASSET_ID === "tether" ? "USDT" : BASE_ASSET_ID} as the cash leg and enforce your stated
        minimum of {formatCurrency(7)} per fill.
      </div>

      <div className="trade-grid">
        <label className="field">
          <span>Asset</span>
          <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
            {ASSETS.filter((candidate) => candidate.id !== BASE_ASSET_ID).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.symbol} · {candidate.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Side</span>
          <select value={side} onChange={(event) => setSide(event.target.value as "buy" | "sell")}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>

        <label className="field">
          <span>Notional (USD)</span>
          <input value={usdAmount} onChange={(event) => setUsdAmount(event.target.value)} />
        </label>
      </div>

      <div className="trade-context">
        <strong>{asset?.symbol ?? "..."}</strong>
        <span>{quote ? formatPrice(quote.price) : "Awaiting price"}</span>
        <span>Cash available: {formatCurrency(baseAssetQuantity)}</span>
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

          const result = onExecuteTrade({ assetId, side, usdAmount: amount });
          setFeedback(result ?? `${side.toUpperCase()} order executed against ${asset?.symbol}.`);
        }}
      >
        Execute trade
      </button>

      {feedback ? <div className="trade-feedback">{feedback}</div> : null}
    </section>
  );
}
