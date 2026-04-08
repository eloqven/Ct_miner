interface MiniLineChartProps {
  values: number[];
}

export function MiniLineChart({ values }: MiniLineChartProps) {
  if (values.length < 2) {
    return <div className="mini-line-placeholder">History builds as fresh snapshots are cached.</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 320;
  const height = 88;
  const range = max - min || 1;

  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="mini-line-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={path} />
    </svg>
  );
}
