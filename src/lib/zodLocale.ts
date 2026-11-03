import { z } from 'zod';

/**
 * Zod's built-in messages (missing field, wrong type, size) in PT-BR, set once.
 * Imported for its side effect by every module that declares schemas (src/content/schema.ts,
 * src/data/models.ts) and by the test setup. Custom messages in the schemas take precedence.
 */
z.config(z.locales.ptBR());
