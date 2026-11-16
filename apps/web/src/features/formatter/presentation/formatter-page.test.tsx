import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/app/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FormatterPage } from './formatter-page';

const formatterMock = vi.hoisted(() => {
  const format = vi.fn().mockResolvedValue(undefined);

  return {
    format,
    state: {
      source: 'const x = 1;',
      formatted: null as string | null,
      fileName: 'snippet.js',
      fileSize: null as number | null,
      language: 'javascript' as 'javascript' | 'typescript',
      languageDefinition: {
        id: 'javascript',
        label: 'JavaScript',
        extension: '.js',
        description: 'JavaScript',
        options: [],
      } as {
        id: 'javascript' | 'typescript';
        label: string;
        extension: string;
        description: string;
        options: [];
      },
      mode: 'paste' as const,
      status: 'idle' as const,
      error: null as { code: string; message: string; line?: number; column?: number } | null,
      stats: null as { inputLines: number; outputLines: number; durationMs: number } | null,
      settings: {
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        endOfLine: 'lf' as const,
        semi: true,
        singleQuote: false,
        trailingComma: 'all' as const,
        bracketSpacing: true,
        arrowParens: 'always' as const,
        proseWrap: 'preserve' as const,
      },
      isStale: false,
      canFormat: true,
      canExport: false,
      isFileMode: false,
      setSource: vi.fn(),
      loadFile: vi.fn().mockResolvedValue(undefined),
      selectLanguage: vi.fn(),
      updateSetting: vi.fn(),
      resetSettings: vi.fn(),
      format,
      copy: vi.fn().mockResolvedValue(undefined),
      download: vi.fn(),
      clear: vi.fn(),
      dismissError: vi.fn(),
    },
  };
});

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../application/use-formatter', () => ({
  useFormatter: () => formatterMock.state,
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

function renderPage() {
  return render(
    <ThemeProvider>
      <TooltipProvider>
        <FormatterPage />
      </TooltipProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  formatterMock.state.source = 'const x = 1;';
  formatterMock.state.formatted = null;
  formatterMock.state.canExport = false;
  formatterMock.state.error = null;
  formatterMock.state.isFileMode = false;
  formatterMock.state.language = 'javascript';
  formatterMock.state.languageDefinition = {
    id: 'javascript',
    label: 'JavaScript',
    extension: '.js',
    description: 'JavaScript',
    options: [],
  };
  formatterMock.state.stats = null;
  formatterMock.format.mockResolvedValue(undefined);
  formatterMock.state.copy.mockResolvedValue(undefined);
});

describe('FormatterPage', () => {
  it('renderiza la estructura principal', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Formatea tu código/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Formatear/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir opciones de formato' })).toBeInTheDocument();
    expect(screen.getByLabelText('Lenguaje')).toBeInTheDocument();
    expect(await screen.findByLabelText('Editor de código de entrada')).toBeInTheDocument();
  });

  it('formatea al pulsar el botón', async () => {
    renderPage();
    await screen.findByLabelText('Editor de código de entrada');

    await userEvent.click(screen.getByRole('button', { name: /Formatear/ }));

    expect(formatterMock.format).toHaveBeenCalledTimes(1);
  });

  it('formatea con Ctrl/Cmd + Enter', async () => {
    renderPage();
    await screen.findByLabelText('Editor de código de entrada');

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    expect(formatterMock.format).toHaveBeenCalledTimes(1);
  });

  it('copia el resultado y muestra un aviso', async () => {
    formatterMock.state.formatted = 'const x = 1;\n';
    formatterMock.state.canExport = true;
    formatterMock.state.stats = { inputLines: 1, outputLines: 1, durationMs: 4 };
    renderPage();
    await screen.findByLabelText('Código formateado');

    await userEvent.click(screen.getByRole('button', { name: /Copiar/ }));

    await waitFor(() => {
      expect(formatterMock.state.copy).toHaveBeenCalled();
    });
    expect(toastMock.success).toHaveBeenCalledWith('Código copiado al portapapeles');
  });

  it('descarga el resultado y muestra un aviso', async () => {
    formatterMock.state.formatted = 'const x = 1;\n';
    formatterMock.state.canExport = true;
    renderPage();
    await screen.findByLabelText('Código formateado');

    await userEvent.click(screen.getByRole('button', { name: /Descargar/ }));

    expect(formatterMock.state.download).toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith('Archivo descargado');
  });

  it('muestra errores con línea y columna', async () => {
    formatterMock.state.error = {
      code: 'SYNTAX_ERROR',
      message: 'Unexpected token',
      line: 2,
      column: 5,
    };
    renderPage();
    await screen.findByLabelText('Editor de código de entrada');

    expect(screen.getByRole('alert')).toHaveTextContent('El código tiene un error de sintaxis');
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 2, columna 5');
  });

  it('bloquea el selector de lenguaje en modo archivo', async () => {
    formatterMock.state.isFileMode = true;
    formatterMock.state.fileName = 'app.ts';
    formatterMock.state.language = 'typescript';
    formatterMock.state.languageDefinition = {
      id: 'typescript',
      label: 'TypeScript',
      extension: '.ts',
      description: 'TypeScript',
      options: [],
    };
    renderPage();
    await screen.findByLabelText('Editor de código de entrada');

    expect(screen.queryByLabelText('Lenguaje')).not.toBeInTheDocument();
    expect(screen.getAllByText('TypeScript').length).toBeGreaterThan(0);
  });
});
