import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormatRequest } from '@formatjs/shared/schemas';
import { ApiError, formatSource } from './api-client';

const request: FormatRequest = {
  fileName: 'app.ts',
  source: 'const x:number=1;',
  options: { printWidth: 100, semi: false },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const successBody = {
  formatted: 'const x: number = 1;\n',
  language: 'typescript',
  stats: { inputLines: 1, outputLines: 1, durationMs: 12 },
};

describe('formatSource', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useRealTimers();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía la petición y valida la respuesta', async () => {
    fetchMock.mockResolvedValue(jsonResponse(successBody));

    const response = await formatSource(request);

    expect(response).toEqual(successBody);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) return;

    expect(call[0]).toBe('/api/format');
    const init = call[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(request);
  });

  it('propaga errores estructurados de la API', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'SYNTAX_ERROR',
            message: 'Unexpected token',
            details: { line: 2, column: 5 },
          },
        },
        422,
      ),
    );

    try {
      await formatSource(request);
      expect.fail('La promesa debía rechazarse');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe('SYNTAX_ERROR');
      expect(apiError.message).toBe('Unexpected token');
      expect(apiError.line).toBe(2);
      expect(apiError.column).toBe(5);
    }
  });

  it('rechaza respuestas correctas con contrato inválido', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ foo: 'bar' }));

    await expect(formatSource(request)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('genera un error HTTP si el cuerpo de error no es válido', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }));

    await expect(formatSource(request)).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      message: 'El servidor respondió con el código 502.',
    });
  });

  it('mapea fallos de red', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(formatSource(request)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('cancela la petición al superar el timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    try {
      const assertion = expect(formatSource(request)).rejects.toMatchObject({
        code: 'TIMEOUT',
      });
      await vi.advanceTimersByTimeAsync(15_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
