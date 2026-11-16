import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_SOURCE_BYTES } from '@formatjs/shared';
import type { FormatResponse } from '@formatjs/shared/schemas';
import type { FastifyInstance } from 'fastify';
import { FormatSourceUseCase } from '../../src/application/use-cases/format-source.use-case';
import {
  FormatSyntaxError,
  FormatTimeoutError,
  FormatterUnavailableError,
} from '../../src/domain/errors';
import type {
  CodeFormatRequest,
  CodeFormatResult,
  CodeFormatterPort,
} from '../../src/domain/ports/code-formatter.port';
import { loadConfig } from '../../src/infrastructure/config/env';
import { buildServer } from '../../src/interfaces/http/build-server';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

const formatter: CodeFormatterPort = {
  async format(request: CodeFormatRequest): Promise<CodeFormatResult> {
    if (request.source.includes('SYNTAX_ERROR')) {
      throw new FormatSyntaxError('Unexpected token', { line: 2, column: 5 });
    }
    if (request.source.includes('INTERNAL_ERROR')) {
      throw new Error('mensaje secreto que no debe salir');
    }
    if (request.source.includes('UNAVAILABLE_ERROR')) {
      throw new FormatterUnavailableError();
    }
    if (request.source.includes('TIMEOUT_ERROR')) {
      throw new FormatTimeoutError(5_000);
    }
    return { formatted: `${request.source.trimEnd()}\n` };
  },
};

async function createTestApp(overrides: Record<string, string> = {}): Promise<FastifyInstance> {
  const config = loadConfig({
    NODE_ENV: 'test',
    RATE_LIMIT_MAX: '1000',
    ...overrides,
  });

  return buildServer({
    config,
    dependencies: { formatSource: new FormatSourceUseCase(formatter) },
  });
}

async function postFormat(app: FastifyInstance, body: unknown, contentType = 'application/json') {
  return app.inject({
    method: 'POST',
    url: '/api/format',
    headers: { 'content-type': contentType },
    payload: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('API HTTP', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde el health check', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>().status).toBe('ok');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('formatea una petición válida', async () => {
    const response = await postFormat(app, {
      fileName: 'app.ts',
      source: 'const x:number=1;',
      options: { printWidth: 100, semi: false },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<FormatResponse>();
    expect(body.language).toBe('typescript');
    expect(body.formatted).toBe('const x:number=1;\n');
    expect(body.stats.inputLines).toBe(1);
    expect(body.stats.outputLines).toBe(1);
    expect(body.stats.durationMs).toBeGreaterThanOrEqual(0);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('rechaza extensiones no soportadas con 415', async () => {
    const response = await postFormat(app, {
      fileName: 'notas.txt',
      source: 'hola',
    });

    expect(response.statusCode).toBe(415);
    expect(response.json<ErrorBody>().error.code).toBe('UNSUPPORTED_LANGUAGE');
  });

  it('rechaza nombres con rutas con 400', async () => {
    const response = await postFormat(app, {
      fileName: '../app.js',
      source: 'const x = 1;',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<ErrorBody>().error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza opciones desconocidas con 400', async () => {
    const response = await postFormat(app, {
      fileName: 'app.js',
      source: 'const x = 1;',
      options: { parser: 'babel' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<ErrorBody>().error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza contenido vacío con 400', async () => {
    const response = await postFormat(app, {
      fileName: 'app.js',
      source: '',
    });

    expect(response.statusCode).toBe(400);
  });

  it('rechaza cuerpos JSON malformados con 400', async () => {
    const response = await postFormat(app, '{"fileName":');
    expect(response.statusCode).toBe(400);
    expect(response.json<ErrorBody>().error.code).toBe('BAD_REQUEST');
  });

  it('rechaza content-types no soportados con 415', async () => {
    const response = await postFormat(app, 'const x = 1;', 'text/plain');
    expect(response.statusCode).toBe(415);
    expect(response.json<ErrorBody>().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rechaza contenidos mayores a 1 MiB con 413', async () => {
    const response = await postFormat(app, {
      fileName: 'app.js',
      source: 'a'.repeat(MAX_SOURCE_BYTES + 1),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json<ErrorBody>().error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('devuelve 422 con línea y columna para errores de sintaxis', async () => {
    const response = await postFormat(app, {
      fileName: 'app.js',
      source: 'SYNTAX_ERROR',
    });

    expect(response.statusCode).toBe(422);
    const body = response.json<ErrorBody>();
    expect(body.error.code).toBe('SYNTAX_ERROR');
    expect(body.error.details).toMatchObject({ line: 2, column: 5 });
  });

  it('devuelve 503 si el formateador no está disponible', async () => {
    const response = await postFormat(app, {
      fileName: 'app.js',
      source: 'UNAVAILABLE_ERROR',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json<ErrorBody>().error.code).toBe('FORMATTER_UNAVAILABLE');
  });

  it('devuelve 504 si el formateo agota el tiempo', async () => {
    const response = await postFormat(app, {
      fileName: 'app.js',
      source: 'TIMEOUT_ERROR',
    });

    expect(response.statusCode).toBe(504);
    expect(response.json<ErrorBody>().error.code).toBe('FORMAT_TIMEOUT');
  });

  it('oculta los detalles de errores internos', async () => {
    const response = await postFormat(app, {
      fileName: 'app.js',
      source: 'INTERNAL_ERROR',
    });

    expect(response.statusCode).toBe(500);
    const body = response.json<ErrorBody>();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('mensaje secreto');
  });

  it('devuelve 404 JSON para rutas de API desconocidas', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/desconocida' });
    expect(response.statusCode).toBe(404);
    expect(response.json<ErrorBody>().error.code).toBe('NOT_FOUND');
  });

  it('aplica rate limiting por ruta', async () => {
    const limitedApp = await createTestApp({ RATE_LIMIT_MAX: '1' });

    try {
      const first = await postFormat(limitedApp, {
        fileName: 'app.js',
        source: 'const x = 1;',
      });
      const second = await postFormat(limitedApp, {
        fileName: 'app.js',
        source: 'const x = 2;',
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(429);
      expect(second.json<ErrorBody>().error.code).toBe('RATE_LIMITED');
    } finally {
      await limitedApp.close();
    }
  });
});
