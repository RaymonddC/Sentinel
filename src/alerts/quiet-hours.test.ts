import { describe, it, expect } from 'vitest';
import { withinQuietHours, isExempt } from './quiet-hours.js';
import { defaultSettings } from '../types/settings.js';

function at(hourUtc: number): number {
  const d = new Date('2026-01-15T00:00:00Z');
  d.setUTCHours(hourUtc);
  return d.getTime();
}

describe('quiet-hours', () => {
  it('disabled → never quiet', () => {
    const s = defaultSettings();
    s.advanced.quietHours = { enabled: false, startHourUtc: 0, endHourUtc: 23 };
    expect(withinQuietHours(s, at(3))).toBe(false);
  });

  it('non-wrapping window: 02:00-06:00 UTC', () => {
    const s = defaultSettings();
    s.advanced.quietHours = { enabled: true, startHourUtc: 2, endHourUtc: 6 };
    expect(withinQuietHours(s, at(1))).toBe(false);
    expect(withinQuietHours(s, at(2))).toBe(true);
    expect(withinQuietHours(s, at(5))).toBe(true);
    expect(withinQuietHours(s, at(6))).toBe(false);
  });

  it('wrapping window: 22:00-07:00 UTC', () => {
    const s = defaultSettings();
    s.advanced.quietHours = { enabled: true, startHourUtc: 22, endHourUtc: 7 };
    expect(withinQuietHours(s, at(23))).toBe(true);
    expect(withinQuietHours(s, at(2))).toBe(true);
    expect(withinQuietHours(s, at(6))).toBe(true);
    expect(withinQuietHours(s, at(7))).toBe(false);
    expect(withinQuietHours(s, at(12))).toBe(false);
  });

  it('isExempt matches with or without u/ prefix', () => {
    const s = defaultSettings();
    s.advanced.exemptUsers = ['AutoModerator', 'u/mod_jane'];
    expect(isExempt(s, { userName: 'AutoModerator' })).toBe(true);
    expect(isExempt(s, { userName: 'mod_jane' })).toBe(true);
    expect(isExempt(s, { userName: 'random' })).toBe(false);
  });

  it('isExempt by flair', () => {
    const s = defaultSettings();
    s.advanced.exemptFlairs = ['Megathread', 'Mod Post'];
    expect(isExempt(s, { flair: 'Megathread' })).toBe(true);
    expect(isExempt(s, { flair: 'Discussion' })).toBe(false);
  });
});
