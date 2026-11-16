export type ErrorDetails = Record<string, unknown>;

/**
 * Base de los errores de dominio. No conoce HTTP: la capa de interfaces es la
 * encargada de traducir cada tipo de error a un código de estado.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly details?: ErrorDetails;

  protected constructor(message: string, details?: ErrorDetails) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(message = 'La solicitud no es válida.', details?: ErrorDetails) {
    super(message, details);
  }
}

export class UnsupportedLanguageError extends DomainError {
  readonly code = 'UNSUPPORTED_LANGUAGE';

  constructor(fileName: string) {
    super(`La extensión del archivo "${fileName}" no está soportada.`, { fileName });
  }
}

export class SourceTooLargeError extends DomainError {
  readonly code = 'PAYLOAD_TOO_LARGE';

  constructor(sizeBytes: number, maxBytes: number) {
    super(`El contenido supera el límite de ${maxBytes} bytes.`, { sizeBytes, maxBytes });
  }
}

export class EmptySourceError extends DomainError {
  readonly code = 'EMPTY_SOURCE';

  constructor() {
    super('El contenido del archivo está vacío.');
  }
}

export class InvalidSourceError extends DomainError {
  readonly code = 'INVALID_SOURCE';

  constructor(message: string) {
    super(message);
  }
}

export class FormatSyntaxError extends DomainError {
  readonly code = 'SYNTAX_ERROR';

  constructor(message: string, details: ErrorDetails) {
    super(message, details);
  }
}

export class FormatTimeoutError extends DomainError {
  readonly code = 'FORMAT_TIMEOUT';

  constructor(timeoutMs: number) {
    super(`El formateo superó el tiempo máximo de ${timeoutMs} ms.`, { timeoutMs });
  }
}

export class FormatterUnavailableError extends DomainError {
  readonly code = 'FORMATTER_UNAVAILABLE';

  constructor() {
    super('El servicio de formateo no está disponible en este momento.');
  }
}
