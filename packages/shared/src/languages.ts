/**
 * Catálogo de lenguajes soportados y opciones de formato compartidas por
 * frontend y backend. Este módulo no depende de Node ni del navegador.
 */

export const LANGUAGE_IDS = [
  'javascript',
  'javascript-jsx',
  'typescript',
  'typescript-tsx',
  'json',
  'css',
  'html',
  'markdown',
] as const;

export type LanguageId = (typeof LANGUAGE_IDS)[number];

export const FORMAT_OPTION_KEYS = [
  'printWidth',
  'tabWidth',
  'useTabs',
  'endOfLine',
  'semi',
  'singleQuote',
  'trailingComma',
  'bracketSpacing',
  'arrowParens',
  'proseWrap',
] as const;

export type FormatOptionKey = (typeof FORMAT_OPTION_KEYS)[number];

export type EndOfLine = 'lf' | 'crlf' | 'auto';
export type TrailingComma = 'none' | 'es5' | 'all';
export type ArrowParens = 'always' | 'avoid';
export type ProseWrap = 'always' | 'never' | 'preserve';

/**
 * Opciones completamente resueltas (sin `undefined`). El backend aplica los
 * valores por defecto antes de enviarlas al formateador.
 */
export interface FormatOptions {
  printWidth: number;
  tabWidth: number;
  useTabs: boolean;
  endOfLine: EndOfLine;
  semi: boolean;
  singleQuote: boolean;
  trailingComma: TrailingComma;
  bracketSpacing: boolean;
  arrowParens: ArrowParens;
  proseWrap: ProseWrap;
}

export type PartialFormatOptions = Partial<FormatOptions>;

export interface FormatStats {
  readonly inputLines: number;
  readonly outputLines: number;
  readonly durationMs: number;
}

export const DEFAULT_FORMAT_OPTIONS: Readonly<FormatOptions> = Object.freeze({
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
  semi: true,
  singleQuote: false,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  proseWrap: 'preserve',
});

/** Límite de entrada compartido: 1 MiB. El backend valida los bytes reales. */
export const MAX_SOURCE_BYTES = 1_048_576;

export interface LanguageDefinition {
  readonly id: LanguageId;
  readonly label: string;
  readonly extension: string;
  readonly description: string;
  readonly options: readonly FormatOptionKey[];
}

const COMMON_OPTIONS = [
  'printWidth',
  'tabWidth',
  'useTabs',
  'endOfLine',
] as const satisfies readonly FormatOptionKey[];

const SCRIPT_OPTIONS = [
  ...COMMON_OPTIONS,
  'semi',
  'singleQuote',
  'trailingComma',
  'bracketSpacing',
  'arrowParens',
] as const satisfies readonly FormatOptionKey[];

const MARKDOWN_OPTIONS = [
  ...COMMON_OPTIONS,
  'proseWrap',
] as const satisfies readonly FormatOptionKey[];

export const LANGUAGES: Readonly<Record<LanguageId, LanguageDefinition>> = Object.freeze({
  javascript: {
    id: 'javascript',
    label: 'JavaScript',
    extension: '.js',
    description: 'JavaScript moderno',
    options: SCRIPT_OPTIONS,
  },
  'javascript-jsx': {
    id: 'javascript-jsx',
    label: 'JavaScript (JSX)',
    extension: '.jsx',
    description: 'JavaScript con JSX',
    options: SCRIPT_OPTIONS,
  },
  typescript: {
    id: 'typescript',
    label: 'TypeScript',
    extension: '.ts',
    description: 'TypeScript',
    options: SCRIPT_OPTIONS,
  },
  'typescript-tsx': {
    id: 'typescript-tsx',
    label: 'TypeScript (TSX)',
    extension: '.tsx',
    description: 'TypeScript con JSX',
    options: SCRIPT_OPTIONS,
  },
  json: {
    id: 'json',
    label: 'JSON',
    extension: '.json',
    description: 'Documentos JSON',
    options: COMMON_OPTIONS,
  },
  css: {
    id: 'css',
    label: 'CSS',
    extension: '.css',
    description: 'Hojas de estilo CSS',
    options: COMMON_OPTIONS,
  },
  html: {
    id: 'html',
    label: 'HTML',
    extension: '.html',
    description: 'Documentos HTML',
    options: COMMON_OPTIONS,
  },
  markdown: {
    id: 'markdown',
    label: 'Markdown',
    extension: '.md',
    description: 'Documentos Markdown',
    options: MARKDOWN_OPTIONS,
  },
});

export const LANGUAGE_BY_EXTENSION: Readonly<Record<string, LanguageId>> = Object.freeze(
  Object.fromEntries(Object.values(LANGUAGES).map((language) => [language.extension, language.id])),
);

export const SUPPORTED_EXTENSIONS = Object.freeze(
  Object.values(LANGUAGES).map((language) => language.extension),
);

export const SUPPORTED_EXTENSIONS_LABEL = SUPPORTED_EXTENSIONS.join(', ');

export function isLanguageId(value: unknown): value is LanguageId {
  return typeof value === 'string' && (LANGUAGE_IDS as readonly string[]).includes(value);
}

export function getLanguageDefinition(language: LanguageId): LanguageDefinition {
  return LANGUAGES[language];
}

/**
 * Devuelve el nombre base sin directorios. Acepta separadores de Windows y
 * POSIX para que el cliente nunca pueda enviar una ruta al backend.
 */
export function baseName(fileName: string): string {
  const normalized = fileName.replaceAll('\\', '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

export function getExtension(fileName: string): string {
  const base = baseName(fileName);
  const dotIndex = base.lastIndexOf('.');
  return dotIndex > 0 ? base.slice(dotIndex).toLowerCase() : '';
}

export function detectLanguage(fileName: string): LanguageId | undefined {
  return LANGUAGE_BY_EXTENSION[getExtension(fileName)];
}

/**
 * Filtra las opciones que Prettier soporta realmente para el lenguaje. Se usa
 * en el cliente para no enviar ruido y en el servidor como defensa en
 * profundidad.
 */
export function getApplicableOptions(
  language: LanguageId,
  options: PartialFormatOptions,
): PartialFormatOptions {
  const allowed = new Set<FormatOptionKey>(LANGUAGES[language].options);
  const result: PartialFormatOptions = {};

  for (const key of FORMAT_OPTION_KEYS) {
    if (!allowed.has(key)) {
      continue;
    }

    const value = options[key];
    if (value !== undefined) {
      Object.assign(result, { [key]: value });
    }
  }

  return result;
}

export function buildSnippetFileName(language: LanguageId): string {
  return `snippet${LANGUAGES[language].extension}`;
}

/**
 * Limpia un nombre de archivo para usarlo únicamente como metadato y como
 * nombre de descarga. No se escribe nada en disco en el servidor.
 */
export function sanitizeFileName(fileName: string): string {
  const cleaned = baseName(fileName)
    // eslint-disable-next-line no-control-regex -- Se eliminan caracteres de control por seguridad.
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);

  return cleaned.length > 0 ? cleaned : 'archivo.txt';
}

/** `app.ts` -> `app.formatted.ts`; conserva la extensión original. */
export function getExportFileName(fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  const dotIndex = safeName.lastIndexOf('.');

  if (dotIndex <= 0) {
    return `${safeName}.formatted`;
  }

  return `${safeName.slice(0, dotIndex)}.formatted${safeName.slice(dotIndex)}`;
}
