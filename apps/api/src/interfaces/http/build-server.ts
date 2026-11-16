import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { FormatSourceUseCase } from '../../application/use-cases/format-source.use-case';
import type { AppConfig } from '../../infrastructure/config/env';
import { resolveWebDistPath } from '../../infrastructure/config/env';
import { registerErrorHandler } from './error-handler';
import { registerFormatRoute } from './routes/format.route';
import { registerHealthRoute } from './routes/health.route';

export interface ServerDependencies {
  readonly formatSource: Pick<FormatSourceUseCase, 'execute'>;
}

export interface BuildServerOptions {
  readonly config: AppConfig;
  readonly dependencies: ServerDependencies;
}

function buildContentSecurityPolicy() {
  return {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      // CodeMirror inyecta estilos en tiempo de ejecución. Se documenta como
      // riesgo aceptado en vulnerabilidad.md.
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': null,
    },
  };
}

/**
 * Composition root de la capa HTTP. Recibe el caso de uso ya construido para
 * poder sustituirlo por un fake en las pruebas de integración.
 */
export async function buildServer({
  config,
  dependencies,
}: BuildServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.nodeEnv === 'test'
        ? false
        : {
            level: config.logLevel,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
    bodyLimit: Math.max(config.maxSourceBytes * 2, 2 * 1024 * 1024),
    trustProxy: config.trustProxy,
  });

  // Debe registrarse antes de las rutas y plugins para que todos los contextos
  // hereden el manejador normalizado de errores.
  registerErrorHandler(app);

  await app.register(helmet, {
    contentSecurityPolicy: config.nodeEnv === 'production' ? buildContentSecurityPolicy() : false,
    hsts: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(compress, { global: true, threshold: 1_024 });
  await app.register(rateLimit, { global: false });

  await registerHealthRoute(app);
  await registerFormatRoute(app, {
    formatSource: dependencies.formatSource,
    config,
  });

  const webDist = config.nodeEnv === 'production' ? resolveWebDistPath(config) : undefined;

  if (config.nodeEnv === 'production' && !webDist) {
    app.log.warn(
      'No se encontró el build del frontend. Ejecuta "npm run build" antes de iniciar producción.',
    );
  }

  if (webDist) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
      wildcard: false,
      index: ['index.html'],
      dotfiles: 'deny',
      cacheControl: false,
      decorateReply: true,
      setHeaders: (response, filePath) => {
        const normalized = filePath.replaceAll('\\', '/');
        response.header(
          'Cache-Control',
          normalized.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Ruta no encontrada.',
        },
      });
    }

    const acceptsHtml = request.headers.accept?.includes('text/html') ?? false;
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const looksLikeAsset = /\.[a-z0-9]+$/i.test(pathname);

    if (
      webDist &&
      !looksLikeAsset &&
      acceptsHtml &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      return reply.sendFile('index.html');
    }

    return reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Ruta no encontrada.',
      },
    });
  });

  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store');
    }
  });

  return app;
}
