import type { FormatOptions, FormatStats, LanguageDefinition, LanguageId } from '@formatjs/shared';

export type FormatterInputMode = 'empty' | 'file' | 'paste';
export type FormatterStatus = 'idle' | 'loading';

export interface FormatterError {
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
}

export interface UseFormatterResult {
  readonly source: string;
  readonly formatted: string | null;
  readonly fileName: string;
  readonly fileSize: number | null;
  readonly language: LanguageId;
  readonly languageDefinition: LanguageDefinition;
  readonly mode: FormatterInputMode;
  readonly status: FormatterStatus;
  readonly error: FormatterError | null;
  readonly stats: FormatStats | null;
  readonly settings: FormatOptions;
  readonly isStale: boolean;
  readonly canFormat: boolean;
  readonly canExport: boolean;
  readonly isFileMode: boolean;
  readonly setSource: (value: string) => void;
  readonly loadFile: (file: File) => Promise<void>;
  readonly selectLanguage: (language: LanguageId) => void;
  readonly updateSetting: <K extends keyof FormatOptions>(key: K, value: FormatOptions[K]) => void;
  readonly resetSettings: () => void;
  readonly format: () => Promise<void>;
  readonly copy: () => Promise<void>;
  readonly download: () => void;
  readonly clear: () => void;
  readonly dismissError: () => void;
}
