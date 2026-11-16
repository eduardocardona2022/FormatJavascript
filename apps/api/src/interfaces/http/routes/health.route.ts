import type { FastifyInstance } from 'fastify';

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  });
}
