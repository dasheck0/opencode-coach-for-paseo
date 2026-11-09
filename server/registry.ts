import { OpenCodeAdapter } from './adapters/opencode';
import { AdapterRegistry } from './adapters/types';
// Add a new adapter instance here. It appears in every provider control automatically.
export function createRegistry() { return new AdapterRegistry([new OpenCodeAdapter()]); }
