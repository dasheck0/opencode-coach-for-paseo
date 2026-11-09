import { defineRpc, defineSettings } from '@getpaseo/plugin';
import { z } from 'zod';
import { overviewInputSchema, overviewSchema } from './overview';
import { origins } from './preferences';
import { workspaceCatalogSchema } from './workspaces';
import { reportSchema, sourceSchema, summarySchema } from './model';

// New adapter IDs require no changes here or in the UI.
export const preferences = defineSettings({
  id: 'providers', scope: 'host', version: 1,
  schema: z.object({
    disabled: z.array(z.string()).default([]),
    hidden: z.array(z.string()).default([]),
    selected: z.string().default('opencode-v2'),
    paths: z.record(z.string(), z.array(z.string().min(1))).default({}),
  }),
});
export const catalogRpc = defineRpc({ name: 'coach.catalog', input: z.object({}), output: z.object({
  adapters: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(),
    enabled: z.boolean(), hidden: z.boolean(), sources: z.array(sourceSchema), error: z.string().nullable(),
  })),
}) });
export const historyRpc = defineRpc({ name: 'coach.history', input: z.object({
  adapterId: z.string(), sourceId: z.string(), from: z.number().optional(), to: z.number().optional(),
  directory: z.string().optional(), projectIds: z.array(z.string()).optional(), origin: z.enum(origins).optional(), limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(1000000).default(0), groupBy: z.enum(['session', 'workspace']).default('session'),
}).refine(x => x.from === undefined || x.to === undefined || x.from <= x.to, 'Start must precede end'),
output: z.object({ sessions: z.array(summarySchema), hasMore: z.boolean(), total: z.number().int().nonnegative(), totalSessions: z.number().int().nonnegative(), offset: z.number().int().nonnegative() }) });
export const analyzeRpc = defineRpc({ name: 'coach.analyze', input: z.object({
  adapterId: z.string(), sourceId: z.string(), sessionId: z.string().min(1).max(300), origin: z.enum(origins).optional(), from: z.number().optional(), to: z.number().optional(),
}).refine(x => x.from === undefined || x.to === undefined || x.from <= x.to, 'Start must precede end'), output: reportSchema });

export const overviewRpc = defineRpc({ name: 'coach.overview', input: overviewInputSchema, output: overviewSchema });

export const workspacesRpc = defineRpc({ name: 'coach.workspaces', input: z.object({}), output: workspaceCatalogSchema });
