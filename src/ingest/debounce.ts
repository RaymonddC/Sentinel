// KV compare-and-set debounce, per 02-architecture.md § Event ingestion § Debouncing.
// Annotated as approximate — concurrent handlers may race; the 5s budget is a soft floor.

import type { RedisClient } from '@devvit/public-api';
import { k } from '../storage/keys.js';

export const DEBOUNCE_WINDOW_MS = 5_000;
export const DEBOUNCE_TTL_SECONDS = 60;

/**
 * Returns true if engines should evaluate now, false if we are inside the
 * debounce window for this thread. On true, the caller proceeds with engine evaluation.
 */
export async function shouldEvaluate(redis: RedisClient, postId: string, now: number = Date.now()): Promise<boolean> {
  const key = k.threadLastEval(postId);
  const last = await redis.get(key);
  if (last && Number.isFinite(parseInt(last, 10))) {
    if (now - parseInt(last, 10) < DEBOUNCE_WINDOW_MS) return false;
  }
  await redis.set(key, String(now), { expiration: new Date(now + DEBOUNCE_TTL_SECONDS * 1000) });
  return true;
}
