import { copyFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/main/server.ts',
    serverless: 'src/serverless.ts',
  },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  // El paquete compartido se distribuye como TypeScript fuente dentro del
  // monorepo. Prettier se empaqueta en la entrada serverless para que Vercel no
  // tenga que resolver sus parsers en tiempo de ejecución.
  noExternal: ['@formatjs/shared', 'prettier'],
  onSuccess: async () => {
    await copyFile(
      'src/infrastructure/formatter/formatter.worker.mjs',
      'dist/formatter.worker.mjs',
    );
  },
});
