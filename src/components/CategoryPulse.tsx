import { formatPercent } from "../lib/format";

interface CategoryPulseProps {
  entries: Array<{
    category: string;
    averageChange: number;
    assetCount: number;
  }>;
}

export function CategoryPulse({ entries }: CategoryPulseProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Pattern watch</p>
          <h2>Category pulse</h2>
        </div>
      </div>

      <div className="pulse-list">
        {entries.map((entry) => (
          <div key={entry.category} className="pulse-row">
            <div>
              <strong>{entry.category}</strong>
              <small>{entry.assetCount} assets</small>
            </div>
            <strong className={entry.averageChange >= 0 ? "positive" : "negative"}>
              {formatPercent(entry.averageChange)}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
