import { ASSET_BY_ID } from "../data/assets";
import { formatCompactCurrency, formatCurrency, formatPrice, formatQuantity } from "../lib/format";
import { MiniLineChart } from "./MiniLineChart";

interface PortfolioPanelProps {
  totalValue: number;
  cashValue: number;
  investedValue: number;
  history: number[];
  positions: Array<{
    assetId: string;
    price: number | null;
    value: number;
    quantity: number;
  }>;
}

export function PortfolioPanel({
  totalValue,
  cashValue,
  investedValue,
  history,
  positions,
}: PortfolioPanelProps) {
  const topPositions = positions.slice(0, 5);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h2>Wallet exposure</h2>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <small>Total value</small>
          <strong>{formatCompactCurrency(totalValue)}</strong>
        </div>
        <div className="summary-card">
          <small>Cash leg</small>
          <strong>{formatCompactCurrency(cashValue)}</strong>
        </div>
        <div className="summary-card">
          <small>Invested</small>
          <strong>{formatCompactCurrency(investedValue)}</strong>
        </div>
      </div>

      <MiniLineChart values={history} />

      <div className="position-list">
        {topPositions.length === 0 ? (
          <div className="empty-state">Enter wallet quantities to see position sizing and cached portfolio history.</div>
        ) : (
          topPositions.map((position) => {
            const asset = ASSET_BY_ID[position.assetId];
            return (
              <div key={position.assetId} className="position-row">
                <div>
                  <strong>{asset?.symbol ?? position.assetId}</strong>
                  <small>
                    {formatQuantity(position.quantity)} @ {formatPrice(position.price)}
                  </small>
                </div>
                <strong>{formatCurrency(position.value)}</strong>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
