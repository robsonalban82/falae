import { z } from 'zod';

/**
 * Zod's built-in messages (missing field, wrong type, size) in PT-BR, set once for the app,
 * scripts and tests. Imported for its side effect by src/content/schema.ts, which every
 * content schema depends on. Custom messages in the schemas still take precedence.
 */
z.config(z.locales.ptBR());
