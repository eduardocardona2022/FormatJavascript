import { z } from 'zod';
import { LANGUAGE_IDS, MAX_SOURCE_BYTES } from './languages';

const languageSchema = z.enum(LANGUAGE_IDS);

/**
 * Las opciones son opcionales en la entrada. El dominio aplica los valores por
 * defecto y valida de nuevo los rangos antes de invocar a Prettier.
 */
export const formatOptionsInputSchema = z
  .object({
    printWidth: z.number().int().min(40).max(160).optional(),
    tabWidth: z.number().int().min(1).max(8).optional(),
    useTabs: z.boolean().optional(),
    endOfLine: z.enum(['lf', 'crlf', 'auto']).optional(),
    semi: z.boolean().optional(),
    singleQuote: z.boolean().optional(),
    trailingComma: z.enum(['none', 'es5', 'all']).optional(),
    bracketSpacing: z.boolean().optional(),
    arrowParens: z.enum(['always', 'avoid']).optional(),
    proseWrap: z.enum(['always', 'never', 'preserve']).optional(),
  })
  .strict();

export const formatRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    source: z
      .string()
      .min(1)
      .max(MAX_SOURCE_BYTES * 2),
    options: formatOptionsInputSchema.optional(),
  })
  .strict();

export const formatStatsSchema = z
  .object({
    inputLines: z.number().int().nonnegative(),
    outputLines: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative(),
  })
  .strict();

export const formatResponseSchema = z
  .object({
    formatted: z.string(),
    language: languageSchema,
    stats: formatStatsSchema,
  })
  .strict();

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

export type FormatRequest = z.infer<typeof formatRequestSchema>;
export type FormatResponse = z.infer<typeof formatResponseSchema>;
export type FormatStats = z.infer<typeof formatStatsSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

/**
 * Convierte un ZodError en un mapa legible de campo -> mensajes. Se construye
 * manualmente para mantener compatibilidad entre versiones de Zod.
 */
export function toValidationDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.map(String).join('.') : '_root';
    const messages = details[field] ?? [];
    messages.push(issue.message);
    details[field] = messages;
  }

  return details;
}
