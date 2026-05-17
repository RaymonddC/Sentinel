import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Ctx } from '../types/ctx.js';

// vi.mock is hoisted above static imports by vitest, so these mocks are in
// effect when logger.ts loads and calls appendAuditDeterministic/hasAuditEntry.
vi.mock('../storage/redis.js', () => ({
  hasAuditEntry: vi.fn(),
  appendAuditDeterministic: vi.fn(),
}));

import { log, logToConsole, withErrorLog } from './logger.js';
import { hasAuditEntry, appendAuditDeterministic } from '../storage/redis.js';

const mockCtx = { redis: {}, subredditId: 'sub_test123' } as unknown as Ctx;

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAuditEntry).mockResolvedValue(false);
    vi.mocked(appendAuditDeterministic).mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('console formatting includes [sentinel], level, scope, msg, and ctx', () => {
    logToConsole({
      level: 'warn',
      scope: 'test.scope',
      msg: 'something went wrong',
      ctx: { alertId: 'A-42', count: 3 },
    });
    const calls = vi.mocked(console.warn).mock.calls;
    expect(calls).toHaveLength(1);
    const line = calls[0]![0] as string;
    expect(line).toContain('[sentinel]');
    expect(line).toContain('warn');
    expect(line).toContain('test.scope');
    expect(line).toContain('something went wrong');
    expect(line).toContain('"alertId"');
    expect(line).toContain('"A-42"');
    expect(line).toContain('"count"');
  });

  it('audit append is called for warn level', async () => {
    await log(mockCtx, { level: 'warn', scope: 'dispatch', msg: 'tx failed' });
    expect(vi.mocked(appendAuditDeterministic)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(appendAuditDeterministic).mock.calls[0]!;
    const entry = call[1];
    expect(entry.action).toBe('log_warn:dispatch');
    expect(entry.modUsername).toBe('sentinel');
    expect(entry.reverted).toBe(false);
    expect(entry.target.type).toBe('system');
  });

  it('audit append is called for error level', async () => {
    await log(mockCtx, { level: 'error', scope: 'bootstrap.p1', msg: 'bootstrap error' });
    expect(vi.mocked(appendAuditDeterministic)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(appendAuditDeterministic).mock.calls[0]!;
    const entry = call[1];
    expect(entry.action).toBe('log_error:bootstrap.p1');
    expect(entry.reason).toBe('bootstrap error');
  });

  it('dedup: same scope+msg within same hour → only one audit entry', async () => {
    // First call: hasAuditEntry returns false → writes entry
    vi.mocked(hasAuditEntry).mockResolvedValueOnce(false);
    await log(mockCtx, { level: 'warn', scope: 'dup.scope', msg: 'repeated error' });
    expect(vi.mocked(appendAuditDeterministic)).toHaveBeenCalledTimes(1);

    // Second call: hasAuditEntry returns true (already written) → no-op
    vi.mocked(hasAuditEntry).mockResolvedValueOnce(true);
    await log(mockCtx, { level: 'warn', scope: 'dup.scope', msg: 'repeated error' });
    // Still called exactly once total
    expect(vi.mocked(appendAuditDeterministic)).toHaveBeenCalledTimes(1);
  });

  it('info level does not touch the audit log', async () => {
    await log(mockCtx, { level: 'info', scope: 'ingest.comment', msg: 'comment ingested' });
    expect(vi.mocked(hasAuditEntry)).not.toHaveBeenCalled();
    expect(vi.mocked(appendAuditDeterministic)).not.toHaveBeenCalled();
    // Console output still happens via console.log
    expect(vi.mocked(console.log)).toHaveBeenCalledTimes(1);
  });

  it('withErrorLog catches unhandled throws and logs them as errors', async () => {
    const boom = new Error('kaboom');
    const wrapped = withErrorLog('test.handler', async (_ctx) => {
      throw boom;
    });
    await wrapped(mockCtx);
    expect(vi.mocked(appendAuditDeterministic)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(appendAuditDeterministic).mock.calls[0]!;
    const entry = call[1];
    expect(entry.action).toBe('log_error:test.handler');
    expect(entry.reason).toBe('unhandled');
    // console.error should have been called
    expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
    const errLine = vi.mocked(console.error).mock.calls[0]![0] as string;
    expect(errLine).toContain('kaboom');
  });
});
