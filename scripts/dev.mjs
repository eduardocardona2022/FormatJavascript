import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runDirectory = resolve(root, '.run');
const pidFile = resolve(runDirectory, 'dev.json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
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

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const { child } of children) {
    killTree(child.pid);
  }

  await rm(pidFile, { force: true }).catch(() => undefined);
  process.exit(exitCode);
}

function start(name, args) {
  const child = spawn(npmCommand, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    detached: process.platform !== 'win32',
    // En Windows los archivos .cmd necesitan ejecutarse a través de cmd.exe.
    shell: process.platform === 'win32',
  });

  child.on('error', (error) => {
    console.error(`[${name}] No se pudo iniciar: ${error.message}`);
    void shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.error(
      `[${name}] terminó inesperadamente (código: ${code ?? 'null'}, señal: ${signal ?? 'null'}).`,
    );
    void shutdown(code && code > 0 ? code : 1);
  });

  children.push({ name, child });
  return child;
}

async function main() {
  await mkdir(runDirectory, { recursive: true });

  const api = start('api', ['run', 'dev:api']);
  const web = start('web', ['run', 'dev:web']);

  await writeFile(
    pidFile,
    JSON.stringify(
      {
        root,
        supervisorPid: process.pid,
        apiPid: api.pid ?? null,
        webPid: web.pid ?? null,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log('API:  http://127.0.0.1:3000');
  console.log('Web:  http://127.0.0.1:5173');
  console.log('Pulsa Ctrl+C en esta ventana para detener ambos procesos.');
}

process.on('SIGINT', () => {
  void shutdown(0);
});
process.on('SIGTERM', () => {
  void shutdown(0);
});

await main();
