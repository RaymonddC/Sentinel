// WATCH/MULTI/EXEC wrapper with retry on conflict. Per 02-architecture.md §
// Alert dispatcher and research/10 § Multi-key atomicity.
//
// Usage:
//   await runTx(redis, [key1, key2], async (tx) => {
//     await tx.set(key1, '...');
//     await tx.zAdd(key2, { member, score });
//   });
//
// On WATCH conflict the closure re-runs (default 3 retries). The closure must
// be idempotent — it may execute multiple times before commit succeeds.

import type { RedisClient } from '@devvit/public-api';

export interface TxFailure {
  attempt: number;
  reason: 'conflict' | 'error';
  error?: unknown;
}

export async function runTx(
  redis: RedisClient,
  watchKeys: string[],
  body: (tx: Awaited<ReturnType<RedisClient['watch']>>) => Promise<void>,
  opts: { maxAttempts?: number } = {},
): Promise<{ ok: true } | { ok: false; failure: TxFailure }> {
  const maxAttempts = opts.maxAttempts ?? 3;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let tx: Awaited<ReturnType<RedisClient['watch']>> | null = null;
    try {
      tx = await redis.watch(...watchKeys);
      await tx.multi();
      await body(tx);
      const result = await tx.exec();
      // Devvit's exec returns the queued op results; null/empty indicates abort.
      // Treat any thrown error as a conflict for retry.
      if (Array.isArray(result)) return { ok: true };
      // result is null/undefined → conflict
    } catch (err) {
      lastErr = err;
      try { if (tx) await tx.discard(); } catch {}
      // Retry on any thrown error
    }
  }
  return { ok: false, failure: { attempt: maxAttempts, reason: lastErr ? 'error' : 'conflict', error: lastErr } };
}
