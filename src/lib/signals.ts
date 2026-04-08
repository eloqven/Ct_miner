import { ASSET_BY_ID } from "../data/assets";
import type { CandlePoint, MarketQuoteMap, SignalEvaluation, SignalMetric, SignalRule } from "../types";
import { formatCurrency, formatPercent } from "./format";
import { calculateRsi, calculateSma } from "./indicators";

export const SIGNAL_METRIC_OPTIONS: Array<{ value: SignalMetric; label: string; unit: string }> = [
  { value: "price_above", label: "Price above", unit: "USD" },
  { value: "price_below", label: "Price below", unit: "USD" },
  { value: "change_above", label: "24h change above", unit: "%" },
  { value: "change_below", label: "24h change below", unit: "%" },
  { value: "position_value_above", label: "Position value above", unit: "USD" },
  { value: "position_value_below", label: "Position value below", unit: "USD" },
  { value: "sma20_above_sma50", label: "SMA20 above SMA50", unit: "state" },
  { value: "rsi_above", label: "RSI above", unit: "RSI" },
  { value: "rsi_below", label: "RSI below", unit: "RSI" },
];

export function evaluateSignals(
  rules: SignalRule[],
  quotes: MarketQuoteMap,
  holdings: Record<string, number>,
  candlesByAsset: Record<string, CandlePoint[]>,
) {
  return rules.map<SignalEvaluation>((rule) => {
    const quote = quotes[rule.assetId];
    const quantity = holdings[rule.assetId] ?? 0;
    const positionValue = quote ? quantity * quote.price : 0;
    const candles = candlesByAsset[rule.assetId] ?? [];
    const sma20 = calculateSma(candles, 20);
    const sma50 = calculateSma(candles, 50);
    const rsi14 = calculateRsi(candles, 14);

    let currentValue = 0;
    let triggered = false;

    switch (rule.metric) {
      case "price_above":
        currentValue = quote?.price ?? 0;
        triggered = currentValue >= rule.threshold;
        break;
      case "price_below":
        currentValue = quote?.price ?? 0;
        triggered = currentValue <= rule.threshold;
        break;
      case "change_above":
        currentValue = quote?.change24h ?? 0;
        triggered = currentValue >= rule.threshold;
        break;
      case "change_below":
        currentValue = quote?.change24h ?? 0;
        triggered = currentValue <= rule.threshold;
        break;
      case "position_value_above":
        currentValue = positionValue;
        triggered = currentValue >= rule.threshold;
        break;
      case "position_value_below":
        currentValue = positionValue;
        triggered = currentValue <= rule.threshold;
        break;
      case "sma20_above_sma50":
        currentValue = sma20 && sma50 ? sma20 - sma50 : 0;
        triggered = sma20 !== null && sma50 !== null && sma20 > sma50;
        break;
      case "rsi_above":
        currentValue = rsi14 ?? 0;
        triggered = rsi14 !== null && rsi14 >= rule.threshold;
        break;
      case "rsi_below":
        currentValue = rsi14 ?? 0;
        triggered = rsi14 !== null && rsi14 <= rule.threshold;
        break;
    }

    const asset = ASSET_BY_ID[rule.assetId];
    const currentLabel = formatMetricValue(rule.metric, currentValue);
    const thresholdLabel = formatMetricValue(rule.metric, rule.threshold);

    return {
      rule,
      triggered: rule.enabled && triggered,
      currentValue,
      description: `${asset?.symbol ?? rule.assetId} ${rule.label.toLowerCase()} | current ${currentLabel} vs target ${thresholdLabel}`,
    };
  });
}

function formatMetricValue(metric: SignalMetric, value: number) {
  switch (metric) {
    case "change_above":
    case "change_below":
      return formatPercent(value);
    case "rsi_above":
    case "rsi_below":
      return value.toFixed(2);
    case "sma20_above_sma50":
      return value.toFixed(6);
    default:
      return formatCurrency(value, 2);
  }
}
