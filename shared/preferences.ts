import { defineSettings } from '@getpaseo/plugin';
import { z } from 'zod';
export const origins = ['human', 'ai', 'all'] as const;
export type Origin = typeof origins[number];
export const defaultOrigins = { dashboard: 'human', timeline: 'all', output: 'all', patterns: 'all', 'anti-patterns': 'human', context: 'all' } as const;
export const viewPreferences = defineSettings({ id: 'view', scope: 'host', version: 1, schema: z.object({
  language: z.string().default('de'), days: z.union([z.literal(0), z.literal(7), z.literal(30), z.literal(90)]).default(30),
  historyPageSize: z.union([z.literal(5), z.literal(10), z.literal(25)]).default(5),
  projectIds: z.array(z.string()).default([]),
  // Retained only to migrate selections saved before the project filter.
  workspaceIds: z.array(z.string()).default([]),
  origins: z.object({ dashboard: z.enum(origins).default('human'), timeline: z.enum(origins).default('all'), output: z.enum(origins).default('all'),
    patterns: z.enum(origins).default('all'), 'anti-patterns': z.enum(origins).default('human'), context: z.enum(origins).default('all') }).default(defaultOrigins),
}) });

export type ViewPreferences = z.output<typeof viewPreferences.schema>;
