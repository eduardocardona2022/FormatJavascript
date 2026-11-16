import { format } from 'prettier/standalone';
import * as babelPlugin from 'prettier/plugins/babel';
import * as estreePlugin from 'prettier/plugins/estree';
import * as htmlPlugin from 'prettier/plugins/html';
import * as markdownPlugin from 'prettier/plugins/markdown';
import * as postcssPlugin from 'prettier/plugins/postcss';
import * as typescriptPlugin from 'prettier/plugins/typescript';
import * as yamlPlugin from 'prettier/plugins/yaml';
import {
  FormatSyntaxError,
  FormatTimeoutError,
  FormatterUnavailableError,
} from '../../domain/errors';
import type {
  CodeFormatRequest,
  CodeFormatResult,
  CodeFormatterPort,
} from '../../domain/ports/code-formatter.port';
import { PARSER_BY_LANGUAGE, toPrettierOptions } from './prettier-options';

/**
 * Prettier standalone y todos sus parsers se importan de forma estática. Esto
 * permite empaquetar la función serverless sin depender de archivos que se
 * resuelvan en tiempo de ejecución, como el worker de Piscina.
 */
const PLUGINS = [
  babelPlugin,
  estreePlugin,
  htmlPlugin,
  markdownPlugin,
  postcssPlugin,
  typescriptPlugin,
  yamlPlugin,
];

interface InlinePrettierFormatterOptions {
  readonly timeoutMs: number;
}

/**
 * Adaptador para entornos serverless (Vercel), donde los worker threads y los
 * archivos auxiliares del pool no son una opción fiable. Prettier se ejecuta en
 * el mismo proceso y el timeout es cooperativo: la respuesta se corta, aunque
 * el trabajo de CPU en curso no se puede cancelar.
 */
export class InlinePrettierFormatter implements CodeFormatterPort {
  private readonly timeoutMs: number;

  constructor(options: InlinePrettierFormatterOptions) {
    this.timeoutMs = options.timeoutMs;
  }

  async format(request: CodeFormatRequest): Promise<CodeFormatResult> {
    const parser = PARSER_BY_LANGUAGE[request.language];

    try {
      const formatted = await withTimeout(
        format(request.source, {
          ...toPrettierOptions(request.language, request.options),
          parser,
          filepath: request.fileName,
          plugins: PLUGINS,
        }),
        this.timeoutMs,
      );

      return { formatted };
    } catch (error) {
      if (error instanceof FormatTimeoutError) {
        throw error;
      }

      const serialized = serializeError(error);

      if (serialized.syntax) {
        throw new FormatSyntaxError(serialized.message, {
          ...(serialized.line !== undefined ? { line: serialized.line } : {}),
          ...(serialized.column !== undefined ? { column: serialized.column } : {}),
          language: request.language,
        });
      }

      throw new FormatterUnavailableError();
    }
  }

  async close(): Promise<void> {
    // Sin recursos externos que liberar.
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new FormatTimeoutError(timeoutMs)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}

interface SerializedError {
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly syntax: boolean;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Extrae línea y columna de los distintos formatos de error de los parsers.
 */
function extractLocation(error: unknown): { line?: number; column?: number } {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const loc = record.loc;

    if (loc && typeof loc === 'object') {
      const locRecord = loc as Record<string, unknown>;
      const start = locRecord.start;

      if (start && typeof start === 'object') {
        const startRecord = start as Record<string, unknown>;
        const line = finiteNumber(startRecord.line);
        const column = finiteNumber(startRecord.column);
        if (line !== undefined) {
          return { line, ...(column !== undefined ? { column } : {}) };
        }
      }

      const line = finiteNumber(locRecord.line);
      const column = finiteNumber(locRecord.column);
      if (line !== undefined) {
        return { line, ...(column !== undefined ? { column } : {}) };
      }
    }

    const line = finiteNumber(record.line) ?? finiteNumber(record.lineNumber);
    const column = finiteNumber(record.column) ?? finiteNumber(record.columnNumber);
    if (line !== undefined) {
      return { line, ...(column !== undefined ? { column } : {}) };
    }

    if (typeof record.message === 'string') {
      const match = /\((\d+):(\d+)\)/.exec(record.message);
      if (match) {
        return { line: Number(match[1]), column: Number(match[2]) };
      }
    }
  }

  return {};
}

function looksLikeSyntaxError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.toLowerCase() : '';
  const code = typeof record.code === 'string' ? record.code.toLowerCase() : '';
  const location = extractLocation(error);

  return (
    location.line !== undefined ||
    name.includes('syntax') ||
    name.includes('parse') ||
    code.includes('syntax') ||
    code.includes('parse')
  );
}

function serializeError(error: unknown): SerializedError {
  const fallback: SerializedError = {
    message: 'No se pudo analizar el código.',
    syntax: false,
  };

  if (!(error instanceof Error)) {
    return fallback;
  }

  const firstLine = error.message.split('\n')[0]?.trim().slice(0, 500);
  const message = firstLine && firstLine.length > 0 ? firstLine : fallback.message;

  return {
    message,
    ...extractLocation(error),
    syntax: looksLikeSyntaxError(error),
  };
}
