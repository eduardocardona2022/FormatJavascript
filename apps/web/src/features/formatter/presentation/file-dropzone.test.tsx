import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LANGUAGES } from '@formatjs/shared';
import { formatFileSize } from '@/lib/format';
import { FileDropzone } from './file-dropzone';

const file = new File(['const x = 1;'], 'app.js', { type: 'text/javascript' });

function renderDropzone(overrides: Partial<Parameters<typeof FileDropzone>[0]> = {}) {
  const props = {
    fileName: '',
    fileSize: null,
    language: LANGUAGES.javascript,
    isFileMode: false,
    onFile: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };

  return { ...render(<FileDropzone {...props} />), props };
}

describe('FileDropzone', () => {
  it('muestra la zona de carga con formatos y límite', () => {
    renderDropzone();

    expect(
      screen.getByRole('button', { name: 'Seleccionar archivo de código' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Formatos:/)).toBeInTheDocument();
    expect(screen.getByText(/Máximo 1 MB/)).toBeInTheDocument();
  });

  it('entrega el archivo seleccionado', async () => {
    const { container, props } = renderDropzone();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    expect(input).not.toBeNull();
    if (input) {
      await userEvent.upload(input, file);
    }

    expect(props.onFile).toHaveBeenCalledWith(file);
  });

  it('muestra el archivo cargado y permite limpiarlo', async () => {
    const { props } = renderDropzone({
      fileName: 'app.js',
      fileSize: 1_234,
      isFileMode: true,
    });

    expect(screen.getByText('app.js')).toBeInTheDocument();
    expect(screen.getByText(/1.2 KB/)).toBeInTheDocument();
    expect(screen.getAllByText('JavaScript').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Quitar archivo y limpiar' }));

    expect(props.onClear).toHaveBeenCalled();
  });

  it('formatea tamaños legibles', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1_024)).toBe('1.0 KB');
    expect(formatFileSize(1_048_576)).toBe('1.00 MB');
  });
});
