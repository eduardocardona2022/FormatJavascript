import {
  LANGUAGE_IDS,
  LANGUAGES,
  getLanguageDefinition,
  isLanguageId,
  type FormatOptions,
  type LanguageId,
} from '@formatjs/shared';
import { LoaderCircle, Lock, Trash2, WandSparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import type { FormatterStatus } from '../domain/types';
import { FormatOptionsPanel } from './format-options-panel';

interface FormatToolbarProps {
  readonly language: LanguageId;
  readonly isFileMode: boolean;
  readonly canFormat: boolean;
  readonly canClear: boolean;
  readonly status: FormatterStatus;
  readonly settings: FormatOptions;
  readonly onLanguageChange: (language: LanguageId) => void;
  readonly onFormat: () => void;
  readonly onClear: () => void;
  readonly onSettingChange: <K extends keyof FormatOptions>(
    key: K,
    value: FormatOptions[K],
  ) => void;
  readonly onResetSettings: () => void;
}

function KeyboardHint() {
  return (
    <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Ctrl/⌘</kbd>
      <span>+</span>
      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
    </span>
  );
}

export function FormatToolbar({
  language,
  isFileMode,
  canFormat,
  canClear,
  status,
  settings,
  onLanguageChange,
  onFormat,
  onClear,
  onSettingChange,
  onResetSettings,
}: FormatToolbarProps) {
  const definition = getLanguageDefinition(language);
  const isLoading = status === 'loading';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isFileMode ? (
        <Badge
          variant="secondary"
          className="h-8 px-2.5"
          title="El lenguaje se deduce de la extensión del archivo"
        >
          <Lock className="size-3" aria-hidden="true" />
          {definition.label}
        </Badge>
      ) : (
        <div className="w-[180px]">
          <NativeSelect
            aria-label="Lenguaje"
            value={language}
            onChange={(event) => {
              const next = event.target.value;
              if (isLanguageId(next)) {
                onLanguageChange(next);
              }
            }}
          >
            {LANGUAGE_IDS.map((id) => (
              <option key={id} value={id}>
                {LANGUAGES[id].label}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <FormatOptionsPanel
        settings={settings}
        language={language}
        onChange={onSettingChange}
        onReset={onResetSettings}
      />

      <div className="ml-auto flex items-center gap-2">
        <KeyboardHint />
        <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={!canClear}>
          <Trash2 />
          Limpiar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onFormat}
          disabled={!canFormat}
          title="Formatear (Ctrl/Cmd + Enter)"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <WandSparkles aria-hidden="true" />
          )}
          {isLoading ? 'Formateando…' : 'Formatear'}
        </Button>
      </div>
    </div>
  );
}
