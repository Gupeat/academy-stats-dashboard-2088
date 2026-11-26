import type { Direction, MetricUnit } from "./types";

const countFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });

export function roundTo(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function digitsFor(unit: MetricUnit): number {
  if (unit === "count") return 0;
  if (unit === "percent") return 1;
  return 2;
}

export function formatCount(value: number): string {
  return countFormatter.format(value);
}

export function formatPercentValue(value: number): string {
  return value.toFixed(1) + "%";
}

export function formatScoreValue(value: number): string {
  return value.toFixed(2);
}

export function formatMetricValue(value: number | null, unit: MetricUnit): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (unit === "count") return formatCount(value);
  if (unit === "percent") return formatPercentValue(value);
  return formatScoreValue(value);
}

export function formatDelta(value: number | null, unit: MetricUnit): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "-";
  const absolute = Math.abs(value);
  if (unit === "count") return sign + formatCount(absolute);
  if (unit === "percent") return sign + absolute.toFixed(1) + "pp";
  return sign + absolute.toFixed(2);
}

export function directionOf(value: number | null): Direction {
  if (value === null || !Number.isFinite(value)) return "none";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}
