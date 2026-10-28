import { clock } from '../services/clock';
import { DexieRepository } from './dexieRepository';
import type { Repository } from './repository';

/** App-wide repository instance. */
export const repository: Repository = new DexieRepository({ nowIso: clock.iso });
