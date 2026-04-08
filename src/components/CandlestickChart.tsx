import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  createChart,
} from "lightweight-charts";
import type { CandlePoint } from "../types";

interface CandlestickChartProps {
  candles: CandlePoint[];
}

export function CandlestickChart({ candles }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 340,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#c8d2df",
        fontFamily: "'IBM Plex Sans', sans-serif",
      },
      grid: {
        horzLines: { color: "rgba(159, 179, 204, 0.12)" },
        vertLines: { color: "rgba(159, 179, 204, 0.08)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "rgba(159, 179, 204, 0.18)",
      },
      timeScale: {
        borderColor: "rgba(159, 179, 204, 0.18)",
        timeVisible: true,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#33d69f",
      downColor: "#ff7b74",
      borderVisible: false,
      wickUpColor: "#33d69f",
      wickDownColor: "#ff7b74",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
      chart.timeScale().fitContent();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) {
      return;
    }

    seriesRef.current.setData(
      candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );
    chartRef.current.timeScale().fitContent();
  }, [candles]);

  return <div className="chart-canvas" ref={containerRef} />;
}
