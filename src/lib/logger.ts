// Structured logging for Sentinel. Provides consistent console output and
// optional audit-log persistence for warn/error events.
//
// Console output is single-line, grep-friendly:
//   [sentinel] {level} {scope}: {msg} {JSON.stringify(ctx)} err={err}
//
// Audit log is deduplicated per (scope, msg, hourBucket) so a tight error loop
// won't spam the mod Activity tab.

import type { Ctx } from '../types/ctx.js';
import { appendAuditDeterministic, hasAuditEntry } from '../storage/redis.js';
import type { AuditEntry } from '../types/graph.js';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEvent {
  level: LogLevel;
  scope: string;       // e.g. 'dispatch', 'bootstrap.p1', 'ingest.comment'
  msg: string;         // short human-readable description
  ctx?: Record<string, unknown>;  // structured fields (alertId, userId, etc.)
  err?: unknown;       // original error if any
}

/** Console-format the event consistently for `devvit logs` tail visibility. */
export function logToConsole(ev: LogEvent): void {
  const ctxPart =
    ev.ctx && Object.keys(ev.ctx).length > 0 ? ' ' + JSON.stringify(ev.ctx) : '';
  const errPart =
    ev.err !== undefined
      ? ` err=${ev.err instanceof Error ? ev.err.message : String(ev.err)}`
      : '';
  const line = `[sentinel] ${ev.level} ${ev.scope}: ${ev.msg}${ctxPart}${errPart}`;
  if (ev.level === 'info') {
    console.log(line);
  } else if (ev.level === 'warn') {
    console.warn(line);
  } else {
    console.error(line);
  }
}

/**
 * Persist a warn/error event to the audit log so mods see it in Activity tab.
 * Deduplicated by (scope, msg, hourBucket) — same error within an hour writes
 * only once.
 */
export async function logToAudit(context: Ctx, ev: LogEvent): Promise<void> {
  if (ev.level === 'info') return;

  const now = Date.now();
  const hourBucket = Math.floor(now / 3_600_000);
  const dedupId = `error:${ev.scope}:${ev.msg}:${hourBucket}`;

  const already = await hasAuditEntry(context.redis, dedupId);
  if (already) return;

  const reason =
    ev.ctx && Object.keys(ev.ctx).length > 0
      ? `${ev.msg} ${JSON.stringify(ev.ctx)}`
      : ev.msg;

  const entry: AuditEntry = {
    entryId: dedupId,
    ts: now,
    modUsername: 'sentinel',
    action: `log_${ev.level}:${ev.scope}`,
    target: { type: 'system', id: context.subredditId ?? 'unknown' },
    reason,
    reverted: false,
    revertibleUntil: 0,
  };

  await appendAuditDeterministic(context.redis, entry);
}

/** Convenience: log to console and (for warn/error) the audit log. */
export async function log(context: Ctx, ev: LogEvent): Promise<void> {
  logToConsole(ev);
  await logToAudit(context, ev);
}

/**
 * Wrap a handler function so unhandled top-level throws are caught and logged
 * instead of crashing the Devvit trigger/scheduler runtime.
 */
export function withErrorLog<T extends unknown[]>(
  scope: string,
  fn: (context: Ctx, ...args: T) => Promise<void>,
): (context: Ctx, ...args: T) => Promise<void> {
  return async (context, ...args) => {
    try {
      await fn(context, ...args);
    } catch (err) {
      await log(context, { level: 'error', scope, msg: 'unhandled', err });
    }
  };
}
