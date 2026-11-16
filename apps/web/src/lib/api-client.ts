import {
  apiErrorSchema,
  formatResponseSchema,
  type FormatRequest,
  type FormatResponse,
} from '@formatjs/shared/schemas';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }

  get line(): number | undefined {
    const value = this.details?.line;
    return typeof value === 'number' ? value : undefined;
  }

  get column(): number | undefined {
    const value = this.details?.column;
    return typeof value === 'number' ? value : undefined;
  }
}

/**
 * Cliente HTTP tipado. Valida la respuesta del servidor con los mismos
 * schemas Zod que usa el backend para detectar contratos rotos.
 */
export async function formatSource(request: FormatRequest): Promise<FormatResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${API_BASE}/format`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError('TIMEOUT', 'La solicitud tardó demasiado. Inténtalo de nuevo.');
    }

    throw new ApiError(
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor. Verifica que la API esté en ejecución.',
    );
  } finally {
    clearTimeout(timeout);
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(payload);

    if (parsedError.success) {
      throw new ApiError(
        parsedError.data.error.code,
        parsedError.data.error.message,
        parsedError.data.error.details,
      );
    }

    throw new ApiError('HTTP_ERROR', `El servidor respondió con el código ${response.status}.`);
  }

  const parsedResponse = formatResponseSchema.safeParse(payload);

  if (!parsedResponse.success) {
    throw new ApiError(
      'INVALID_RESPONSE',
      'El servidor devolvió una respuesta con un formato no válido.',
    );
  }

  return parsedResponse.data;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
