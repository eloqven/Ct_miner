function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatCurrency(value: number, maximumFractionDigits = 2) {
  if (!isFiniteNumber(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value);
}

export function formatCompactCurrency(value: number) {
  if (!isFiniteNumber(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPrice(value: number | null | undefined) {
  if (!isFiniteNumber(value)) {
    return "n/a";
  }

  if (value >= 1000) {
    return formatCurrency(value, 2);
  }

  if (value >= 1) {
    return formatCurrency(value, 4);
  }

  if (value >= 0.01) {
    return formatCurrency(value, 6);
  }

  return `$${value.toExponential(3)}`;
}

export function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatQuantity(value: number) {
  if (!isFiniteNumber(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8,
  }).format(value);
}
