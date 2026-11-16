import { copyFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  // El paquete compartido se distribuye como TypeScript fuente dentro del
  // monorepo, por lo que debe empaquetarse en el build de producción.
  noExternal: ['@formatjs/shared'],
  onSuccess: async () => {
    await copyFile(
      'src/infrastructure/formatter/formatter.worker.mjs',
      'dist/formatter.worker.mjs',
    );
  },
});
