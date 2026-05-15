// Cheap, monotonic, collision-resistant ids without crypto.randomUUID dependency.
// Format: <prefix>-<base36(ms)>-<base36(rand)>.

const counter = { n: 0 };

function rand(): string {
  counter.n = (counter.n + 1) >>> 0;
  return Math.floor(Math.random() * 1_000_000_000).toString(36) + counter.n.toString(36);
}

export function newAlertId(): string {
  return `A-${Date.now().toString(36)}-${rand()}`;
}

export function newAuditEntryId(): string {
  return `E-${Date.now().toString(36)}-${rand()}`;
}

export function newJobToken(): string {
  return `J-${Date.now().toString(36)}-${rand()}`;
}
