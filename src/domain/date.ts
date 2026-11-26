const DAY_MS = 86400000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function toIsoDate(date: Date): string {
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

export function addDays(iso: string, days: number): string {
  const parts = iso.split("-").map(Number);
  const timestamp = Date.UTC(parts[0], parts[1] - 1, parts[2]) + days * DAY_MS;
  const date = new Date(timestamp);
  return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
}

export function daysInclusive(start: string, end: string): number {
  const startParts = start.split("-").map(Number);
  const endParts = end.split("-").map(Number);
  const startUtc = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
  const endUtc = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);
  return Math.floor((endUtc - startUtc) / DAY_MS) + 1;
}

export interface Range {
  start: string;
  end: string;
}

export function defaultRange(today: string): Range {
  return { start: addDays(today, -89), end: today };
}

export function previousPeriod(start: string, end: string): Range {
  const length = daysInclusive(start, end);
  const previousEnd = addDays(start, -1);
  return { start: addDays(previousEnd, -(length - 1)), end: previousEnd };
}

export function monthKeysEndingAt(today: string, count: number): string[] {
  const parts = today.split("-").map(Number);
  const baseIndex = parts[0] * 12 + (parts[1] - 1);
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const index = baseIndex - offset;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    keys.push(String(year) + "-" + pad(month));
  }
  return keys;
}

export function monthLabel(month: string): string {
  return month.slice(2, 4) + "/" + month.slice(5, 7);
}

export function monthLabelLong(month: string): string {
  return month.slice(0, 4) + "年" + String(Number(month.slice(5, 7))) + "月";
}
