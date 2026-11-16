import { fileURLToPath } from 'node:url';
import Piscina from 'piscina';
import type { FormatOptions, LanguageId } from '@formatjs/shared';
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

interface WorkerSuccess {
  ok: true;
  formatted: string;
}

interface WorkerFailure {
  ok: false;
  error: {
    message: string;
    line?: number;
    column?: number;
    syntax: boolean;
  };
}

type WorkerResult = WorkerSuccess | WorkerFailure;

interface PrettierFormatterOptions {
  readonly maxThreads: number;
  readonly timeoutMs: number;
  /** Permite inyectar el worker en pruebas sin depender de la ruta del build. */
  readonly filename?: string;
}

const PARSER_BY_LANGUAGE = {
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
 * Adaptador de infraestructura. Prettier es CPU-bound y síncrono, por lo que
 * se ejecuta en un pool de workers y nunca bloquea el event loop de Fastify.
 */
export class PrettierFormatter implements CodeFormatterPort {
  private readonly pool: Piscina;
  private readonly timeoutMs: number;

  constructor(options: PrettierFormatterOptions) {
    const filename =
      options.filename ?? fileURLToPath(new URL('./formatter.worker.mjs', import.meta.url));

    this.timeoutMs = options.timeoutMs;
    this.pool = new Piscina({
      filename,
      minThreads: 1,
      maxThreads: options.maxThreads,
      idleTimeout: 30_000,
      maxQueue: 20,
      concurrentTasksPerWorker: 1,
    });
  }

  async format(request: CodeFormatRequest): Promise<CodeFormatResult> {
    const parser = PARSER_BY_LANGUAGE[request.language];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const result = (await this.pool.run(
        {
          source: request.source,
          parser,
          filepath: request.fileName,
          options: toPrettierOptions(request.language, request.options),
        },
        { signal: controller.signal },
      )) as WorkerResult;

      if (!result.ok) {
        if (result.error.syntax) {
          throw new FormatSyntaxError(result.error.message, {
            ...(result.error.line !== undefined ? { line: result.error.line } : {}),
            ...(result.error.column !== undefined ? { column: result.error.column } : {}),
            language: request.language,
          });
        }

        throw new FormatterUnavailableError();
      }

      return { formatted: result.formatted };
    } catch (error) {
      if (error instanceof FormatSyntaxError || error instanceof FormatterUnavailableError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new FormatTimeoutError(this.timeoutMs);
      }

      throw new FormatterUnavailableError();
    } finally {
      clearTimeout(timeout);
    }
  }

  async close(): Promise<void> {
    await this.pool.destroy();
  }
}

/**
 * Solo se envían las opciones que cada lenguaje soporta. No se hace spread del
 * objeto recibido para evitar propiedades no deseadas (prototype pollution).
 */
function toPrettierOptions(language: LanguageId, options: FormatOptions): Record<string, unknown> {
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
