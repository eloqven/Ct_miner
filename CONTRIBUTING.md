# Contributing

## Scope

CT Miner is evolving quickly, so contributions should stay focused on the current product direction:

- crypto market tracking
- wallet-aware portfolio tooling
- manual pricing for CryptoTab-specific assets
- charts, signals, and trading simulation

## Before You Contribute

- check existing issues first
- open an issue for larger feature ideas before building them
- keep changes small and reviewable when possible

## Development

Run locally:

```bash
npm install
npm run dev
```

Build before submitting changes:

```bash
npm run build
```

## Pull Request Guidelines

- keep pull requests focused on one clear change
- explain what changed and why
- mention any tradeoffs or known limitations
- include screenshots if the UI changed materially
- avoid unrelated refactors in the same pull request

## Code Expectations

- prefer clear and maintainable code over clever code
- keep UI behavior predictable
- preserve support for manual-value assets like `CTC` and `HSH`
- do not assume every asset has a reliable public market feed

## Signals And Trading Logic

For work involving signals, simulated trades, or cached historical data:

- explain assumptions clearly
- avoid hidden magic numbers
- document thresholds or heuristics when they matter
- prefer safe fallback behavior over silent invalid state

## Conduct

By participating in this repository, you agree to follow the rules in [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
