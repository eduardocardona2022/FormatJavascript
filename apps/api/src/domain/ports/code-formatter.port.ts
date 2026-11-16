import type { FormatOptions, LanguageId } from '@formatjs/shared';

export interface CodeFormatRequest {
  readonly source: string;
  readonly fileName: string;
  readonly language: LanguageId;
  readonly options: FormatOptions;
}

export interface CodeFormatResult {
  readonly formatted: string;
}

/**
 * Puerto de dominio para el motor de formato. Cualquier implementación
 * (Prettier, un fake de pruebas o un futuro motor alternativo) debe cumplirlo.
 */
export interface CodeFormatterPort {
  format(request: CodeFormatRequest): Promise<CodeFormatResult>;
}
