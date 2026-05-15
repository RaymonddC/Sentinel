// Minimal context surface shared by TriggerContext, JobContext, and Context.
// Use this for any function that needs redis + reddit + scheduler but doesn't
// touch UI / dimensions / modLog.

import type { TriggerContext } from '@devvit/public-api';

export type Ctx = TriggerContext;
