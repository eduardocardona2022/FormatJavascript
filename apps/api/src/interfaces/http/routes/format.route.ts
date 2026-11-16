import type { FastifyInstance } from 'fastify';
import { formatRequestSchema, toValidationDetails } from '@formatjs/shared/schemas';
import type { FormatSourceUseCase } from '../../../application/use-cases/format-source.use-case';
import { ValidationError } from '../../../domain/errors';
import type { AppConfig } from '../../../infrastructure/config/env';

export interface FormatRouteOptions {
  readonly formatSource: Pick<FormatSourceUseCase, 'execute'>;
  readonly config: AppConfig;
}

export async function registerFormatRoute(
  app: FastifyInstance,
  options: FormatRouteOptions,
): Promise<void> {
  app.post(
    '/api/format',
    {
      config: {
        rateLimit: {
          max: options.config.rateLimitMax,
          timeWindow: options.config.rateLimitWindow,
        },
      },
    },
    async (request, reply) => {
      const contentType = request.headers['content-type'] ?? '';
      const mediaType = contentType.split(';')[0]?.trim().toLowerCase();

      if (mediaType !== 'application/json') {
        return reply.status(415).send({
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'El contenido debe enviarse como application/json.',
          },
        });
      }

      const parsed = formatRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        throw new ValidationError('La petición no es válida.', toValidationDetails(parsed.error));
      }

      const result = await options.formatSource.execute(parsed.data);
      return reply.status(200).send(result);
    },
  );
}
