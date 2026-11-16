import type { FormatOptions, LanguageId } from '@formatjs/shared';

export const PARSER_BY_LANGUAGE = {
  javascript: 'babel',
  'javascript-jsx': 'babel',
  typescript: 'typescript',
  'typescript-tsx': 'typescript',
  json: 'json',
  css: 'css',
  html: 'html',
  markdown: 'markdown',
} as const satisfies Record<LanguageId, string>;

const SCRIPT_LANGUAGES = new Set<LanguageId>([
  'javascript',
  'javascript-jsx',
  'typescript',
  'typescript-tsx',
]);

/**
 * Solo se envían las opciones que cada lenguaje soporta. No se hace spread del
 * objeto recibido para evitar propiedades no deseadas (prototype pollution).
 */
export function toPrettierOptions(
  language: LanguageId,
  options: FormatOptions,
): Record<string, unknown> {
  const common = {
    printWidth: options.printWidth,
    tabWidth: options.tabWidth,
    useTabs: options.useTabs,
    endOfLine: options.endOfLine,
  };

  if (SCRIPT_LANGUAGES.has(language)) {
    return {
      ...common,
      semi: options.semi,
      singleQuote: options.singleQuote,
      trailingComma: options.trailingComma,
      bracketSpacing: options.bracketSpacing,
      arrowParens: options.arrowParens,
    };
  }

  if (language === 'markdown') {
    return { ...common, proseWrap: options.proseWrap };
  }

  return common;
}
