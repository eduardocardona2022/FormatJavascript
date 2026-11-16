import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApplication, type ApplicationRuntime } from './main/app';

// Vercel define NODE_ENV=production, pero no dependemos de ello para que la
// función arranque con la configuración segura si se ejecuta en otro entorno.
process.env.NODE_ENV ??= 'production';

let runtimePromise: Promise<ApplicationRuntime> | undefined;

function getRuntime(): Promise<ApplicationRuntime> {
  runtimePromise ??= createApplication({ serverless: true });
  return runtimePromise;
}

/**
 * Entrada de la función serverless de Vercel.
 *
 * Fastify se construye una sola vez por instancia y se reutiliza entre
 * peticiones. `server.emit('request')` entrega la petición HTTP nativa de
 * Vercel al enrutador de Fastify.
 */
export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const runtime = await getRuntime();
    await runtime.app.ready();
    runtime.app.server.emit('request', request, response);
  } catch (error) {
    console.error('No se pudo inicializar la función serverless.', error);

    if (response.headersSent) {
      response.end();
      return;
    }

    response.statusCode = 500;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Ocurrió un error interno.',
        },
      }),
    );
  }
}
