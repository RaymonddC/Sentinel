import type { SignalSnapshot, ConfidenceBreakdown } from '../../types/signals.js';

export function combineConfidence(signals: SignalSnapshot[]): ConfidenceBreakdown {
  const fired = signals.filter((s) => s.fired);
  const avgStrength = signals.length === 0 ? 0 : signals.reduce((a, s) => a + s.strength, 0) / signals.length;
  if (fired.length < 2) return { firedCount: fired.length, avgStrength, confidence: 0 };
  let factor = 1.0;
  if (fired.length === 2) factor = 0.70;
  else if (fired.length === 3) factor = 0.85;
  return { firedCount: fired.length, avgStrength, confidence: avgStrength * factor };
}
