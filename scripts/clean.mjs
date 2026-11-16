import { existsSync } from 'node:fs';
import { lstat, readdir, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stopApp } from './stop.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

function formatBytes(bytes) {
  if (bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1_024)), units.length - 1);
  const value = bytes / 1_024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

async function measure(target) {
  try {
    const stats = await lstat(target);

    if (stats.isSymbolicLink()) {
      return 0;
    }

    if (stats.isFile()) {
      return stats.size;
    }

    if (!stats.isDirectory()) {
      return 0;
    }

    const entries = await readdir(target, { withFileTypes: true });
    let total = 0;

    for (const entry of entries) {
      total += await measure(resolve(target, entry.name));
    }

    return total;
  } catch {
    return 0;
  }
}

async function collectTsBuildInfo() {
  const directories = [
    root,
    resolve(root, 'apps/api'),
    resolve(root, 'apps/web'),
    resolve(root, 'packages/shared'),
  ];
  const files = [];

  for (const directory of directories) {
    if (!existsSync(directory)) {
      continue;
    }

    try {
      const entries = await readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.tsbuildinfo')) {
          files.push(resolve(directory, entry.name));
        }
      }
    } catch {
      // Directorio inaccesible: se omite.
    }
  }

  return files;
}

const targets = new Set([
  resolve(root, 'node_modules'),
  resolve(root, 'apps/api/node_modules'),
  resolve(root, 'apps/web/node_modules'),
  resolve(root, 'packages/shared/node_modules'),
  resolve(root, 'apps/api/dist'),
  resolve(root, 'apps/web/dist'),
  resolve(root, 'packages/shared/dist'),
  resolve(root, 'coverage'),
  resolve(root, 'apps/api/coverage'),
  resolve(root, 'apps/web/coverage'),
  resolve(root, 'packages/shared/coverage'),
  resolve(root, 'apps/web/.vite'),
  resolve(root, '.run'),
  ...(await collectTsBuildInfo()),
]);

const existing = [];

for (const target of targets) {
  if (existsSync(target)) {
    existing.push({ path: target, size: await measure(target) });
  }
}

if (existing.length === 0) {
  console.log('No hay carpetas ni archivos generados que eliminar.');
  process.exit(0);
}

existing.sort((a, b) => b.size - a.size);

const totalBytes = existing.reduce((total, item) => total + item.size, 0);

console.log('Se eliminarán los siguientes elementos generados:');
for (const item of existing) {
  console.log(`  - ${relative(root, item.path)} (${formatBytes(item.size)})`);
}
console.log(`\nEspacio estimado a liberar: ${formatBytes(totalBytes)}`);

if (dryRun) {
  console.log('\nModo simulación: no se detuvo la aplicación ni se eliminó nada.');
  process.exit(0);
}

if (!force) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await readline.question('\n¿Eliminar estos elementos? [s/N] ');
  readline.close();

  if (!/^s(í|i)?$/i.test(answer.trim())) {
    console.log('Operación cancelada. No se modificó nada.');
    process.exit(0);
  }
}

console.log('\nDeteniendo la aplicación si está en ejecución…');
const stopResult = await stopApp(root);

for (const warning of stopResult.warnings) {
  console.warn(`[aviso] ${warning}`);
}

if (!stopResult.stopped) {
  console.error(
    'No se pudo detener la aplicación. Cierra las ventanas de la app e inténtalo de nuevo.',
  );
  process.exit(1);
}

console.log(
  stopResult.wasRunning
    ? `Aplicación detenida (${stopResult.killedPids.length} proceso(s)).`
    : 'La aplicación no estaba en ejecución.',
);

let freedBytes = 0;
const failures = [];

for (const item of existing) {
  try {
    await rm(item.path, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 500,
    });
    freedBytes += item.size;
    console.log(`✓ ${relative(root, item.path)}`);
  } catch (error) {
    failures.push({ path: relative(root, item.path), error });
    console.error(`✗ ${relative(root, item.path)}: ${error.message}`);
  }
}

console.log(`\nEspacio liberado: ${formatBytes(freedBytes)}`);

if (failures.length > 0) {
  console.error(`No se pudieron eliminar ${failures.length} elemento(s).`);
  process.exit(1);
}

console.log('Limpieza completada. Ejecuta init.bat para reinstalar y arrancar.');
