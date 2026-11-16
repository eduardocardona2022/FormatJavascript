import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SOURCE_BYTES } from '@formatjs/shared';
import type { FormatResponse } from '@formatjs/shared/schemas';
import { useFormatter } from './use-formatter';

const apiMocks = vi.hoisted(() => ({
  formatSource: vi.fn(),
}));

const clipboardMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return { ...actual, formatSource: apiMocks.formatSource };
});

vi.mock('@/lib/clipboard', () => ({
  copyTextToClipboard: clipboardMock,
}));

function fakeFile(name: string, content: string, size?: number): File {
  return {
    name,
    size: size ?? new Blob([content]).size,
    text: () => Promise.resolve(content),
  } as unknown as File;
}

const successResponse: FormatResponse = {
  formatted: 'const x = 1;\n',
  language: 'javascript',
  stats: { inputLines: 1, outputLines: 1, durationMs: 5 },
};

beforeEach(() => {
  apiMocks.formatSource.mockReset();
  clipboardMock.mockReset();
  clipboardMock.mockResolvedValue(undefined);
});

describe('useFormatter', () => {
  it('inicia en modo vacío y con valores por defecto', () => {
    const { result } = renderHook(() => useFormatter());

    expect(result.current.mode).toBe('empty');
    expect(result.current.language).toBe('javascript');
    expect(result.current.settings.printWidth).toBe(80);
    expect(result.current.canFormat).toBe(false);
    expect(result.current.canExport).toBe(false);
    expect(result.current.formatted).toBeNull();
  });

  it('convierte a modo pegado al escribir y asigna un nombre de archivo', () => {
    const { result } = renderHook(() => useFormatter());

    act(() => {
      result.current.setSource('const x = 1;');
    });

    expect(result.current.mode).toBe('paste');
    expect(result.current.fileName).toBe('snippet.js');
    expect(result.current.canFormat).toBe(true);
  });

  it('cambia de lenguaje y nombre en modo pegado', () => {
    const { result } = renderHook(() => useFormatter());

    act(() => {
      result.current.selectLanguage('markdown');
    });

    expect(result.current.language).toBe('markdown');
    expect(result.current.fileName).toBe('snippet.md');
    expect(result.current.mode).toBe('empty');
  });

  it('carga un archivo válido', async () => {
    const { result } = renderHook(() => useFormatter());
    const file = fakeFile('component.tsx', 'const App = () => <div />;');

    await act(async () => {
      await result.current.loadFile(file);
    });

    expect(result.current.mode).toBe('file');
    expect(result.current.fileName).toBe('component.tsx');
    expect(result.current.language).toBe('typescript-tsx');
    expect(result.current.source).toContain('const App');
    expect(result.current.fileSize).toBe(file.size);
    expect(result.current.canFormat).toBe(true);
  });

  it('rechaza extensiones no soportadas', async () => {
    const { result } = renderHook(() => useFormatter());

    await act(async () => {
      await result.current.loadFile(fakeFile('notas.txt', 'hola'));
    });

    expect(result.current.error?.code).toBe('UNSUPPORTED_LANGUAGE');
    expect(result.current.source).toBe('');
  });

  it('rechaza archivos demasiado grandes', async () => {
    const { result } = renderHook(() => useFormatter());

    await act(async () => {
      await result.current.loadFile(fakeFile('app.js', 'x', MAX_SOURCE_BYTES + 1));
    });

    expect(result.current.error?.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rechaza archivos vacíos', async () => {
    const { result } = renderHook(() => useFormatter());

    await act(async () => {
      await result.current.loadFile(fakeFile('app.js', '', 0));
    });

    expect(result.current.error?.code).toBe('EMPTY_SOURCE');
  });

  it('gestiona errores de lectura', async () => {
    const { result } = renderHook(() => useFormatter());
    const file = {
      name: 'app.js',
      size: 10,
      text: () => Promise.reject(new Error('lectura fallida')),
    } as unknown as File;

    await act(async () => {
      await result.current.loadFile(file);
    });

    expect(result.current.error?.code).toBe('READ_ERROR');
  });

  it('formatea y filtra las opciones según el lenguaje', async () => {
    apiMocks.formatSource.mockResolvedValue(successResponse);
    const { result } = renderHook(() => useFormatter());

    act(() => {
      result.current.setSource('const x=1;');
    });

    await act(async () => {
      await result.current.format();
    });

    expect(apiMocks.formatSource).toHaveBeenCalledWith({
      fileName: 'snippet.js',
      source: 'const x=1;',
      options: expect.objectContaining({
        printWidth: 80,
        semi: true,
        singleQuote: false,
        trailingComma: 'all',
      }),
    });
    const request = apiMocks.formatSource.mock.calls[0]?.[0] as {
      options: Record<string, unknown>;
    };
    expect(request.options).not.toHaveProperty('proseWrap');
    expect(result.current.formatted).toBe('const x = 1;\n');
    expect(result.current.stats).toEqual(successResponse.stats);
    expect(result.current.status).toBe('idle');
    expect(result.current.canExport).toBe(true);
  });

  it('muestra errores de la API con línea y columna', async () => {
    const { ApiError } = await import('@/lib/api-client');
    apiMocks.formatSource.mockRejectedValue(
      new ApiError('SYNTAX_ERROR', 'Unexpected token', { line: 2, column: 5 }),
    );
    const { result } = renderHook(() => useFormatter());

    act(() => {
      result.current.setSource('const x = ;');
    });

    await act(async () => {
      await result.current.format();
    });

    expect(result.current.error).toMatchObject({
      code: 'SYNTAX_ERROR',
      message: 'Unexpected token',
      line: 2,
      column: 5,
    });
    expect(result.current.formatted).toBeNull();
  });

  it('no llama a la API si no hay contenido', async () => {
    const { result } = renderHook(() => useFormatter());

    await act(async () => {
      await result.current.format();
    });

    expect(result.current.error?.code).toBe('EMPTY_SOURCE');
    expect(apiMocks.formatSource).not.toHaveBeenCalled();
  });

  it('marca el resultado como desactualizado al cambiar opciones', async () => {
    apiMocks.formatSource.mockResolvedValue(successResponse);
    const { result } = renderHook(() => useFormatter());

    act(() => {
      result.current.setSource('const x=1;');
    });
    await act(async () => {
      await result.current.format();
    });

    expect(result.current.isStale).toBe(false);

    act(() => {
      result.current.updateSetting('semi', false);
    });

    expect(result.current.isStale).toBe(true);
    expect(result.current.settings.semi).toBe(false);
  });

  it('marca el resultado como desactualizado al cambiar el código', async () => {
    apiMocks.formatSource.mockResolvedValue(successResponse);
    const { result } = renderHook(() => useFormatter());

    act(() => {
      result.current.setSource('const x=1;');
    });
    await act(async () => {
      await result.current.format();
    });

    act(() => {
      result.current.setSource('const y=2;');
    });

    expect(result.current.isStale).toBe(true);
  });

  it('copia el resultado al portapapeles', async () => {
    apiMocks.formatSource.mockResolvedValue(successResponse);
    const { result } = renderHook(() => useFormatter());

    act(() => {
      result.current.setSource('const x=1;');
    });
    await act(async () => {
      await result.current.format();
    });
    await act(async () => {
      await result.current.copy();
    });

    expect(clipboardMock).toHaveBeenCalledWith('const x = 1;\n');
  });

  it('rechaza copiar cuando no hay resultado', async () => {
    const { result } = renderHook(() => useFormatter());

    await expect(result.current.copy()).rejects.toThrow('No hay resultado para copiar.');
  });

  it('descarga el resultado con el nombre formateado', async () => {
    apiMocks.formatSource.mockResolvedValue(successResponse);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const { result } = renderHook(() => useFormatter());

    await act(async () => {
      await result.current.loadFile(fakeFile('app.ts', 'const x=1;'));
    });
    await act(async () => {
      await result.current.format();
    });
    act(() => {
      result.current.download();
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('limpia el estado y conserva las opciones', async () => {
    apiMocks.formatSource.mockResolvedValue(successResponse);
    const { result } = renderHook(() => useFormatter());

    act(() => {
      result.current.updateSetting('tabWidth', 4);
      result.current.setSource('const x=1;');
    });
    await act(async () => {
      await result.current.format();
    });
    act(() => {
      result.current.clear();
    });

    expect(result.current.source).toBe('');
    expect(result.current.fileName).toBe('');
    expect(result.current.mode).toBe('empty');
    expect(result.current.language).toBe('javascript');
    expect(result.current.formatted).toBeNull();
    expect(result.current.stats).toBeNull();
    expect(result.current.settings.tabWidth).toBe(4);
  });

  it('permite descartar errores', async () => {
    const { result } = renderHook(() => useFormatter());

    await act(async () => {
      await result.current.loadFile(fakeFile('notas.txt', 'hola'));
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.dismissError();
    });

    expect(result.current.error).toBeNull();
  });
});
