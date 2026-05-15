// Server-side SVG generator for the Raid Radar cluster graph. ≤20 nodes,
// fixed 320px height to prevent layout shift.

import { COLOR } from '../tokens.js';
import { severityConfig } from '../severity.js';
import type { Severity } from '../../types/graph.js';

export interface ClusterAccount { userId: string; username: string }

export function clusterGraphDataUrl(
  accounts: ClusterAccount[],
  severity: Severity,
  width = 560,
  height = 320,
): string {
  const cfg = severityConfig(severity);
  const n = Math.min(20, accounts.length);
  const cx = width / 2;
  const cy = height / 2;
  const nodes: Array<{ id: string; x: number; y: number; isTarget: boolean }> = [];
  nodes.push({ id: 'target', x: cx, y: cy, isTarget: true });
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + Math.PI / 6;
    const ring = i % 3 === 0 ? 110 : i % 3 === 1 ? 80 : 95;
    nodes.push({
      id: `u${i}`,
      x: cx + ring * Math.cos(angle),
      y: cy + ring * Math.sin(angle) * 0.7,
      isTarget: false,
    });
  }
  const links: string[] = [];
  for (let i = 0; i < n; i++) links.push(`target-u${i}`);
  for (let i = 0; i < n; i++) links.push(`u${i}-u${(i + 1) % n}`);
  for (let i = 0; i < n; i += 2) links.push(`u${i}-u${(i + 2) % n}`);

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const linkSvg = links.map((pair) => {
    const [a, b] = pair.split('-');
    const na = a !== undefined ? byId.get(a) : undefined;
    const nb = b !== undefined ? byId.get(b) : undefined;
    if (!na || !nb) return '';
    return `<line x1="${na.x.toFixed(1)}" y1="${na.y.toFixed(1)}" x2="${nb.x.toFixed(1)}" y2="${nb.y.toFixed(1)}" stroke="${COLOR.borderStrong}" stroke-width="0.8" opacity="0.85"/>`;
  }).join('');

  const nodeSvg = nodes.map((node) => {
    if (node.isTarget) {
      return `<circle cx="${node.x}" cy="${node.y}" r="10" fill="${COLOR.bgRaised2}" stroke="${COLOR.fg1}" stroke-width="1.5"/>` +
             `<text x="${node.x}" y="${node.y + 22}" text-anchor="middle" font-family="monospace" font-size="10" fill="${COLOR.fg1}">thread</text>`;
    }
    return `<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="4.5" fill="${cfg.color}" stroke="${COLOR.bgCanvas}" stroke-width="1.5"/>`;
  }).join('');

  const overflow = Math.max(0, accounts.length - 20);
  const overflowSvg = overflow > 0
    ? `<text x="${width - 14}" y="${height - 12}" text-anchor="end" font-family="sans-serif" font-size="11" fill="${COLOR.fg2}">+${overflow} more</text>`
    : '';

  const headerSvg = `<text x="${width - 14}" y="20" text-anchor="end" font-family="sans-serif" font-size="11" fill="${COLOR.fg2}">${n} accounts · 1 target</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${COLOR.bgCanvas}" rx="10" ry="10"/>` +
    headerSvg +
    linkSvg +
    nodeSvg +
    overflowSvg +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
