import { spawn } from 'node:child_process';

const urls = process.argv.includes('--prod')
  ? ['http://127.0.0.1:3000/api/health']
  : ['http://127.0.0.1:3000/api/health', 'http://127.0.0.1:5173'];

const shouldOpen = !process.argv.includes('--no-open') && process.env.FORMATJS_NO_OPEN !== '1';
const targetUrl = process.argv.includes('--prod')
  ? 'http://127.0.0.1:3000'
  : 'http://127.0.0.1:5173';
const timeoutMs = 90_000;
const intervalMs = 500;
const startedAt = Date.now();

async function isReady(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(1_500),
      headers: { accept: 'text/html,application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForAll() {
  while (Date.now() - startedAt < timeoutMs) {
    const results = await Promise.all(urls.map((url) => isReady(url)));

    if (results.every(Boolean)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/d', '/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }

  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
}

console.log('Esperando a que la aplicación esté lista…');

if (await waitForAll()) {
  console.log(`Aplicación disponible en ${targetUrl}`);

  if (shouldOpen) {
    openBrowser(targetUrl);
  }

  process.exit(0);
}

console.error(`La aplicación no respondió en ${Math.round(timeoutMs / 1_000)} segundos.`);
console.error('Revisa la ventana de la aplicación o ejecuta "npm run dev" manualmente.');
process.exit(1);
