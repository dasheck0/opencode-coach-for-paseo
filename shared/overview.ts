import { z } from 'zod';
import { origins } from './preferences';

export const overviewInputSchema = z.object({
  adapterId: z.string(), sourceId: z.string(), from: z.number().optional(), to: z.number(),
  directory: z.string().optional(), projectIds: z.array(z.string()).optional(), origin: z.enum(origins).optional(),
}).refine(x => x.from === undefined || x.from <= x.to, 'Start must precede end');
export type OverviewInput = z.infer<typeof overviewInputSchema>;
export const overviewSchema = z.object({
  origin: z.enum(origins),
  status: z.enum(['discovering', 'analyzing', 'complete', 'error']),
  generatedAt: z.number(), from: z.number().nullable(), to: z.number(), error: z.string().nullable(),
  matched: z.number(), analyzed: z.number(), failed: z.number(), incomplete: z.number(),
  mainSessions: z.number(), delegatedSessions: z.number(),
  cache: z.object({ reused: z.number(), imported: z.number(), errors: z.number(), persistent: z.boolean(), snapshotAt: z.number().optional(), refreshing: z.boolean().optional() }),
  metrics: z.object({ humanPrompts: z.number(), aiPrompts: z.number().default(0), assistantCalls: z.number(), toolCalls: z.number(), toolErrors: z.number(),
    edits: z.number(), editingSessions: z.number(), verifiedEditingSessions: z.number(),
    inputTokens: z.number().nullable(), outputTokens: z.number().nullable(), cacheRead: z.number().nullable(),
    cost: z.number().nullable(), usageSessions: z.number(), costSessions: z.number(),
  }),
  breakdown: z.object({
    workspaces: z.array(z.object({ directory: z.string(), workspaceName: z.string().optional(), projectName: z.string().optional(), sessions: z.number(), humanPrompts: z.number(), toolCalls: z.number() })),
    models: z.array(z.object({ name: z.string(), sessions: z.number() })),
    hours: z.array(z.number()),
    calendar: z.array(z.object({ day: z.string(), sessions: z.number() })),
    compactions: z.number(), compactedSessions: z.number(), longSessions: z.number(),
  }),
  periods: z.object({ midpoint: z.number().nullable(), earlierSessions: z.number(), laterSessions: z.number() }),
  insights: z.array(z.object({
    rule: z.string(), title: z.string(), advice: z.string(), affectedSessions: z.number(), percentage: z.number(),
    earlierPercentage: z.number().nullable(), laterPercentage: z.number().nullable(), changePoints: z.number().nullable(),
    examples: z.array(z.object({ sessionId: z.string(), title: z.string(), workspaceName: z.string().optional(), projectName: z.string().optional() })),
  })),
  activity: z.array(z.object({ day: z.string(), sessions: z.number(), analyzed: z.number(), warningSessions: z.number() })),
});
export type Overview = z.infer<typeof overviewSchema>;
