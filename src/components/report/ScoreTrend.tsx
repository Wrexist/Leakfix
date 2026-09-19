import { scoreBand, type ScoreBand } from "@/lib/scan/score";

export interface TrendPoint {
  score: number | null;
  label: string;
}

const BAND_COLOR: Record<ScoreBand, string> = {
  good: "#0f7a56",
  fair: "#b45309",
  poor: "#c0272d",
};

export function ScoreTrend({
  points,
  width = 168,
  height = 46,
  className,
}: {
  points: TrendPoint[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const series = points
    .map((point, index) => ({ ...point, index }))
    .filter((point): point is TrendPoint & { index: number; score: number } => point.score != null);

  if (series.length < 2) return null;

  const pad = 4;
  const values = series.map((point) => point.score);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const x = (position: number) => pad + (position / (series.length - 1)) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);

  const line = series.map((point, position) => `${x(position)},${y(point.score)}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const last = series[series.length - 1];
  const color = BAND_COLOR[scoreBand(last.score)];
  const first = series[0];
  const direction = last.score - first.score;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Score trend across ${series.length} scans, from ${first.score} to ${last.score} (${
        direction > 0 ? "up" : direction < 0 ? "down" : "flat"
      }).`}
    >
      <polygon points={area} fill={color} fillOpacity={0.12} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(series.length - 1)} cy={y(last.score)} r={3} fill={color} />
    </svg>
  );
}
