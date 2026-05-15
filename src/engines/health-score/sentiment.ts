// AFINN-2015-en + emoji extension. Per 05-engine-health-score.md § Sentiment.

import afinnRaw from '../../data/afinn-2015-en.json' with { type: 'json' };
import emojiRaw from '../../data/emoji-sentiment.json' with { type: 'json' };
import { clamp } from '../../lib/math.js';
import { extractEmojis } from '../memory/stylometry.js';

const afinn = afinnRaw as unknown as Record<string, number>;
const emoji = emojiRaw as unknown as Record<string, number>;

/**
 * Score a single comment in [-1, +1].
 * Per spec:
 *   1. lowercase + strip punctuation + tokenize on whitespace
 *   2. look up in combined { ...afinn, ...emoji }; missed tokens contribute 0
 *   3. normalize: scoredSum / (5 * scoredCount), so one strong word can't be diluted
 *      by trailing neutral filler — divide by max-magnitude × hits, not by length
 *   4. clamp to [-1, +1]
 * Returns 0 when no token matched.
 */
export function scoreText(text: string): number {
  if (!text) return 0;
  let scoredSum = 0;
  let scoredCount = 0;

  // Emojis first (they survive punctuation stripping).
  for (const e of extractEmojis(text)) {
    const s = emoji[e];
    if (typeof s === 'number') {
      scoredSum += s;
      scoredCount += 1;
    }
  }

  // Word tokens.
  const tokens = text.toLowerCase().replace(/[^\w'\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const s = afinn[tok];
    if (typeof s === 'number' && tok !== '__notice__') {
      scoredSum += s;
      scoredCount += 1;
    }
  }

  if (scoredCount === 0) return 0;
  return clamp(scoredSum / (5 * scoredCount), -1, 1);
}
