// Probe: measure scheduler job timeout budget (E-SchedulerTimeout).
//
// Runs a tight counter loop for `targetDurationMs` ms, yielding briefly to the
// event loop every 1000 iterations, then writes an audit entry on completion.
//
// Absence of the audit entry within 5 minutes after scheduling means the job
// was killed before completion → record the target duration at which that first
// occurred and shrink chunk sizes in src/scheduler/backfill-job.ts accordingly.

import type { Ctx } from '../types/ctx.js';
import { appendAuditDeterministic } from '../storage/redis.js';
import type { AuditEntry } from '../types/graph.js';

export async function probeSchedulerTimeout(
  context: Ctx,
  targetDurationMs: number,
): Promise<void> {
  const start = Date.now();
  let iters = 0;

  while (Date.now() - start < targetDurationMs) {
    iters++;
    // Yield every 1000 iterations to avoid completely starving the event loop.
    if (iters % 1000 === 0) {
      await Promise.resolve();
    }
  }

  const actualMs = Date.now() - start;

  const entry: AuditEntry = {
    entryId: `probe_scheduler_timeout:${start}`,
    ts: Date.now(),
    modUsername: 'sentinel',
    action: `probe_scheduler_timeout:completed:${actualMs}`,
    target: { type: 'sub', id: context.subredditId ?? '' },
    reverted: false,
    revertibleUntil: 0,
  };
  await appendAuditDeterministic(context.redis, entry);

  console.log(
    `[sentinel] probe scheduler-timeout: completed ${actualMs}ms` +
    ` (target=${targetDurationMs}ms, iters=${iters})`,
  );
}
