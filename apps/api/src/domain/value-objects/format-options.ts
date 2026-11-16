import {
  DEFAULT_FORMAT_OPTIONS,
  getApplicableOptions,
  type FormatOptions,
  type LanguageId,
  type PartialFormatOptions,
} from '@formatjs/shared';
import { ValidationError } from '../errors';

const END_OF_LINE_VALUES = ['lf', 'crlf', 'auto'] as const;
const TRAILING_COMMA_VALUES = ['none', 'es5', 'all'] as const;
const ARROW_PARENS_VALUES = ['always', 'avoid'] as const;
const PROSE_WRAP_VALUES = ['always', 'never', 'preserve'] as const;

function includes<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

/**
 * Value object que normaliza y valida las opciones. Solo conserva las opciones
 * que aplican al lenguaje seleccionado; el resto vuelve a sus valores por
 * defecto para que el adaptador no reciba ruido.
 */
export class ResolvedFormatOptions {
  private constructor(private readonly values: FormatOptions) {}

  static resolve(language: LanguageId, input: PartialFormatOptions = {}): ResolvedFormatOptions {
    const applicable = getApplicableOptions(language, input);
    const merged: FormatOptions = { ...DEFAULT_FORMAT_OPTIONS, ...applicable };

    if (!Number.isInteger(merged.printWidth) || merged.printWidth < 40 || merged.printWidth > 160) {
      throw new ValidationError('printWidth debe ser un entero entre 40 y 160.', {
        field: 'printWidth',
      });
    }

    if (!Number.isInteger(merged.tabWidth) || merged.tabWidth < 1 || merged.tabWidth > 8) {
      throw new ValidationError('tabWidth debe ser un entero entre 1 y 8.', {
        field: 'tabWidth',
      });
    }

    if (typeof merged.useTabs !== 'boolean') {
      throw new ValidationError('useTabs debe ser un booleano.', { field: 'useTabs' });
    }

    if (!includes(END_OF_LINE_VALUES, merged.endOfLine)) {
      throw new ValidationError('endOfLine no es válido.', { field: 'endOfLine' });
    }

    if (typeof merged.semi !== 'boolean') {
      throw new ValidationError('semi debe ser un booleano.', { field: 'semi' });
    }

    if (typeof merged.singleQuote !== 'boolean') {
      throw new ValidationError('singleQuote debe ser un booleano.', { field: 'singleQuote' });
    }

    if (!includes(TRAILING_COMMA_VALUES, merged.trailingComma)) {
      throw new ValidationError('trailingComma no es válido.', { field: 'trailingComma' });
    }

    if (typeof merged.bracketSpacing !== 'boolean') {
      throw new ValidationError('bracketSpacing debe ser un booleano.', {
        field: 'bracketSpacing',
      });
    }

    if (!includes(ARROW_PARENS_VALUES, merged.arrowParens)) {
      throw new ValidationError('arrowParens no es válido.', { field: 'arrowParens' });
    }

    if (!includes(PROSE_WRAP_VALUES, merged.proseWrap)) {
      throw new ValidationError('proseWrap no es válido.', { field: 'proseWrap' });
    }

    return new ResolvedFormatOptions(merged);
  }

  toJSON(): FormatOptions {
    return { ...this.values };
  }
}
