import { describe, it, expect } from 'vitest';
import { scoreText } from './sentiment.js';

describe('sentiment.scoreText', () => {
  it('returns 0 for empty / neutral text', () => {
    expect(scoreText('')).toBe(0);
    expect(scoreText('the table is here')).toBe(0);
  });

  it('positive lexicon words score positively', () => {
    expect(scoreText('this is amazing')).toBeGreaterThan(0.5);
    expect(scoreText('love this so much')).toBeGreaterThan(0.4);
  });

  it('negative lexicon words score negatively', () => {
    expect(scoreText('this is terrible')).toBeLessThan(-0.4);
    expect(scoreText('hate it')).toBeLessThan(-0.4);
  });

  it('emoji extension table contributes', () => {
    expect(scoreText('great 🎉')).toBeGreaterThan(0);
    expect(scoreText('💀💀💀')).toBeLessThan(0);
  });

  it('clamped to [-1, +1]', () => {
    const v = scoreText('amazing wonderful brilliant excellent fantastic');
    expect(v).toBeLessThanOrEqual(1);
    expect(v).toBeGreaterThanOrEqual(-1);
  });

  it('mixed positive and negative cancel', () => {
    const v = scoreText('this is amazing and terrible');
    expect(Math.abs(v)).toBeLessThan(0.5);
  });
});
