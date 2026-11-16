import { fileURLToPath } from 'node:url';
import Piscina from 'piscina';
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
