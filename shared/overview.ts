import { z } from 'zod';

export const overviewInputSchema = z.object({
  adapterId: z.string(), sourceId: z.string(), from: z.number().optional(), to: z.number(),
  directory: z.string().optional(),
}).refine(x => x.from === undefined || x.from <= x.to, 'Start must precede end');
export type OverviewInput = z.infer<typeof overviewInputSchema>;
export const overviewSchema = z.object({
  status: z.enum(['discovering', 'analyzing', 'complete', 'error']),
  generatedAt: z.number(), from: z.number().nullable(), to: z.number(), error: z.string().nullable(),
  matched: z.number(), analyzed: z.number(), failed: z.number(), incomplete: z.number(),
  mainSessions: z.number(), delegatedSessions: z.number(),
  metrics: z.object({ humanPrompts: z.number(), assistantCalls: z.number(), toolCalls: z.number(), toolErrors: z.number(),
    edits: z.number(), editingSessions: z.number(), verifiedEditingSessions: z.number(),
    inputTokens: z.number().nullable(), outputTokens: z.number().nullable(), cacheRead: z.number().nullable(),
    cost: z.number().nullable(), usageSessions: z.number(), costSessions: z.number(),
  }),
  breakdown: z.object({
    workspaces: z.array(z.object({ directory: z.string(), sessions: z.number(), humanPrompts: z.number(), toolCalls: z.number() })),
    models: z.array(z.object({ name: z.string(), sessions: z.number() })),
    hours: z.array(z.number()),
    calendar: z.array(z.object({ day: z.string(), sessions: z.number() })),
    compactions: z.number(), compactedSessions: z.number(), longSessions: z.number(),
  }),
  periods: z.object({ midpoint: z.number().nullable(), earlierSessions: z.number(), laterSessions: z.number() }),
  insights: z.array(z.object({
    rule: z.string(), title: z.string(), advice: z.string(), affectedSessions: z.number(), percentage: z.number(),
    earlierPercentage: z.number().nullable(), laterPercentage: z.number().nullable(), changePoints: z.number().nullable(),
    examples: z.array(z.object({ sessionId: z.string(), title: z.string() })),
  })),
  activity: z.array(z.object({ day: z.string(), sessions: z.number(), analyzed: z.number(), warningSessions: z.number() })),
});
export type Overview = z.infer<typeof overviewSchema>;
