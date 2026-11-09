import { createHash } from 'node:crypto';
import { z } from 'zod';
import { summarySchema, type Session } from '../shared/model';
import { isVerification, isSpecific } from './analyze';
const nullable = z.number().nullable();
export const factsSchema = z.object({
  summary: summarySchema, warnings: z.array(z.string()), compactions: z.number(), compactionTimes: z.array(z.number()).optional(),
  messages: z.array(z.object({
    id: z.string(), role: z.enum(['user', 'assistant', 'system']), synthetic: z.boolean(), timestamp: z.number(), text: z.literal(''),
    promptFeatures: z.object({ short: z.boolean(), specific: z.boolean() }),
    tools: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), verification: z.boolean(), retryKey: z.string() })),
    model: z.string().optional(), inputTokens: nullable, outputTokens: nullable, cacheRead: nullable, cacheWrite: nullable, cost: nullable,
  })),
});
/** Persist only the features required by deterministic rules; never conversation or command text. */
export function sessionFacts(session: Session): Session {
  return { ...session, messages: session.messages.map(m => ({ ...m, text: '',
    promptFeatures: { short: m.text.trim().length > 0 && m.text.trim().length < 25, specific: isSpecific(m.text) },
    tools: m.tools.map(t => ({ id: t.id, name: t.name, status: t.status,
      verification: /bash|shell|exec|terminal/i.test(t.name) && isVerification(t.command),
      retryKey: createHash('sha256').update(`${t.name}:${t.command || t.file || t.id}`).digest('hex'),
    })),
  })) };
}
export interface Period { from?: number; to?: number }
export function inPeriod(timestamp: number, period: Period) { return timestamp >= (period.from ?? -Infinity) && timestamp <= (period.to ?? Infinity); }
export function periodSession(session: Session, period: Period): Session {
  const messages = session.messages.filter(m => inPeriod(m.timestamp, period));
  const compactions = session.compactionTimes?.filter(t => inPeriod(t, period)).length ?? (period.from === undefined && period.to === undefined ? session.compactions : 0);
  return { ...session, messages, compactions,
    warnings: session.compactions && !session.compactionTimes && (period.from !== undefined || period.to !== undefined)
      ? [...session.warnings, 'Compaction timestamps are unavailable; period compaction counts are omitted.'] : session.warnings };
}
