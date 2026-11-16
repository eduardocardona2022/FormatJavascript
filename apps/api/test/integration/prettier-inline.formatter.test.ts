import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT_OPTIONS, type FormatOptions } from '@formatjs/shared';
import { FormatSyntaxError } from '../../src/domain/errors';
import { InlinePrettierFormatter } from '../../src/infrastructure/formatter/prettier-inline.formatter';

const options: FormatOptions = { ...DEFAULT_FORMAT_OPTIONS };
const formatter = new InlinePrettierFormatter({ timeoutMs: 10_000 });

describe('InlinePrettierFormatter', () => {
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

  it('formatea TypeScript y TSX', async () => {
    const typescript = await formatter.format({
      source: 'const x:number=1',
      fileName: 'app.ts',
      language: 'typescript',
      options,
    });
    const tsx = await formatter.format({
      source: 'const App=()=> <div className="x">Hola</div>',
      fileName: 'app.tsx',
      language: 'typescript-tsx',
      options,
    });

    expect(typescript.formatted).toBe('const x: number = 1;\n');
    expect(tsx.formatted).toContain('const App = ()');
    expect(tsx.formatted).toContain('<div');
  });

  it('formatea JSON, CSS, HTML y Markdown', async () => {
    const results = await Promise.all([
      formatter.format({
        source: '{"a":1,"b":[1,2]}',
        fileName: 'data.json',
        language: 'json',
        options,
      }),
      formatter.format({
        source: 'a{color:red}',
        fileName: 'estilos.css',
        language: 'css',
        options,
      }),
      formatter.format({
        source: '<div>\n<p>Hola</p>\n</div>',
        fileName: 'index.html',
        language: 'html',
        options,
      }),
      formatter.format({
        source: '# Hola\n\n\nTexto',
        fileName: 'README.md',
        language: 'markdown',
        options,
      }),
    ]);

    expect(results[0]?.formatted).toBe('{ "a": 1, "b": [1, 2] }\n');
    expect(results[1]?.formatted).toBe('a {\n  color: red;\n}\n');
    expect(results[2]?.formatted).toContain('  <p>Hola</p>');
    expect(results[3]?.formatted).toBe('# Hola\n\nTexto\n');
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

  it('cierra sin recursos pendientes', async () => {
    await expect(formatter.close()).resolves.toBeUndefined();
  });
});
