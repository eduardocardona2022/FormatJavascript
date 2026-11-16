import { FormatSourceUseCase } from '../application/use-cases/format-source.use-case';
import { loadConfig, loadEnvFiles } from '../infrastructure/config/env';
import { PrettierFormatter } from '../infrastructure/formatter/prettier.formatter';
import { buildServer } from '../interfaces/http/build-server';

async function main(): Promise<void> {
  loadEnvFiles();
  const config = loadConfig();
  const formatter = new PrettierFormatter({
    maxThreads: config.formatterMaxThreads,
    timeoutMs: config.formatTimeoutMs,
  });
  const formatSource = new FormatSourceUseCase(formatter);
  const app = await buildServer({ config, dependencies: { formatSource } });

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    app.log.info({ signal }, 'Cerrando servidor');
    await app.close();
    await formatter.close();
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
    await formatter.close();
    process.exitCode = 1;
  }
}

void main();
