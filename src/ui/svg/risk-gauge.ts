// Server-side SVG generator for the risk gauge. Returns a data: URL
// passed straight into a Devvit <image> block.

import { COLOR } from '../tokens.js';
import { severityConfig } from '../severity.js';
import type { Severity } from '../../types/graph.js';

export function riskGaugeDataUrl(value: number, severity: Severity, size = 180): string {
  const cfg = severityConfig(severity);
  const v = Math.max(0, Math.min(100, value));
  const stroke = 12;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -210;
  const totalSweep = 240;
  const valueSweep = (v / 100) * totalSweep;

  const polar = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const arc = (sweep: number) => {
    const s = polar(startAngle);
    const e = polar(startAngle + sweep);
    const large = sweep > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 0.85)}" viewBox="0 0 ${size} ${Math.round(size * 0.92)}">`,
    `<path d="${arc(totalSweep)}" stroke="${COLOR.border}" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>`,
    `<path d="${arc(valueSweep)}" stroke="${cfg.color}" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>`,
    `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="sans-serif" font-size="36" font-weight="600" fill="${COLOR.fg0}">${Math.round(v)}</text>`,
    `<text x="${cx}" y="${cy + 24}" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="600" fill="${cfg.color}" letter-spacing="0.08em">${cfg.label}</text>`,
    `</svg>`,
  ].join('');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
