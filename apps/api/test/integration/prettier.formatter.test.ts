import { afterAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { DEFAULT_FORMAT_OPTIONS, type FormatOptions } from '@formatjs/shared';
import {
  FormatSyntaxError,
  FormatTimeoutError,
  FormatterUnavailableError,
} from '../../src/domain/errors';
import { PrettierFormatter } from '../../src/infrastructure/formatter/prettier.formatter';

const options: FormatOptions = { ...DEFAULT_FORMAT_OPTIONS };

const formatter = new PrettierFormatter({ maxThreads: 1, timeoutMs: 10_000 });

afterAll(async () => {
  await formatter.close();
});

describe('PrettierFormatter', () => {
  it('formatea JavaScript', async () => {
    const result = await formatter.format({
      source: 'const x=1;console.log(x)',
      fileName: 'app.js',
      language: 'javascript',
      options,
    });

    expect(result.formatted).toBe('const x = 1;\nconsole.log(x);\n');
  });

  it('formatea JavaScript con JSX', async () => {
    const result = await formatter.format({
      source: 'const App=()=> <div className="x">Hola</div>',
      fileName: 'app.jsx',
      language: 'javascript-jsx',
      options,
    });

    expect(result.formatted).toContain('const App = ()');
    expect(result.formatted).toContain('<div');
  });

  it('formatea TypeScript', async () => {
    const result = await formatter.format({
      source: 'const x:number=1',
      fileName: 'app.ts',
      language: 'typescript',
      options,
    });

    expect(result.formatted).toBe('const x: number = 1;\n');
  });

  it('formatea TypeScript con TSX usando el filepath', async () => {
    const result = await formatter.format({
      source: 'const App=()=> <div className="x">Hola</div>',
      fileName: 'app.tsx',
      language: 'typescript-tsx',
      options,
    });

    expect(result.formatted).toContain('const App = ()');
    expect(result.formatted).toContain('<div');
  });

  it('formatea JSON', async () => {
    const result = await formatter.format({
      source: '{"a":1,"b":[1,2]}',
      fileName: 'data.json',
      language: 'json',
      options,
    });

    expect(result.formatted).toBe('{ "a": 1, "b": [1, 2] }\n');
  });

  it('formatea CSS', async () => {
    const result = await formatter.format({
      source: 'a{color:red}',
      fileName: 'estilos.css',
      language: 'css',
      options,
    });

    expect(result.formatted).toBe('a {\n  color: red;\n}\n');
  });

  it('formatea HTML', async () => {
    const result = await formatter.format({
      source: '<div>\n<p>Hola</p>\n</div>',
      fileName: 'index.html',
      language: 'html',
      options,
    });

    expect(result.formatted).toContain('<div>');
    expect(result.formatted).toContain('  <p>Hola</p>');
  });

  it('formatea Markdown', async () => {
    const result = await formatter.format({
      source: '# Hola\n\n\nTexto',
      fileName: 'README.md',
      language: 'markdown',
      options,
    });

    expect(result.formatted).toBe('# Hola\n\nTexto\n');
  });

  it('mapea un error de sintaxis con línea y columna', async () => {
    await expect(
      formatter.format({
        source: '{"a":}',
        fileName: 'data.json',
        language: 'json',
        options,
      }),
    ).rejects.toMatchObject({
      code: 'SYNTAX_ERROR',
      details: { line: expect.any(Number), column: expect.any(Number) },
    });
  });

  it('mapea un error de sintaxis de JavaScript', async () => {
    await expect(
      formatter.format({
        source: 'const x = ;',
        fileName: 'app.js',
        language: 'javascript',
        options,
      }),
    ).rejects.toBeInstanceOf(FormatSyntaxError);
  });

  it('cancela y mapea un timeout', async () => {
    const fastFormatter = new PrettierFormatter({ maxThreads: 1, timeoutMs: 1 });

    try {
      await expect(
        fastFormatter.format({
          source: 'const x = 1;\n'.repeat(5_000),
          fileName: 'large.js',
          language: 'javascript',
          options,
        }),
      ).rejects.toBeInstanceOf(FormatTimeoutError);
    } finally {
      await fastFormatter.close();
    }
  });

  it('mapea un worker roto a error de disponibilidad', async () => {
    const brokenFormatter = new PrettierFormatter({
      maxThreads: 1,
      timeoutMs: 5_000,
      filename: fileURLToPath(new URL('../fixtures/broken.worker.mjs', import.meta.url)),
    });

    try {
      await expect(
        brokenFormatter.format({
          source: 'const x = 1;',
          fileName: 'app.js',
          language: 'javascript',
          options,
        }),
      ).rejects.toBeInstanceOf(FormatterUnavailableError);
    } finally {
      await brokenFormatter.close();
    }
  });
});
