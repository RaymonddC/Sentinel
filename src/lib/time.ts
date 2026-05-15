export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const BUCKET_MS = 5 * MS_PER_MINUTE;
export const BUCKETS_PER_DAY = (24 * 60) / 5; // 288

export function nowMs(): number {
  return Date.now();
}

export function bucketIndex(timestampMs: number): number {
  return Math.floor(timestampMs / BUCKET_MS);
}

export function ageMs(thenMs: number, nowMsArg = nowMs()): number {
  return nowMsArg - thenMs;
}

export function ageDays(thenMs: number, nowMsArg = nowMs()): number {
  return ageMs(thenMs, nowMsArg) / MS_PER_DAY;
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
