import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORTS = [3000, 5173];
const currentFile = fileURLToPath(import.meta.url);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePath(value) {
  return value.replaceAll('\\', '/').toLowerCase();
}

function readPidFiles(root) {
  const files = [resolve(root, '.run', 'dev.json'), resolve(root, '.run', 'prod.json')];
  const trustedPids = new Set();
  const warnings = [];

  for (const file of files) {
    if (!existsSync(file)) {
      continue;
    }

    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));

      if (data.root && normalizePath(data.root) !== normalizePath(root)) {
        warnings.push(`Se ignoró ${file} porque pertenece a otro directorio.`);
        continue;
      }

      for (const value of [data.supervisorPid, data.apiPid, data.webPid, data.pid]) {
        if (Number.isInteger(value) && value > 0) {
          trustedPids.add(value);
        }
      }
    } catch {
      warnings.push(`No se pudo leer ${file}.`);
    }
  }

  return { trustedPids, warnings };
}

function getListeningPids() {
  const pids = new Set();

  if (process.platform === 'win32') {
    try {
      const script = `Get-NetTCPConnection -LocalPort ${PORTS.join(',')} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`;
      const output = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { encoding: 'utf8', windowsHide: true },
      );

      for (const line of output.split(/\r?\n/)) {
        const pid = Number(line.trim());
        if (Number.isInteger(pid) && pid > 0) {
          pids.add(pid);
        }
      }
    } catch {
      // Sin PowerShell no se pueden descubrir procesos por puerto.
    }

    return pids;
  }

  for (const port of PORTS) {
    try {
      const output = execFileSync('lsof', ['-ti', `:${port}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      for (const line of output.split(/\r?\n/)) {
        const pid = Number(line.trim());
        if (Number.isInteger(pid) && pid > 0) {
          pids.add(pid);
        }
      }
    } catch {
      // lsof no está disponible o el puerto no está escuchando.
    }
  }

  return pids;
}

function getCommandLine(pid) {
  if (process.platform === 'win32') {
    try {
      const script = `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`;
      const output = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { encoding: 'utf8', windowsHide: true },
      );
      return output.trim();
    } catch {
      return '';
    }
  }

  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\u0000', ' ');
  } catch {
    try {
      return execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
        encoding: 'utf8',
      }).trim();
    } catch {
      return '';
    }
  }
}

function belongsToProject(pid, root) {
  const commandLine = normalizePath(getCommandLine(pid));

  if (commandLine.length === 0) {
    return false;
  }

  return commandLine.includes(normalizePath(root)) || commandLine.includes('formatjavascript');
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killTree(pid) {
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return result.status === 0;
  }

  try {
    process.kill(-pid, 'SIGTERM');
    return true;
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
      return true;
    } catch {
      return false;
    }
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(500, () => finish(false));
  });
}

async function anyPortOpen() {
  const results = await Promise.all(PORTS.map((port) => isPortOpen(port)));
  return results.some(Boolean);
}

/**
 * Detiene los procesos de desarrollo y producción del proyecto. Solo elimina
 * PIDs leídos de `.run` o procesos cuyos argumentos apuntan al proyecto, para
 * no matar servicios ajenos que casualmente usen los mismos puertos.
 */
export async function stopApp(root = resolve(dirname(currentFile), '..')) {
  const { trustedPids, warnings } = readPidFiles(root);
  const portPids = getListeningPids();
  const candidates = new Set([...trustedPids, ...portPids]);
  const killedPids = [];

  for (const pid of candidates) {
    if (!isProcessAlive(pid)) {
      continue;
    }

    const trusted = trustedPids.has(pid);
    if (!trusted && !belongsToProject(pid, root)) {
      warnings.push(
        `Se omitió el PID ${pid} porque no pertenece a este proyecto. Deténlo manualmente si es necesario.`,
      );
      continue;
    }

    if (killTree(pid)) {
      killedPids.push(pid);
    } else {
      warnings.push(`No se pudo detener el PID ${pid}.`);
    }
  }

  for (const file of [resolve(root, '.run', 'dev.json'), resolve(root, '.run', 'prod.json')]) {
    await rm(file, { force: true }).catch(() => undefined);
  }

  if (candidates.size === 0) {
    return { stopped: true, wasRunning: false, killedPids, warnings };
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!(await anyPortOpen())) {
      return { stopped: true, wasRunning: killedPids.length > 0, killedPids, warnings };
    }
    await delay(250);
  }

  warnings.push('Los puertos 3000/5173 siguen abiertos después de detener los procesos.');
  return { stopped: false, wasRunning: true, killedPids, warnings };
}

const isMain =
  process.argv[1] && normalizePath(resolve(process.argv[1])) === normalizePath(currentFile);

if (isMain) {
  const result = await stopApp();

  for (const warning of result.warnings) {
    console.warn(`[aviso] ${warning}`);
  }

  if (!result.wasRunning) {
    console.log('La aplicación no estaba en ejecución.');
  } else if (result.stopped) {
    console.log(`Aplicación detenida (${result.killedPids.length} proceso(s)).`);
  }

  process.exit(result.stopped ? 0 : 1);
}
