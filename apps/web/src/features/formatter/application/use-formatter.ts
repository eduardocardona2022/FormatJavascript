import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FORMAT_OPTIONS,
  MAX_SOURCE_BYTES,
  SUPPORTED_EXTENSIONS_LABEL,
  buildSnippetFileName,
  detectLanguage,
  getApplicableOptions,
  getExportFileName,
  getLanguageDefinition,
  sanitizeFileName,
  type FormatOptions,
  type FormatStats,
  type LanguageId,
} from '@formatjs/shared';
import { ApiError, formatSource as requestFormat } from '@/lib/api-client';
import { copyTextToClipboard } from '@/lib/clipboard';
import type {
  FormatterError,
  FormatterInputMode,
  FormatterStatus,
  UseFormatterResult,
} from '../domain/types';

/**
 * Estado y casos de uso del formateador. La presentación no conoce fetch, el
 * portapapeles ni los detalles del contrato: solo consume este hook.
 */
export function useFormatter(): UseFormatterResult {
  const [source, setSourceState] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [language, setLanguageState] = useState<LanguageId>('javascript');
  const [isFileMode, setIsFileMode] = useState(false);
  const [settings, setSettings] = useState<FormatOptions>({ ...DEFAULT_FORMAT_OPTIONS });
  const [formatted, setFormatted] = useState<string | null>(null);
  const [stats, setStats] = useState<FormatStats | null>(null);
  const [error, setError] = useState<FormatterError | null>(null);
  const [status, setStatus] = useState<FormatterStatus>('idle');
  const [inputVersion, setInputVersion] = useState(0);
  const [lastFormattedVersion, setLastFormattedVersion] = useState<number | null>(null);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const loadIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearOutput = useCallback(() => {
    setFormatted(null);
    setStats(null);
    setLastFormattedVersion(null);
  }, []);

  /**
   * Invalida peticiones en vuelo y marca el resultado actual como
   * desactualizado. Se llama ante cualquier cambio de entrada u opciones.
   */
  const markInputChanged = useCallback(() => {
    requestIdRef.current += 1;
    setInputVersion((version) => version + 1);
    setStatus('idle');
    setError(null);
  }, []);

  const setSource = useCallback(
    (value: string) => {
      setSourceState(value);
      markInputChanged();

      if (value.length === 0) {
        setIsFileMode(false);
        setFileName('');
        setFileSize(null);
        clearOutput();
        return;
      }

      if (!isFileMode && fileName.length === 0) {
        setFileName(buildSnippetFileName(language));
      }
    },
    [clearOutput, fileName, isFileMode, language, markInputChanged],
  );

  const loadFile = useCallback(
    async (file: File) => {
      const loadId = ++loadIdRef.current;
      const detected = detectLanguage(file.name);

      if (!detected) {
        setError({
          code: 'UNSUPPORTED_LANGUAGE',
          message: `Extensión no soportada. Formatos disponibles: ${SUPPORTED_EXTENSIONS_LABEL}.`,
        });
        return;
      }

      if (file.size > MAX_SOURCE_BYTES) {
        setError({
          code: 'PAYLOAD_TOO_LARGE',
          message: 'El archivo supera el límite de 1 MB.',
        });
        return;
      }

      if (file.size === 0) {
        setError({
          code: 'EMPTY_SOURCE',
          message: 'El archivo está vacío.',
        });
        return;
      }

      let text: string;

      try {
        text = await file.text();
      } catch {
        if (loadId === loadIdRef.current && mountedRef.current) {
          setError({
            code: 'READ_ERROR',
            message: 'No se pudo leer el archivo. Inténtalo de nuevo.',
          });
        }
        return;
      }

      if (loadId !== loadIdRef.current || !mountedRef.current) {
        return;
      }

      if (text.trim().length === 0) {
        setError({
          code: 'EMPTY_SOURCE',
          message: 'El archivo no contiene código.',
        });
        return;
      }

      markInputChanged();
      setIsFileMode(true);
      setFileName(sanitizeFileName(file.name));
      setFileSize(file.size);
      setLanguageState(detected);
      setSourceState(text);
      clearOutput();
    },
    [clearOutput, markInputChanged],
  );

  const selectLanguage = useCallback(
    (nextLanguage: LanguageId) => {
      if (isFileMode) {
        return;
      }

      setLanguageState(nextLanguage);
      setFileName(buildSnippetFileName(nextLanguage));
      markInputChanged();
      clearOutput();
    },
    [clearOutput, isFileMode, markInputChanged],
  );

  const updateSetting = useCallback(
    <K extends keyof FormatOptions>(key: K, value: FormatOptions[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
      markInputChanged();
    },
    [markInputChanged],
  );

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_FORMAT_OPTIONS });
    markInputChanged();
  }, [markInputChanged]);

  const format = useCallback(async () => {
    if (source.trim().length === 0) {
      setError({
        code: 'EMPTY_SOURCE',
        message: 'Carga un archivo o pega código antes de formatear.',
      });
      return;
    }

    const requestId = ++requestIdRef.current;
    const versionAtStart = inputVersion;
    const requestFileName = fileName || buildSnippetFileName(language);
    const options = getApplicableOptions(language, settings);

    setStatus('loading');
    setError(null);

    try {
      const response = await requestFormat({
        fileName: requestFileName,
        source,
        options,
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setFormatted(response.formatted);
      setStats(response.stats);
      setLastFormattedVersion(versionAtStart);
    } catch (caught) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setError(toFormatterError(caught));
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setStatus('idle');
      }
    }
  }, [fileName, inputVersion, language, settings, source]);

  const copy = useCallback(async () => {
    if (!formatted) {
      throw new Error('No hay resultado para copiar.');
    }

    await copyTextToClipboard(formatted);
  }, [formatted]);

  const download = useCallback(() => {
    if (!formatted) {
      return;
    }

    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getExportFileName(fileName || buildSnippetFileName(language));
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [fileName, formatted, language]);

  const clear = useCallback(() => {
    loadIdRef.current += 1;
    markInputChanged();
    setSourceState('');
    setFileName('');
    setFileSize(null);
    setIsFileMode(false);
    setLanguageState('javascript');
    clearOutput();
  }, [clearOutput, markInputChanged]);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const mode: FormatterInputMode = isFileMode ? 'file' : source.length > 0 ? 'paste' : 'empty';

  const isStale = formatted !== null && lastFormattedVersion !== inputVersion;

  return {
    source,
    formatted,
    fileName,
    fileSize,
    language,
    languageDefinition: getLanguageDefinition(language),
    mode,
    status,
    error,
    stats,
    settings,
    isStale,
    canFormat: source.trim().length > 0 && status !== 'loading',
    canExport: formatted !== null,
    isFileMode,
    setSource,
    loadFile,
    selectLanguage,
    updateSetting,
    resetSettings,
    format,
    copy,
    download,
    clear,
    dismissError,
  };
}

function toFormatterError(error: unknown): FormatterError {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.line !== undefined ? { line: error.line } : {}),
      ...(error.column !== undefined ? { column: error.column } : {}),
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
  };
}
