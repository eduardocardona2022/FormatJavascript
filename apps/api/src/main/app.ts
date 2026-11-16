import type { FastifyInstance } from 'fastify';
import { FormatSourceUseCase } from '../application/use-cases/format-source.use-case';
import type { CodeFormatterPort } from '../domain/ports/code-formatter.port';
import { loadConfig, type AppConfig } from '../infrastructure/config/env';
import { PrettierFormatter } from '../infrastructure/formatter/prettier.formatter';
import { InlinePrettierFormatter } from '../infrastructure/formatter/prettier-inline.formatter';
import { buildServer } from '../interfaces/http/build-server';

interface FormatterRuntime extends CodeFormatterPort {
  close(): Promise<void>;
}

export interface CreateApplicationOptions {
  /**
   * En Vercel no se usan worker threads ni se sirve el frontend desde Fastify:
   * el CDN de Vercel se encarga de los estáticos y `/api/*` llega a la función.
   */
  readonly serverless?: boolean;
}

export interface ApplicationRuntime {
  readonly app: FastifyInstance;
  readonly config: AppConfig;
  readonly formatter: FormatterRuntime;
  close(): Promise<void>;
}

/**
 * Composition root compartido por el servidor local y la función serverless.
 */
export async function createApplication(
  options: CreateApplicationOptions = {},
): Promise<ApplicationRuntime> {
  const serverless = options.serverless ?? process.env.VERCEL === '1';
  const config = loadConfig();

  const formatter: FormatterRuntime = serverless
    ? new InlinePrettierFormatter({ timeoutMs: config.formatTimeoutMs })
    : new PrettierFormatter({
        maxThreads: config.formatterMaxThreads,
        timeoutMs: config.formatTimeoutMs,
      });

  const formatSource = new FormatSourceUseCase(formatter);
  const app = await buildServer({
    config,
    dependencies: { formatSource },
    serveStatic: !serverless,
  });

  await app.ready();

  return {
    app,
    config,
    formatter,
    async close() {
      try {
        await app.close();
      } finally {
        await formatter.close();
      }
    },
  };
}
