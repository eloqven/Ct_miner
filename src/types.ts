export type AssetCategory =
  | "Layer 1"
  | "DeFi"
  | "Stablecoin"
  | "Meme"
  | "Gaming"
  | "Infrastructure"
  | "Payments"
  | "Exchange"
  | "Scaling"
  | "Synthetic";

export type AssetPriceMode = "live" | "manual" | "hybrid";

export interface AssetMeta {
  id: string;
  symbol: string;
  name: string;
  categories: AssetCategory[];
  priceMode: AssetPriceMode;
  defaultManualPriceUsd?: number;
  note?: string;
}

export interface MarketQuote {
  assetId: string;
  price: number;
  change24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  lastUpdated: string | null;
  source: "live" | "manual";
}

export type MarketQuoteMap = Record<string, MarketQuote>;

export interface MarketSnapshotRecord {
  id: string;
  timestamp: number;
  quotes: MarketQuoteMap;
}

export type HistoryRange = "1D" | "7D" | "30D";

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartCacheEntry {
  key: string;
  assetId: string;
  range: HistoryRange;
  updatedAt: number;
  candles: CandlePoint[];
}

export type SignalMetric =
  | "price_above"
  | "price_below"
  | "change_above"
  | "change_below"
  | "position_value_above"
  | "position_value_below"
  | "sma20_above_sma50"
  | "rsi_above"
  | "rsi_below";

export interface SignalRule {
  id: string;
  label: string;
  assetId: string;
  metric: SignalMetric;
  threshold: number;
  enabled: boolean;
  notify: boolean;
  createdAt: number;
}

export interface SignalEvaluation {
  rule: SignalRule;
  triggered: boolean;
  currentValue: number;
  description: string;
}

export interface WalletStatementTransaction {
  id: string;
  rowNumber: number;
  coinName: string;
  symbol: string;
  amount: number;
  timestamp: string;
  timestampMs: number;
  displayDate: string;
  rawLine: string;
}

export interface WalletStatementSnapshot {
  id: string;
  fileName: string;
  importedAt: number;
  userId: string;
  userName: string;
  transactionCount: number;
  statementTimestamp: number;
  balances: Record<string, number>;
  transactions: WalletStatementTransaction[];
}
