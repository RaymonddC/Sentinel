// Stylometry preprocessing + similarity. Per 04-engine-memory.md § Stylometry.

import { cosineSimilarity, histogramIntersection, jaccard, l2Normalize } from '../../lib/math.js';
import type { StylometryProfile } from '../../types/graph.js';

const FILLER_WORDS = new Set([
  'um', 'uh', 'like', 'tbh', 'ngl', 'lol', 'lmao', 'idk', 'imho', 'imo', 'fr', 'rn', 'btw',
]);

const CONTRACTION_RX = /\b\w+'(?:t|s|d|ll|ve|re|m)\b/gi;

const PUNCT_RX = /[.,!?;]|\.{2,}/g;
const EMOJI_RX = /(?:[☀-➿]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF])(?:️)?/g;

/** Preprocess for trigrams: lowercase, collapse whitespace, strip edges. */
export function preprocessForTrigrams(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function extractTrigrams(text: string): string[] {
  const cleaned = preprocessForTrigrams(text);
  if (cleaned.length < 3) return [];
  const out: string[] = new Array(cleaned.length - 2);
  for (let i = 0; i <= cleaned.length - 3; i++) out[i] = cleaned.substring(i, i + 3);
  return out;
}

export function extractEmojis(text: string): string[] {
  return text.match(EMOJI_RX) ?? [];
}

export function tokenizeWords(text: string): string[] {
  return text.toLowerCase().replace(/[^\w'\s]/g, ' ').split(/\s+/).filter(Boolean);
}

export function countPunctuation(text: string): { period: number; comma: number; exclamation: number; question: number; ellipsis: number; semicolon: number } {
  const out = { period: 0, comma: 0, exclamation: 0, question: 0, ellipsis: 0, semicolon: 0 };
  const matches = text.match(PUNCT_RX) ?? [];
  for (const m of matches) {
    if (m === '.') out.period++;
    else if (m === ',') out.comma++;
    else if (m === '!') out.exclamation++;
    else if (m === '?') out.question++;
    else if (m === ';') out.semicolon++;
    else if (m.startsWith('..')) out.ellipsis++;
  }
  return out;
}

export function emptyStylometry(): StylometryProfile {
  return {
    totalChars: 0,
    totalWords: 0,
    totalSentences: 0,
    punctuation: { period: 0, comma: 0, exclamation: 0, question: 0, ellipsis: 0, semicolon: 0 },
    capitalization: { allCapsWords: 0, sentenceStartLowercase: 0 },
    emojiUsage: {},
    topNgrams: {},
    vocabulary: {},
    contractions: 0,
    filler: 0,
    avgSentenceLength: 0,
    sentenceLengthStddev: 0,
    vocabularyDiversity: 0,
  };
}

/** Apply one comment's contribution to the running stylometry profile (in-place). */
export function updateStylometry(profile: StylometryProfile, text: string): void {
  if (!text) return;
  const chars = text.length;
  profile.totalChars += chars;

  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const prevSentences = profile.totalSentences;
  const newSentences = sentences.length;
  // Running mean/stddev of sentence length, by word count.
  for (const s of sentences) {
    const wlen = s.split(/\s+/).length;
    const n = profile.totalSentences + 1;
    const delta = wlen - profile.avgSentenceLength;
    profile.avgSentenceLength += delta / n;
    profile.sentenceLengthStddev += delta * (wlen - profile.avgSentenceLength);
    profile.totalSentences = n;
  }
  void prevSentences;
  void newSentences;

  // Words / vocabulary
  const words = tokenizeWords(text);
  profile.totalWords += words.length;
  for (const w of words) {
    profile.vocabulary[w] = (profile.vocabulary[w] ?? 0) + 1;
    if (FILLER_WORDS.has(w)) profile.filler++;
  }
  // Vocabulary cap is enforced elsewhere via Vocabulary class on save.

  // Contractions
  const contrs = text.match(CONTRACTION_RX) ?? [];
  profile.contractions += contrs.length;

  // Punctuation
  const p = countPunctuation(text);
  profile.punctuation.period += p.period;
  profile.punctuation.comma += p.comma;
  profile.punctuation.exclamation += p.exclamation;
  profile.punctuation.question += p.question;
  profile.punctuation.ellipsis += p.ellipsis;
  profile.punctuation.semicolon += p.semicolon;

  // Capitalization
  for (const w of text.split(/\s+/)) {
    if (w.length >= 2 && /^[A-Z]+$/.test(w)) profile.capitalization.allCapsWords++;
  }

  // Emojis
  for (const e of extractEmojis(text)) {
    profile.emojiUsage[e] = (profile.emojiUsage[e] ?? 0) + 1;
  }

  // Trigrams — keep only the top-50 by frequency.
  for (const t of extractTrigrams(text)) {
    profile.topNgrams[t] = (profile.topNgrams[t] ?? 0) + 1;
  }
  pruneTopN(profile.topNgrams, 50);

  // Diversity
  const distinct = Object.keys(profile.vocabulary).length;
  profile.vocabularyDiversity = profile.totalWords === 0 ? 0 : distinct / profile.totalWords;
}

function pruneTopN(rec: Record<string, number>, n: number): void {
  const keys = Object.keys(rec);
  if (keys.length <= n) return;
  const sorted = keys.sort((a, b) => rec[b]! - rec[a]!);
  for (let i = n; i < sorted.length; i++) delete rec[sorted[i]!];
}

/** Numeric stylometry vector used for cosine similarity. L2-normalize before cosine. */
function numericVector(p: StylometryProfile): number[] {
  const perK = (n: number) => (p.totalChars === 0 ? 0 : (n / p.totalChars) * 1000);
  const ucapsPerW = p.totalWords === 0 ? 0 : p.capitalization.allCapsWords / p.totalWords;
  return [
    p.avgSentenceLength,
    perK(p.punctuation.period),
    perK(p.punctuation.comma),
    perK(p.punctuation.exclamation),
    perK(p.punctuation.question),
    perK(p.punctuation.ellipsis),
    perK(p.punctuation.semicolon),
    ucapsPerW,
    p.vocabularyDiversity,
    p.totalWords === 0 ? 0 : p.contractions / p.totalWords,
    p.totalWords === 0 ? 0 : p.filler / p.totalWords,
  ];
}

/** Compute stylometry similarity per 04-engine-memory.md. Returns [0, 1]. */
export function stylometrySimilarity(a: StylometryProfile, b: StylometryProfile): number {
  const va = l2Normalize(numericVector(a));
  const vb = l2Normalize(numericVector(b));
  const num = cosineSimilarity(va, vb);

  const ng = jaccard(Object.keys(a.topNgrams), Object.keys(b.topNgrams));

  const emA = normalizeCountRecord(a.emojiUsage);
  const emB = normalizeCountRecord(b.emojiUsage);
  // Align emoji vectors over union of keys.
  const keys = new Set([...Object.keys(emA), ...Object.keys(emB)]);
  const va2: number[] = [];
  const vb2: number[] = [];
  for (const k of keys) {
    va2.push(emA[k] ?? 0);
    vb2.push(emB[k] ?? 0);
  }
  const em = histogramIntersection(va2, vb2);

  return clamp01(num * 0.30 + ng * 0.55 + em * 0.15);
}

function normalizeCountRecord(rec: Record<string, number>): Record<string, number> {
  let total = 0;
  for (const v of Object.values(rec)) total += v;
  if (total === 0) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = v / total;
  return out;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
