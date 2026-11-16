import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApplicationRuntime } from '../../src/main/app';
import { createApplication } from '../../src/main/app';

describe('aplicación serverless', () => {
  let runtime: ApplicationRuntime;

  beforeAll(async () => {
    runtime = await createApplication({ serverless: true });
  });

  afterAll(async () => {
    await runtime.close();
  });

  it('responde el health check', async () => {
    const response = await runtime.app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>().status).toBe('ok');
  });

  it('formatea con Prettier en proceso', async () => {
    const response = await runtime.app.inject({
      method: 'POST',
      url: '/api/format',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        fileName: 'app.ts',
        source: 'const saludo:string="hola";console.log(saludo)',
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ formatted: string }>().formatted).toBe(
      'const saludo: string = "hola";\nconsole.log(saludo);\n',
    );
  });

  it('no sirve el frontend desde la función', async () => {
    const response = await runtime.app.inject({
      method: 'GET',
      url: '/',
      headers: { accept: 'text/html' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
  });
});
