import {
  MAX_SOURCE_BYTES,
  baseName,
  detectLanguage,
  sanitizeFileName,
  type LanguageId,
} from '@formatjs/shared';
import {
  EmptySourceError,
  InvalidSourceError,
  SourceTooLargeError,
  UnsupportedLanguageError,
  ValidationError,
} from '../errors';

const MAX_FILE_NAME_LENGTH = 255;
const INVALID_FILE_NAME_CHARS = '<>:"/\\|?*';

function hasInvalidFileNameChars(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0);

    if (codePoint === undefined || codePoint < 0x20 || INVALID_FILE_NAME_CHARS.includes(char)) {
      return true;
    }
  }

  return false;
}

/**
 * Archivo de código validado. El nombre solo se usa como metadato y para
 * seleccionar el parser; nunca se escribe en disco.
 */
export class SourceFile {
  private constructor(
    readonly fileName: string,
    readonly source: string,
    readonly language: LanguageId,
    readonly sizeBytes: number,
  ) {}

  static create(fileName: string, source: string): SourceFile {
    const trimmedName = fileName.trim();

    if (trimmedName.length === 0) {
      throw new ValidationError('El nombre del archivo es obligatorio.', { field: 'fileName' });
    }

    const base = baseName(trimmedName);

    if (base !== trimmedName || base.includes('..')) {
      throw new ValidationError('El nombre del archivo no puede contener rutas.', {
        field: 'fileName',
      });
    }

    if (base.length > MAX_FILE_NAME_LENGTH) {
      throw new ValidationError('El nombre del archivo es demasiado largo.', {
        field: 'fileName',
      });
    }

    if (hasInvalidFileNameChars(base)) {
      throw new ValidationError('El nombre del archivo contiene caracteres no permitidos.', {
        field: 'fileName',
      });
    }

    const language = detectLanguage(base);

    if (!language) {
      throw new UnsupportedLanguageError(base);
    }

    if (source.trim().length === 0) {
      throw new EmptySourceError();
    }

    if (source.includes('\u0000')) {
      throw new InvalidSourceError('El contenido contiene caracteres nulos no permitidos.');
    }

    const sizeBytes = Buffer.byteLength(source, 'utf8');

    if (sizeBytes > MAX_SOURCE_BYTES) {
      throw new SourceTooLargeError(sizeBytes, MAX_SOURCE_BYTES);
    }

    return new SourceFile(sanitizeFileName(base), source, language, sizeBytes);
  }
}
