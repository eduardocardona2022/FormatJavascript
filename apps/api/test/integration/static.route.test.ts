import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { FormatSourceUseCase } from '../../src/application/use-cases/format-source.use-case';
import type { CodeFormatterPort } from '../../src/domain/ports/code-formatter.port';
import { loadConfig } from '../../src/infrastructure/config/env';
import { buildServer } from '../../src/interfaces/http/build-server';

const formatter: CodeFormatterPort = {
  async format() {
    return { formatted: 'const x = 1;\n' };
  },
};

describe('servidor de producción', () => {
  let app: FastifyInstance;
  let webDist: string;

  beforeAll(async () => {
    webDist = await mkdtemp(join(tmpdir(), 'formatjs-web-'));
    await mkdir(join(webDist, 'assets'), { recursive: true });
    await writeFile(
      join(webDist, 'index.html'),
      '<!doctype html><html><body><div id="root"></div></body></html>',
      'utf8',
    );
    await writeFile(join(webDist, 'assets', 'app.js'), 'console.log("ok");', 'utf8');

    const config = loadConfig({
      NODE_ENV: 'production',
      WEB_DIST_PATH: webDist,
      RATE_LIMIT_MAX: '1000',
      LOG_LEVEL: 'silent',
    });

    app = await buildServer({
      config,
      dependencies: { formatSource: new FormatSourceUseCase(formatter) },
    });
  });

  afterAll(async () => {
    await app.close();
    await rm(webDist, { recursive: true, force: true });
  });

  it('sirve el index con CSP y sin caché', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
      headers: { accept: 'text/html' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('id="root"');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).toContain("'unsafe-inline'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('cachea de forma inmutable los assets con hash', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/assets/app.js',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('hace fallback a index.html solo para navegación HTML', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ruta/cliente',
      headers: { accept: 'text/html' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('id="root"');
  });

  it('no devuelve HTML para assets inexistentes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/assets/no-existe.js',
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
  });

  it('mantiene el 404 JSON para la API', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/no-existe',
      headers: { accept: 'text/html' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('NOT_FOUND');
  });
});
