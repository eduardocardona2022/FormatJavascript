import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig, resolveWebDistPath } from '../../../src/infrastructure/config/env';

describe('configuración de entorno', () => {
  it('aplica valores por defecto seguros', () => {
    const config = loadConfig({ NODE_ENV: 'test' });

    expect(config.nodeEnv).toBe('test');
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3000);
    expect(config.maxSourceBytes).toBe(1_048_576);
    expect(config.rateLimitMax).toBe(120);
    expect(config.formatTimeoutMs).toBe(5_000);
    expect(config.formatterMaxThreads).toBe(2);
    expect(config.trustProxy).toBe(false);
  });

  it('convierte TRUST_PROXY a booleano', () => {
    expect(loadConfig({ TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(loadConfig({ TRUST_PROXY: 'false' }).trustProxy).toBe(false);
  });

  it('rechaza variables inválidas', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/Configuración de entorno inválida/);
    expect(() => loadConfig({ NODE_ENV: 'staging' })).toThrow(/Configuración de entorno inválida/);
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/Configuración de entorno inválida/);
  });

  it('resuelve la ruta del build del frontend', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'formatjs-dist-'));
    await writeFile(join(directory, 'index.html'), '<html></html>', 'utf8');

    try {
      const config = loadConfig({ NODE_ENV: 'production', WEB_DIST_PATH: directory });
      expect(resolveWebDistPath(config)).toBe(directory);

      const missing = loadConfig({ WEB_DIST_PATH: join(directory, 'no-existe') });
      expect(resolveWebDistPath(missing)).toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
