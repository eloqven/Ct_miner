import { useEffect, useState } from "react";
import { ASSETS } from "../data/assets";
import { SIGNAL_METRIC_OPTIONS } from "../lib/signals";
import type { SignalEvaluation, SignalMetric, SignalRule } from "../types";

interface SignalPanelProps {
  rules: SignalRule[];
  evaluations: SignalEvaluation[];
  selectedAssetId: string;
  onAddRule: (draft: { assetId: string; metric: SignalMetric; threshold: number; notify: boolean }) => void;
  onDeleteRule: (ruleId: string) => void;
  onToggleRule: (ruleId: string, key: "enabled" | "notify") => void;
}

export function SignalPanel({
  rules,
  evaluations,
  selectedAssetId,
  onAddRule,
  onDeleteRule,
  onToggleRule,
}: SignalPanelProps) {
  const [assetId, setAssetId] = useState(selectedAssetId);
  const [metric, setMetric] = useState<SignalMetric>("price_above");
  const [threshold, setThreshold] = useState("0");
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    setAssetId(selectedAssetId);
  }, [selectedAssetId]);

  const activeSignals = evaluations.filter((evaluation) => evaluation.triggered);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Signals</p>
          <h2>Configurable alerts</h2>
        </div>
        <div className="panel-stat">
          <span>{activeSignals.length}</span>
          <small>triggered now</small>
        </div>
      </div>

      <div className="signal-grid">
        <label className="field">
          <span>Asset</span>
          <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
            {ASSETS.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.symbol} · {asset.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Condition</span>
          <select value={metric} onChange={(event) => setMetric(event.target.value as SignalMetric)}>
            {SIGNAL_METRIC_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Threshold</span>
          <input value={threshold} onChange={(event) => setThreshold(event.target.value)} />
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
          <span>Browser notify</span>
        </label>

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            const numericThreshold = Number(threshold);
            if (Number.isNaN(numericThreshold)) {
              return;
            }

            onAddRule({ assetId, metric, threshold: numericThreshold, notify });
            setThreshold("0");
          }}
        >
          Add signal
        </button>
      </div>

      <div className="signal-rule-list">
        {rules.map((rule) => {
          const evaluation = evaluations.find((item) => item.rule.id === rule.id);

          return (
            <div key={rule.id} className={`signal-row ${evaluation?.triggered ? "triggered" : ""}`}>
              <div>
                <strong>{rule.label}</strong>
                <small>{evaluation?.description ?? "Awaiting data"}</small>
              </div>

              <div className="signal-actions">
                <label className="checkbox compact">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => onToggleRule(rule.id, "enabled")}
                  />
                  <span>Enabled</span>
                </label>

                <label className="checkbox compact">
                  <input
                    type="checkbox"
                    checked={rule.notify}
                    onChange={() => onToggleRule(rule.id, "notify")}
                  />
                  <span>Notify</span>
                </label>

                <button type="button" className="ghost-button" onClick={() => onDeleteRule(rule.id)}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        {rules.length === 0 ? (
          <div className="empty-state">No signals yet. Add price, momentum, trend, or position-value rules.</div>
        ) : null}
      </div>
    </section>
  );
}
