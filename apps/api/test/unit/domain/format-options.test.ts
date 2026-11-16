import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT_OPTIONS, type PartialFormatOptions } from '@formatjs/shared';
import { ValidationError } from '../../../src/domain/errors';
import { ResolvedFormatOptions } from '../../../src/domain/value-objects/format-options';

const invalid = (value: unknown): PartialFormatOptions => value as PartialFormatOptions;

describe('ResolvedFormatOptions', () => {
  it('aplica los valores por defecto', () => {
    expect(ResolvedFormatOptions.resolve('javascript').toJSON()).toEqual(DEFAULT_FORMAT_OPTIONS);
  });

  it('aplica opciones de scripts', () => {
    const options = ResolvedFormatOptions.resolve('typescript', {
      printWidth: 100,
      semi: false,
      singleQuote: true,
      trailingComma: 'es5',
      arrowParens: 'avoid',
    }).toJSON();

    expect(options.printWidth).toBe(100);
    expect(options.semi).toBe(false);
    expect(options.singleQuote).toBe(true);
    expect(options.trailingComma).toBe('es5');
    expect(options.arrowParens).toBe('avoid');
  });

  it('ignora opciones no aplicables al lenguaje', () => {
    const json = ResolvedFormatOptions.resolve('json', {
      printWidth: 120,
      semi: false,
      singleQuote: true,
      proseWrap: 'never',
    }).toJSON();

    expect(json.printWidth).toBe(120);
    expect(json.semi).toBe(DEFAULT_FORMAT_OPTIONS.semi);
    expect(json.singleQuote).toBe(DEFAULT_FORMAT_OPTIONS.singleQuote);
    expect(json.proseWrap).toBe(DEFAULT_FORMAT_OPTIONS.proseWrap);
  });

  it('acepta proseWrap en Markdown', () => {
    expect(
      ResolvedFormatOptions.resolve('markdown', { proseWrap: 'always' }).toJSON().proseWrap,
    ).toBe('always');
  });

  it.each([
    { language: 'javascript', options: { printWidth: 10 } },
    { language: 'javascript', options: { printWidth: 161 } },
    { language: 'javascript', options: { printWidth: 80.5 } },
    { language: 'javascript', options: { tabWidth: 0 } },
    { language: 'javascript', options: { tabWidth: 9 } },
    { language: 'javascript', options: { useTabs: 'yes' } },
    { language: 'javascript', options: { endOfLine: 'invalid' } },
    { language: 'javascript', options: { semi: 'yes' } },
    { language: 'javascript', options: { singleQuote: 'yes' } },
    { language: 'javascript', options: { trailingComma: 'always' } },
    { language: 'javascript', options: { bracketSpacing: 'yes' } },
    { language: 'javascript', options: { arrowParens: 'sometimes' } },
    { language: 'markdown', options: { proseWrap: 'sometimes' } },
  ] as const)('rechaza la opción inválida %o', ({ language, options }) => {
    expect(() => ResolvedFormatOptions.resolve(language, invalid(options))).toThrow(
      ValidationError,
    );
  });
});
