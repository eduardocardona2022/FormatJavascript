import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../../domain/errors';

function statusForDomainError(error: DomainError): number {
  switch (error.code) {
    case 'PAYLOAD_TOO_LARGE':
      return 413;
    case 'UNSUPPORTED_LANGUAGE':
      return 415;
    case 'SYNTAX_ERROR':
      return 422;
    case 'FORMAT_TIMEOUT':
      return 504;
    case 'FORMATTER_UNAVAILABLE':
      return 503;
    default:
      return 400;
  }
}

/**
 * Traduce errores de dominio y errores de Fastify a un contrato estable. Los
 * errores inesperados nunca exponen stack ni mensajes internos al cliente.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (
      error: Error & { statusCode?: number; code?: string },
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      if (error instanceof DomainError) {
        const statusCode = statusForDomainError(error);

        if (statusCode >= 500) {
          request.log.error({ err: error }, 'Error de dominio');
        }

        return reply.status(statusCode).send({
          error: {
            code: error.code,
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
          },
        });
      }

      const statusCode =
        typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;

      if (statusCode === 413) {
        return reply.status(413).send({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'La petición excede el tamaño máximo permitido.',
          },
        });
      }

      if (statusCode === 415) {
        return reply.status(415).send({
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'El contenido debe enviarse como application/json.',
          },
        });
      }

      if (statusCode === 429) {
        return reply.status(429).send({
          error: {
            code: 'RATE_LIMITED',
            message: 'Demasiadas solicitudes. Espera un momento antes de reintentar.',
          },
        });
      }

      if (statusCode >= 400 && statusCode < 500) {
        return reply.status(statusCode).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'La petición no es válida.',
          },
        });
      }

      request.log.error({ err: error }, 'Error inesperado');
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Ocurrió un error interno.',
        },
      });
    },
  );
}
