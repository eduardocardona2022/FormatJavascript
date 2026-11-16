import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  MAX_SOURCE_BYTES: z.coerce.number().int().min(1_024).max(10_485_760).default(1_048_576),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(120),
  RATE_LIMIT_WINDOW: z.string().min(1).default('1 minute'),
  FORMAT_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
  FORMATTER_MAX_THREADS: z.coerce.number().int().min(1).max(16).default(2),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  WEB_DIST_PATH: z.string().min(1).optional(),
});

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  readonly maxSourceBytes: number;
  readonly rateLimitMax: number;
  readonly rateLimitWindow: string;
  readonly formatTimeoutMs: number;
  readonly formatterMaxThreads: number;
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  readonly trustProxy: boolean;
  readonly webDistPath?: string;
}

/**
 * Carga `.env` desde el directorio actual o desde la raíz del monorepo. Se
 * llama antes de `loadConfig`; no sobreescribe variables ya definidas por el
 * sistema (Node conserva la precedencia del entorno).
 */
export function loadEnvFiles(cwd = process.cwd()): void {
  const candidates = [resolve(cwd, '.env'), resolve(cwd, '../../.env')];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración de entorno inválida: ${details}`);
  }

  const data = parsed.data;

  return {
    nodeEnv: data.NODE_ENV,
    host: data.HOST,
    port: data.PORT,
    maxSourceBytes: data.MAX_SOURCE_BYTES,
    rateLimitMax: data.RATE_LIMIT_MAX,
    rateLimitWindow: data.RATE_LIMIT_WINDOW,
    formatTimeoutMs: data.FORMAT_TIMEOUT_MS,
    formatterMaxThreads: data.FORMATTER_MAX_THREADS,
    logLevel: data.LOG_LEVEL,
    trustProxy: data.TRUST_PROXY,
    ...(data.WEB_DIST_PATH ? { webDistPath: data.WEB_DIST_PATH } : {}),
  };
}

/**
 * Busca el build del frontend en las ubicaciones habituales, tanto si el
 * servidor se ejecuta desde la raíz como desde `apps/api`.
 */
export function resolveWebDistPath(config: AppConfig): string | undefined {
  if (config.webDistPath) {
    return existsSync(resolve(config.webDistPath, 'index.html')) ? config.webDistPath : undefined;
  }

  const candidates = [
    resolve(process.cwd(), 'apps/web/dist'),
    resolve(process.cwd(), '../web/dist'),
    resolve(process.cwd(), 'web/dist'),
  ];

  return candidates.find((candidate) => existsSync(resolve(candidate, 'index.html')));
}
