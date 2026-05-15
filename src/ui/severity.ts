import type { Severity } from '../types/graph.js';
import { COLOR } from './tokens.js';

export interface SeverityCfg {
  color: string;
  label: string;
  tintBg: string;
  ringColor: string;
}

export function severityConfig(s: Severity): SeverityCfg {
  switch (s) {
    case 'critical':
      return { color: COLOR.sevCritical, label: 'CRITICAL', tintBg: 'rgba(231,76,60,0.10)', ringColor: 'rgba(231,76,60,0.32)' };
    case 'high':
      return { color: COLOR.sevHigh, label: 'HIGH', tintBg: 'rgba(243,156,18,0.10)', ringColor: 'rgba(243,156,18,0.32)' };
    case 'medium':
      return { color: COLOR.sevMedium, label: 'MEDIUM', tintBg: 'rgba(245,176,65,0.08)', ringColor: 'rgba(245,176,65,0.28)' };
    case 'healthy':
      return { color: COLOR.sevHealthy, label: 'HEALTHY', tintBg: 'rgba(70,169,115,0.10)', ringColor: 'rgba(70,169,115,0.32)' };
    case 'info':
    default:
      return { color: COLOR.fg2, label: 'INFO', tintBg: 'transparent', ringColor: COLOR.border };
  }
}
