/**
 * Lanza la API en modo producción. Existe para que el comando raíz `npm start`
 * funcione igual en Windows, macOS y Linux sin depender de scripts con `&&` o
 * de variables de entorno específicas de la shell.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runDirectory = resolve(root, '.run');
const pidFile = resolve(runDirectory, 'prod.json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

let child;
let shuttingDown = false;

function killTree(pid) {
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // El proceso ya no existe.
    }
  }
}

async function cleanup() {
  await rm(pidFile, { force: true }).catch(() => undefined);
}

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  killTree(child?.pid);
  await cleanup();
  process.exit(exitCode);
}

process.on('SIGINT', () => {
  void shutdown(0);
});
process.on('SIGTERM', () => {
  void shutdown(0);
});

await mkdir(runDirectory, { recursive: true });

child = spawn(npmCommand, ['run', 'start', '-w', '@formatjs/api'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
  detached: process.platform !== 'win32',
  // En Windows los archivos .cmd necesitan ejecutarse a través de cmd.exe.
  shell: process.platform === 'win32',
});

child.on('error', (error) => {
  console.error('No se pudo iniciar la API:', error.message);
  void cleanup().then(() => process.exit(1));
});

child.on('exit', (code, signal) => {
  if (shuttingDown) {
    return;
  }

  void cleanup().then(() => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
});

await writeFile(
  pidFile,
  JSON.stringify(
    {
      root,
      pid: child.pid ?? null,
      type: 'prod',
      startedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  'utf8',
);
