import { format } from 'prettier';

/**
 * Worker de Prettier. La comunicación se hace con objetos planos para no
 * depender de la serialización de errores entre hilos.
 *
 * @typedef {Object} FormatTask
 * @property {string} source
 * @property {string} parser
 * @property {string} filepath
 * @property {Record<string, unknown>} options
 *
 * @typedef {Object} WorkerError
 * @property {string} message
 * @property {number} [line]
 * @property {number} [column]
 * @property {boolean} syntax
 */

/** @param {unknown} value */
function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Extrae línea y columna de los distintos formatos de error de los parsers.
 * @param {unknown} error
 * @returns {{ line?: number; column?: number }}
 */
function extractLocation(error) {
  if (error && typeof error === 'object') {
    const loc = /** @type {Record<string, unknown>} */ (error).loc;

    if (loc && typeof loc === 'object') {
      const start = /** @type {Record<string, unknown>} */ (loc).start;

      if (start && typeof start === 'object') {
        const line = finiteNumber(/** @type {Record<string, unknown>} */ (start).line);
        const column = finiteNumber(/** @type {Record<string, unknown>} */ (start).column);
        if (line !== undefined) {
          return { line, ...(column !== undefined ? { column } : {}) };
        }
      }

      const line = finiteNumber(/** @type {Record<string, unknown>} */ (loc).line);
      const column = finiteNumber(/** @type {Record<string, unknown>} */ (loc).column);
      if (line !== undefined) {
        return { line, ...(column !== undefined ? { column } : {}) };
      }
    }

    const record = /** @type {Record<string, unknown>} */ (error);
    const line = finiteNumber(record.line) ?? finiteNumber(record.lineNumber);
    const column = finiteNumber(record.column) ?? finiteNumber(record.columnNumber);
    if (line !== undefined) {
      return { line, ...(column !== undefined ? { column } : {}) };
    }

    if (typeof record.message === 'string') {
      const match = /\((\d+):(\d+)\)/.exec(record.message);
      if (match) {
        return { line: Number(match[1]), column: Number(match[2]) };
      }
    }
  }

  return {};
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function looksLikeSyntaxError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = /** @type {Record<string, unknown>} */ (error);
  const name = typeof record.name === 'string' ? record.name.toLowerCase() : '';
  const code = typeof record.code === 'string' ? record.code.toLowerCase() : '';
  const location = extractLocation(error);

  return (
    location.line !== undefined ||
    name.includes('syntax') ||
    name.includes('parse') ||
    code.includes('syntax') ||
    code.includes('parse')
  );
}

/**
 * @param {unknown} error
 * @returns {WorkerError}
 */
function serializeError(error) {
  const fallback = { message: 'No se pudo analizar el código.', syntax: false };

  if (!(error instanceof Error)) {
    return fallback;
  }

  const firstLine = error.message.split('\n')[0]?.trim().slice(0, 500);
  const message = firstLine && firstLine.length > 0 ? firstLine : fallback.message;
  const location = extractLocation(error);

  return {
    message,
    ...location,
    syntax: looksLikeSyntaxError(error),
  };
}

/**
 * @param {FormatTask} task
 * @returns {Promise<{ ok: true; formatted: string } | { ok: false; error: WorkerError }>}
 */
export default async function formatTask(task) {
  try {
    const formatted = await format(task.source, {
      ...task.options,
      parser: task.parser,
      filepath: task.filepath,
    });

    return { ok: true, formatted };
  } catch (error) {
    return { ok: false, error: serializeError(error) };
  }
}
