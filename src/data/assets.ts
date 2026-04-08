import type { AssetCategory, AssetMeta, SignalRule } from "../types";

export const BASE_ASSET_ID = "tether";
export const MANUAL_CTC_ID = "cryptotab-ctc";
export const MANUAL_HSH_ID = "hashcoin-hsh";

export const ASSETS: AssetMeta[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", categories: ["Layer 1"], priceMode: "live" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", categories: ["Layer 1", "DeFi"], priceMode: "live" },
  { id: "tether", symbol: "USDT", name: "Tether", categories: ["Stablecoin"], priceMode: "live" },
  { id: "usd-coin", symbol: "USDC", name: "USDC", categories: ["Stablecoin"], priceMode: "live" },
  { id: "solana", symbol: "SOL", name: "Solana", categories: ["Layer 1"], priceMode: "live" },
  { id: "binancecoin", symbol: "BNB", name: "BNB", categories: ["Exchange", "Layer 1"], priceMode: "live" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", categories: ["Infrastructure", "DeFi"], priceMode: "live" },
  { id: "aave", symbol: "AAVE", name: "Aave", categories: ["DeFi"], priceMode: "live" },
  { id: "uniswap", symbol: "UNI", name: "Uniswap", categories: ["DeFi"], priceMode: "live" },
  { id: "lido-dao", symbol: "LDO", name: "Lido DAO", categories: ["DeFi"], priceMode: "live" },
  { id: "arbitrum", symbol: "ARB", name: "Arbitrum", categories: ["Scaling"], priceMode: "live" },
  { id: "optimism", symbol: "OP", name: "Optimism", categories: ["Scaling"], priceMode: "live" },
  { id: "matic-network", symbol: "POL", name: "Polygon", categories: ["Scaling"], priceMode: "live" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", categories: ["Meme"], priceMode: "live" },
  { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu", categories: ["Meme"], priceMode: "live" },
  { id: "pepe", symbol: "PEPE", name: "Pepe", categories: ["Meme"], priceMode: "live" },
  { id: "the-open-network", symbol: "TON", name: "Toncoin", categories: ["Layer 1"], priceMode: "live" },
  { id: "tron", symbol: "TRX", name: "Tron", categories: ["Layer 1"], priceMode: "live" },
  { id: "litecoin", symbol: "LTC", name: "Litecoin", categories: ["Payments"], priceMode: "live" },
  { id: "bitcoin-cash", symbol: "BCH", name: "Bitcoin Cash", categories: ["Payments"], priceMode: "live" },
  { id: "dai", symbol: "DAI", name: "Dai", categories: ["Stablecoin", "DeFi"], priceMode: "live" },
  { id: "wrapped-bitcoin", symbol: "WBTC", name: "Wrapped Bitcoin", categories: ["DeFi"], priceMode: "live" },
  { id: "decentraland", symbol: "MANA", name: "Decentraland", categories: ["Gaming"], priceMode: "live" },
  { id: "the-sandbox", symbol: "SAND", name: "The Sandbox", categories: ["Gaming"], priceMode: "live" },
  { id: "axie-infinity", symbol: "AXS", name: "Axie Infinity", categories: ["Gaming"], priceMode: "live" },
  { id: "apecoin", symbol: "APE", name: "ApeCoin", categories: ["Gaming"], priceMode: "live" },
  { id: "quant", symbol: "QNT", name: "Quant", categories: ["Infrastructure"], priceMode: "live" },
  { id: "chiliz", symbol: "CHZ", name: "Chiliz", categories: ["Infrastructure"], priceMode: "live" },
  {
    id: MANUAL_CTC_ID,
    symbol: "CTC",
    name: "CryptoTab Coin",
    categories: ["Synthetic"],
    priceMode: "manual",
    defaultManualPriceUsd: 1,
    note: "Wallet-specific CryptoTab Coin. Manual input overrides any public ticker ambiguity.",
  },
  {
    id: MANUAL_HSH_ID,
    symbol: "HSH",
    name: "HashCoin",
    categories: ["Synthetic"],
    priceMode: "manual",
    defaultManualPriceUsd: 0.000985,
    note: "Wallet-specific HashCoin. Suggested default is based on CryptoTab/HashCoin public ecosystem pages.",
  },
];

export const CATEGORY_ORDER: Array<AssetCategory | "All"> = [
  "All",
  "Layer 1",
  "DeFi",
  "Scaling",
  "Stablecoin",
  "Infrastructure",
  "Gaming",
  "Meme",
  "Payments",
  "Exchange",
  "Synthetic",
];

export const DEFAULT_HOLDINGS: Record<string, number> = {
  [BASE_ASSET_ID]: 1000,
  [MANUAL_CTC_ID]: 0,
  [MANUAL_HSH_ID]: 0,
};

export const DEFAULT_MANUAL_PRICES: Record<string, number> = {
  [MANUAL_CTC_ID]: 1,
  [MANUAL_HSH_ID]: 0.000985,
};

export const DEFAULT_SIGNAL_RULES: SignalRule[] = [
  {
    id: "btc-volatility-watch",
    label: "BTC 24h > 3%",
    assetId: "bitcoin",
    metric: "change_above",
    threshold: 3,
    enabled: true,
    notify: false,
    createdAt: Date.now(),
  },
  {
    id: "ctc-position-watch",
    label: "CTC position > $200",
    assetId: MANUAL_CTC_ID,
    metric: "position_value_above",
    threshold: 200,
    enabled: true,
    notify: false,
    createdAt: Date.now(),
  },
];

export const ASSET_BY_ID = Object.fromEntries(ASSETS.map((asset) => [asset.id, asset]));
