import { formatQuantity } from "../lib/format";
import type { WalletStatementSnapshot } from "../types";

interface StatementImporterProps {
  latestSnapshot: WalletStatementSnapshot | null;
  importCount: number;
  importing: boolean;
  importError: string | null;
  onImportFiles: (files: FileList | null) => void;
  onApplyBalances: () => void;
}

export function StatementImporter({
  latestSnapshot,
  importCount,
  importing,
  importError,
  onImportFiles,
  onApplyBalances,
}: StatementImporterProps) {
  const latestTransactions = latestSnapshot?.transactions.slice(0, 5) ?? [];
  const balanceEntries = latestSnapshot
    ? Object.entries(latestSnapshot.balances).sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    : [];

  return (
    <section className="panel statement-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Statement import</p>
          <h2>NC Wallet PDF uploader</h2>
        </div>
        <div className="panel-stat">
          <span>{importCount}</span>
          <small>stored imports</small>
        </div>
      </div>

      <div className="statement-actions">
        <label className="primary-button file-input-button">
          <span>{importing ? "Parsing..." : "Upload statement PDF"}</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) => {
              onImportFiles(event.target.files);
              event.target.value = "";
            }}
            disabled={importing}
          />
        </label>

        <button
          type="button"
          className="ghost-button"
          onClick={onApplyBalances}
          disabled={!latestSnapshot}
        >
          Apply imported balances
        </button>
      </div>

      <div className="statement-note">
        Import daily NC Wallet statement PDFs. Each file is treated as a full wallet-life snapshot, and the latest
        one can populate wallet quantities directly.
      </div>

      {importError ? <div className="banner error">{importError}</div> : null}

      {latestSnapshot ? (
        <div className="statement-grid">
          <div className="summary-card">
            <small>User</small>
            <strong>{latestSnapshot.userName || "Unknown"}</strong>
            <small>{latestSnapshot.userId}</small>
          </div>

          <div className="summary-card">
            <small>Latest statement date</small>
            <strong>{new Date(latestSnapshot.statementTimestamp).toLocaleString()}</strong>
            <small>{latestSnapshot.fileName}</small>
          </div>

          <div className="summary-card">
            <small>Transactions parsed</small>
            <strong>{latestSnapshot.transactionCount}</strong>
            <small>from uploaded statement</small>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          No statement imported yet. Upload the NC Wallet PDF to parse wallet balances and historical transactions.
        </div>
      )}

      {latestSnapshot ? (
        <div className="statement-columns">
          <div className="statement-column">
            <h3>Imported balances</h3>
            <div className="position-list">
              {balanceEntries.map(([symbol, amount]) => (
                <div key={symbol} className="position-row">
                  <div>
                    <strong>{symbol}</strong>
                    <small>Current balance from latest statement</small>
                  </div>
                  <strong>{formatQuantity(amount)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="statement-column">
            <h3>Latest transactions</h3>
            <div className="position-list">
              {latestTransactions.map((transaction) => (
                <div key={transaction.id} className="position-row">
                  <div>
                    <strong>
                      {transaction.symbol} {formatQuantity(transaction.amount)}
                    </strong>
                    <small>{transaction.displayDate} UTC</small>
                  </div>
                  <strong>{transaction.coinName}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
