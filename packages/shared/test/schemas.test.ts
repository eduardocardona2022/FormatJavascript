import { describe, expect, it } from 'vitest';
import { formatRequestSchema, formatResponseSchema, toValidationDetails } from '../src/schemas';

describe('schemas compartidos', () => {
  it('acepta una petición válida', () => {
    const result = formatRequestSchema.safeParse({
      fileName: 'app.ts',
      source: 'const x=1;',
      options: { printWidth: 100, semi: false },
    });

    expect(result.success).toBe(true);
  });

  it('rechaza opciones desconocidas', () => {
    const result = formatRequestSchema.safeParse({
      fileName: 'app.ts',
      source: 'const x=1;',
      options: { parser: 'babel' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toValidationDetails(result.error)).toHaveProperty('options');
    }
  });

  it('rechaza rangos inválidos', () => {
    const result = formatRequestSchema.safeParse({
      fileName: 'app.ts',
      source: 'const x=1;',
      options: { printWidth: 10, tabWidth: 20 },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const details = toValidationDetails(result.error);
      expect(details['options.printWidth']?.[0]).toBeTruthy();
      expect(details['options.tabWidth']?.[0]).toBeTruthy();
    }
  });

  it('rechaza campos adicionales en la petición', () => {
    const result = formatRequestSchema.safeParse({
      fileName: 'app.ts',
      source: 'const x=1;',
      parser: 'babel',
    });

    expect(result.success).toBe(false);
  });

  it('valida una respuesta de formato', () => {
    const result = formatResponseSchema.safeParse({
      formatted: 'const x = 1;\n',
      language: 'typescript',
      stats: { inputLines: 1, outputLines: 1, durationMs: 12 },
    });

    expect(result.success).toBe(true);
  });

  it('rechaza una respuesta con lenguaje desconocido', () => {
    const result = formatResponseSchema.safeParse({
      formatted: '',
      language: 'python',
      stats: { inputLines: 1, outputLines: 1, durationMs: 1 },
    });

    expect(result.success).toBe(false);
  });
});
