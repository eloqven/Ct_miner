import type { CandlePoint } from "../types";

export function groupPricesToCandles(prices: Array<[number, number]>, bucketMs: number) {
  const buckets = new Map<number, CandlePoint>();

  for (const [timestamp, price] of prices) {
    const bucket = Math.floor(timestamp / bucketMs) * bucketMs;
    const existing = buckets.get(bucket);

    if (!existing) {
      buckets.set(bucket, {
        time: Math.floor(bucket / 1000),
        open: price,
        high: price,
        low: price,
        close: price,
      });
      continue;
    }

    existing.high = Math.max(existing.high, price);
    existing.low = Math.min(existing.low, price);
    existing.close = price;
  }

  return Array.from(buckets.values()).sort((left, right) => left.time - right.time);
}

export function calculateSma(candles: CandlePoint[], period: number) {
  if (candles.length < period) {
    return null;
  }

  const sample = candles.slice(-period);
  const total = sample.reduce((sum, candle) => sum + candle.close, 0);
  return total / period;
}

export function calculateRsi(candles: CandlePoint[], period = 14) {
  if (candles.length <= period) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let index = candles.length - period; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];
    const delta = current.close - previous.close;

    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

export function summarizeTrend(candles: CandlePoint[]) {
  const latest = candles.length > 0 ? candles[candles.length - 1].close : null;
  const sma20 = calculateSma(candles, 20);
  const sma50 = calculateSma(candles, 50);
  const rsi14 = calculateRsi(candles, 14);

  let bias = "Building";

  if (latest !== null && sma20 !== null && sma50 !== null) {
    if (latest > sma20 && sma20 > sma50) {
      bias = "Bullish structure";
    } else if (latest < sma20 && sma20 < sma50) {
      bias = "Bearish structure";
    } else {
      bias = "Range / transition";
    }
  }

  return {
    latest,
    sma20,
    sma50,
    rsi14,
    bias,
  };
}
