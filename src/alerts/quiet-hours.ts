// Quiet-hours check. SubSettings.advanced.quietHours specifies a UTC window
// during which modmail is suppressed. Window can wrap midnight (start=22,end=6).

import type { SubSettings } from '../types/settings.js';

export function withinQuietHours(settings: SubSettings, nowMsArg: number): boolean {
  const q = settings.advanced.quietHours;
  if (!q.enabled) return false;
  const h = new Date(nowMsArg).getUTCHours();
  if (q.startHourUtc === q.endHourUtc) return false;
  if (q.startHourUtc < q.endHourUtc) {
    return h >= q.startHourUtc && h < q.endHourUtc;
  }
  // Wraps midnight.
  return h >= q.startHourUtc || h < q.endHourUtc;
}

export function isExempt(settings: SubSettings, opts: { userName?: string; flair?: string }): boolean {
  if (opts.userName) {
    const exempts = settings.advanced.exemptUsers;
    if (exempts.includes(opts.userName) || exempts.includes(`u/${opts.userName}`)) return true;
  }
  if (opts.flair) {
    if (settings.advanced.exemptFlairs.includes(opts.flair)) return true;
  }
  return false;
}
