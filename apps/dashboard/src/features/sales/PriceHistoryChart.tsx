import { formatMoney } from "../../console/format";
import type { MarketSnapshot } from "../../console/types";
import { EmptyState } from "../../components/ConsoleUi";

export function PriceHistoryChart({ market }: { market: MarketSnapshot }) {
  const history = market.priceHistory;
  if (history.length === 0) {
    return (
      <EmptyState
        title="No settled resale history"
        description="The chart starts after the first verified settled resale for this ticket type."
      />
    );
  }

  const width = 720;
  const height = 220;
  const padding = 24;
  const prices = history.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const priceRange = Math.max(max - min, 1);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const points = history.map((point, index) => {
    const x =
      padding +
      (history.length === 1
        ? usableWidth / 2
        : (index / (history.length - 1)) * usableWidth);
    const y = padding + (1 - (point.price - min) / priceRange) * usableHeight;
    return { ...point, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="price-chart">
      <div className="price-chart-axis">
        <span>{formatMoney(max, market.currency)}</span>
        <span>{formatMoney(min, market.currency)}</span>
      </div>
      <svg
        aria-label="Settled resale price history"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          className="chart-gridline"
          x1={padding}
          x2={width - padding}
          y1={padding}
          y2={padding}
        />
        <line
          className="chart-gridline"
          x1={padding}
          x2={width - padding}
          y1={height / 2}
          y2={height / 2}
        />
        <line
          className="chart-gridline"
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
        />
        <polyline className="chart-line" points={polyline} />
        {points.map((point) => (
          <circle
            key={point.tradeId}
            className="chart-point"
            cx={point.x}
            cy={point.y}
            r="3"
          >
            <title>
              {formatMoney(point.price, market.currency)} ·{" "}
              {new Date(point.createdAt).toLocaleString("en-HK")}
            </title>
          </circle>
        ))}
      </svg>
      <div className="price-chart-footer">
        <span>
          {new Date(history[0].createdAt).toLocaleDateString("en-HK")}
        </span>
        <span>{history.length} settled trades</span>
        <span>
          {new Date(history.at(-1)!.createdAt).toLocaleDateString("en-HK")}
        </span>
      </div>
    </div>
  );
}
