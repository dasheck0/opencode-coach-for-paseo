import { z } from 'zod';

export const sourceSchema = z.object({ id: z.string(), label: z.string(), path: z.string(), format: z.string() });
export const summarySchema = z.object({
  id: z.string(), adapterId: z.string(), sourceId: z.string(), title: z.string(), directory: z.string(),
  projectId: z.string().optional(), workspaceId: z.string().optional(), workspaceName: z.string().optional(), projectName: z.string().optional(),
  activityStart: z.number().optional(), activityEnd: z.number().optional(),
  parentId: z.string().nullable(), created: z.number(), updated: z.number(),
  inputTokens: z.number().nullable(), outputTokens: z.number().nullable(), cost: z.number().nullable(),
});
export type SessionSummary = z.infer<typeof summarySchema>;
export type Source = z.infer<typeof sourceSchema>;
export interface ToolCall { id: string; name: string; status: string; command?: string; file?: string; verification?: boolean; retryKey?: string }
export interface Message {
  id: string; role: 'user' | 'assistant' | 'system'; text: string; synthetic: boolean; timestamp: number;
  promptFeatures?: { short: boolean; specific: boolean };
  tools: ToolCall[]; model?: string; inputTokens: number | null; outputTokens: number | null;
  cacheRead: number | null; cacheWrite: number | null; cost: number | null;
}
export interface Session { summary: SessionSummary; messages: Message[]; compactions: number; compactionTimes?: number[]; warnings: string[] }
export const findingSchema = z.object({
  rule: z.string(), title: z.string(), severity: z.enum(['info', 'warning']),
  evidence: z.string(), advice: z.string(), messageIds: z.array(z.string()),
});
export const reportSchema = z.object({
  activity: z.array(z.number()).optional(), session: summarySchema, findings: z.array(findingSchema), warnings: z.array(z.string()),
  metrics: z.object({ humanPrompts: z.number(), aiPrompts: z.number().default(0), assistantCalls: z.number(), toolCalls: z.number(), toolErrors: z.number(),
    edits: z.number(), verificationCommands: z.number(), compactions: z.number(),
    inputTokens: z.number().nullable(), outputTokens: z.number().nullable(), cacheRead: z.number().nullable(),
    cacheWrite: z.number().nullable(), cost: z.number().nullable(), models: z.array(z.string()),
    durationMinutes: z.number(), promptSpecificity: z.number().nullable(),
  }),
});
export type Report = z.infer<typeof reportSchema>;
export type Finding = z.infer<typeof findingSchema>;
export interface HistoryQuery { groupBy?: 'session' | 'workspace'; from?: number; to?: number; directory?: string; limit: number; offset: number; projectIds?: string[]; origin?: 'human' | 'ai' | 'all' }
