import { describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './clipboard';

describe('copyTextToClipboard', () => {
  it('usa la Clipboard API cuando está disponible', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await copyTextToClipboard('hola');

    expect(writeText).toHaveBeenCalledWith('hola');
  });

  it('usa el fallback con execCommand', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    await copyTextToClipboard('hola');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('rechaza si el fallback no puede copiar', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    await expect(copyTextToClipboard('hola')).rejects.toThrow('No se pudo copiar al portapapeles.');
  });
});
