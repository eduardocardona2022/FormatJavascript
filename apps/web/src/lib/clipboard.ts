/**
 * Copia texto al portapapeles con un fallback para navegadores antiguos o
 * contextos sin Clipboard API. Lanza un error si no es posible copiar.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('El portapapeles no está disponible.');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;

  textarea.remove();

  if (!copied) {
    throw new Error('No se pudo copiar al portapapeles.');
  }
}
