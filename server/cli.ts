import { createRegistry } from './registry';
import { CoachService, type Preferences } from './service';
const service = new CoachService(createRegistry(), async (): Promise<Preferences> => ({ disabled: [], hidden: [], selected: 'opencode-v2',
  paths: process.env.COACH_OPENCODE_DB ? { 'opencode-v2': [process.env.COACH_OPENCODE_DB] } : {} }));
const [command = 'sources', sourceId, sessionId] = process.argv.slice(2);
try {
  if (command === 'sources') console.log(JSON.stringify(await service.catalog(), null, 2));
  else if (command === 'history' && sourceId) console.log(JSON.stringify(await service.history('opencode-v2', sourceId, { limit: 20, offset: 0 }), null, 2));
  else if (command === 'analyze' && sourceId && sessionId) console.log(JSON.stringify(await service.analyze('opencode-v2', sourceId, sessionId), null, 2));
  else throw new Error('Usage: npm run coach -- sources | history SOURCE_ID | analyze SOURCE_ID SESSION_ID');
} catch (error) { console.error(error instanceof Error ? error.message : 'Coach failed'); process.exitCode = 1; }
