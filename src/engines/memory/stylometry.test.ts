import { describe, it, expect } from 'vitest';
import {
  extractTrigrams, preprocessForTrigrams, emptyStylometry,
  updateStylometry, stylometrySimilarity,
} from './stylometry.js';

describe('stylometry', () => {
  it('preprocessForTrigrams lowercases, collapses whitespace, strips edges', () => {
    expect(preprocessForTrigrams('  Hello   World  ')).toBe('hello world');
  });

  it('extractTrigrams produces overlapping 3-char windows', () => {
    const t = extractTrigrams('abcd');
    expect(t).toEqual(['abc', 'bcd']);
  });

  it('extractTrigrams returns [] for short strings', () => {
    expect(extractTrigrams('ab')).toEqual([]);
  });

  it('similarity is high for identical text', () => {
    const a = emptyStylometry();
    const b = emptyStylometry();
    const sample = 'tbh i dont even know why people bother lol';
    for (let i = 0; i < 10; i++) {
      updateStylometry(a, sample);
      updateStylometry(b, sample);
    }
    expect(stylometrySimilarity(a, b)).toBeGreaterThan(0.85);
  });

  it('similarity is low for stylistically different text', () => {
    const a = emptyStylometry();
    const b = emptyStylometry();
    for (let i = 0; i < 20; i++) {
      updateStylometry(a, 'a quick brown fox jumps over the lazy dog');
      updateStylometry(b, 'zzz qqq xxx www vvv uuu ttt sss rrr');
    }
    expect(stylometrySimilarity(a, b)).toBeLessThan(0.4);
  });

  it('similarity is bounded [0,1]', () => {
    const a = emptyStylometry();
    const b = emptyStylometry();
    updateStylometry(a, 'tbh lol idk');
    updateStylometry(b, 'TBH LOL IDK');
    const s = stylometrySimilarity(a, b);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
