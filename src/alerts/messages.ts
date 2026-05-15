// Modmail copy per engine + severity. Concise; numbers lead.

import type { Alert } from '../types/graph.js';

export function engineCopy(alert: Alert): { subject: string; body: string } {
  if (alert.engineName === 'raid_radar') {
    return {
      subject: `[Sentinel] Brigade detected — confidence ${Math.round(alert.confidence * 100)}%`,
      body: `${alert.title}\n\n${alert.evidence}\n\nAlert ID: ${alert.alertId}\nReview in the Sentinel dashboard. Action is reversible within 24h.`,
    };
  }
  if (alert.engineName === 'memory') {
    return {
      subject: `[Sentinel] Possible ban evader — confidence ${Math.round(alert.confidence * 100)}%`,
      body: `${alert.title}\n\n${alert.evidence}\n\nAlert ID: ${alert.alertId}\nReview side-by-side in the Sentinel dashboard before acting.`,
    };
  }
  return {
    subject: `[Sentinel] Thread risk escalating — score ${Math.round(alert.confidence * 100)}`,
    body: `${alert.title}\n\n${alert.evidence}\n\nAlert ID: ${alert.alertId}\nForecast and recommended action in the dashboard.`,
  };
}
