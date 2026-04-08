# NC Wallet Tracker

NC Wallet Tracker is a browser-based crypto workstation built around your actual use case:

- track a hand-picked market universe
- enter exact wallet balances yourself
- keep manual prices for wallet-specific assets like CryptoTab Coin (`CTC`) and HashCoin (`HSH`)
- emulate fee-free trades with a minimum order size
- cache market data over time in the browser
- watch signals, trend structure, and portfolio exposure from one dashboard

## Story

This project started as a simple static crypto page and was reshaped into a trading desk for a specific workflow:

- some assets come from public market feeds
- some assets exist only inside the CryptoTab ecosystem
- wallet values must be editable by hand
- signals need to be practical, not generic

The app is designed around that hybrid model instead of pretending every asset has a clean exchange ticker.

## What The App Does

### Market workspace

- tracks a curated list of coins and token categories
- filters by category and search
- shows spot price, 24h move, and position value
- highlights wallet-specific manual assets separately

### Manual asset model

- `CTC` is treated as **CryptoTab Coin only**
- `HSH` is treated as **HashCoin only**
- both can be priced manually in USD from the dashboard
- manual prices are merged into the rest of the portfolio logic so they work with wallet sizing, trade simulation, and alerts

### Wallet simulation

- enter your exact quantity for each asset
- keep `USDT` as the cash leg
- simulate fee-free buys and sells
- enforce a minimum notional of `$7` per order

### Cached data and analysis

- stores recent market snapshots in IndexedDB
- builds lightweight local portfolio history from those cached snapshots
- renders candlestick charts for public assets
- shows simple structure metrics such as trend bias, SMA20, SMA50, and RSI14

### Signals

Current signal types include:

- price above / below
- 24h change above / below
- position value above / below
- SMA20 above SMA50
- RSI above / below

Signals can also request browser notifications.

## Tech Stack

- Vite
- React
- TypeScript
- IndexedDB via `idb`
- `lightweight-charts`

## Project Structure

```text
src/
  components/   UI panels and charts
  data/         asset definitions and defaults
  hooks/        persistent local state hooks
  lib/          formatting, indicators, market fetch, storage, signals
  App.tsx       main dashboard composition and app state
```

## How To Start The App

From the repo root:

```bash
npm install
npm run dev
```

Vite will print a local URL in the terminal, usually:

```bash
http://localhost:5173
```

Open that in your browser.

## Other Commands

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Notes

- Public market prices come from CoinGecko.
- Manual CryptoTab assets do not depend on public exchange tickers.
- Cached history is local to the browser profile on the machine where you run the app.
- Browser notifications require permission from the browser.

## Next Good Steps

- add more signal families such as EMA crosses, Bollinger squeeze, and breakout detection
- add strategy journaling and trade history
- add backend persistence if you want history to survive beyond one browser/device
- add import/export for wallet state and signal rules
