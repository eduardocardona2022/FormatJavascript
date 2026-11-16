import { createApplication } from './app';
import { loadEnvFiles } from '../infrastructure/config/env';

async function main(): Promise<void> {
  loadEnvFiles();
  const runtime = await createApplication();
  const { app, config } = runtime;

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    app.log.info({ signal }, 'Cerrando servidor');
    await runtime.close();
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT').then(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM').then(() => process.exit(0));
  });

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error({ err: error }, 'No se pudo iniciar el servidor');
    await runtime.close();
    process.exitCode = 1;
  }
}

void main();
