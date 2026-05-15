// Trigger-to-ingest dispatch glue. Every Devvit handler funnels through here
// inside a single try/catch (handlers must never throw).

import type { Ctx } from '../types/ctx.js';
import { ingestComment, type CommentIngestEvent } from './comment.js';
import { ingestPost, type PostIngestEvent } from './post.js';
import { ingestReport, type ReportIngestEvent } from './report.js';
import { ingestModAction, type ModActionIngestEvent } from './mod-action.js';

export async function onComment(context: Ctx, e: CommentIngestEvent): Promise<void> {
  try {
    const { evaluated } = await ingestComment(context, e);
    if (evaluated) {
      // Lazy-import engine entry points to keep ingestion light.
      const [{ evaluateRaidRadar }, { evaluateHealth }] = await Promise.all([
        import('../engines/raid-radar/evaluate.js'),
        import('../engines/health-score/evaluate.js'),
      ]);
      await evaluateRaidRadar(context, e.postId);
      await evaluateHealth(context, e.postId);

      // Memory's first-time-commenter check is cheap on average (banned index small).
      const { evaluateMemoryOnComment } = await import('../engines/memory/evaluate.js');
      await evaluateMemoryOnComment(context, e);
    }
  } catch (err) {
    console.error('[sentinel] onComment error', err);
  }
}

export async function onPost(context: Ctx, e: PostIngestEvent): Promise<void> {
  try {
    await ingestPost(context, e);
  } catch (err) {
    console.error('[sentinel] onPost error', err);
  }
}

export async function onReport(context: Ctx, e: ReportIngestEvent): Promise<void> {
  try {
    const { evaluated } = await ingestReport(context, e);
    if (evaluated) {
      const { evaluateHealth } = await import('../engines/health-score/evaluate.js');
      await evaluateHealth(context, e.postId);
    }
  } catch (err) {
    console.error('[sentinel] onReport error', err);
  }
}

export async function onModAction(context: Ctx, e: ModActionIngestEvent): Promise<void> {
  try {
    await ingestModAction(context, e);
  } catch (err) {
    console.error('[sentinel] onModAction error', err);
  }
}
