import {
  getLanguageDefinition,
  type ArrowParens,
  type EndOfLine,
  type FormatOptionKey,
  type FormatOptions,
  type LanguageId,
  type ProseWrap,
  type TrailingComma,
} from '@formatjs/shared';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

type SettingsChange = <K extends keyof FormatOptions>(key: K, value: FormatOptions[K]) => void;

interface FormatOptionsFieldsProps {
  readonly settings: FormatOptions;
  readonly language: LanguageId;
  readonly onChange: SettingsChange;
}

interface FormatOptionsPanelProps extends FormatOptionsFieldsProps {
  readonly onReset: () => void;
}

const SECTION_TITLE_CLASS =
  'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

export function FormatOptionsFields({ settings, language, onChange }: FormatOptionsFieldsProps) {
  const definition = getLanguageDefinition(language);
  const supports = (key: FormatOptionKey): boolean => definition.options.includes(key);
  const hasScriptOptions =
    supports('semi') ||
    supports('singleQuote') ||
    supports('trailingComma') ||
    supports('bracketSpacing') ||
    supports('arrowParens');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="format-print-width">Ancho de línea</Label>
          <span className="text-xs tabular-nums text-muted-foreground">{settings.printWidth}</span>
        </div>
        <Slider
          id="format-print-width"
          aria-label="Ancho de línea"
          min={40}
          max={160}
          step={10}
          value={[settings.printWidth]}
          onValueChange={(values) => {
            const value = values[0];
            if (value !== undefined) {
              onChange('printWidth', value);
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Prettier intentará ajustar las líneas a este ancho aproximado.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="format-tab-width">Indentación</Label>
          <NativeSelect
            id="format-tab-width"
            aria-label="Indentación"
            value={settings.tabWidth}
            onChange={(event) => onChange('tabWidth', Number(event.target.value))}
          >
            <option value={2}>2 espacios</option>
            <option value={4}>4 espacios</option>
            <option value={8}>8 espacios</option>
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="format-end-of-line">Fin de línea</Label>
          <NativeSelect
            id="format-end-of-line"
            aria-label="Fin de línea"
            value={settings.endOfLine}
            onChange={(event) => onChange('endOfLine', event.target.value as EndOfLine)}
          >
            <option value="lf">LF (Unix)</option>
            <option value="crlf">CRLF (Windows)</option>
            <option value="auto">Auto</option>
          </NativeSelect>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="format-use-tabs">Usar tabulaciones</Label>
          <p className="text-xs text-muted-foreground">Indentar con tabs en lugar de espacios.</p>
        </div>
        <Switch
          id="format-use-tabs"
          checked={settings.useTabs}
          onCheckedChange={(checked) => onChange('useTabs', checked)}
          aria-label="Usar tabulaciones"
        />
      </div>

      {hasScriptOptions ? (
        <>
          <Separator />
          <div className="space-y-3">
            <p className={SECTION_TITLE_CLASS}>JavaScript / TypeScript</p>

            {supports('semi') ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="format-semi">Punto y coma</Label>
                  <p className="text-xs text-muted-foreground">
                    Añadir punto y coma al final de cada sentencia.
                  </p>
                </div>
                <Switch
                  id="format-semi"
                  checked={settings.semi}
                  onCheckedChange={(checked) => onChange('semi', checked)}
                  aria-label="Punto y coma"
                />
              </div>
            ) : null}

            {supports('singleQuote') ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="format-single-quote">Comillas simples</Label>
                  <p className="text-xs text-muted-foreground">
                    Preferir comillas simples en cadenas.
                  </p>
                </div>
                <Switch
                  id="format-single-quote"
                  checked={settings.singleQuote}
                  onCheckedChange={(checked) => onChange('singleQuote', checked)}
                  aria-label="Comillas simples"
                />
              </div>
            ) : null}

            {supports('trailingComma') ? (
              <div className="space-y-1.5">
                <Label htmlFor="format-trailing-comma">Comas finales</Label>
                <NativeSelect
                  id="format-trailing-comma"
                  aria-label="Comas finales"
                  value={settings.trailingComma}
                  onChange={(event) =>
                    onChange('trailingComma', event.target.value as TrailingComma)
                  }
                >
                  <option value="none">Ninguna</option>
                  <option value="es5">ES5</option>
                  <option value="all">Todas</option>
                </NativeSelect>
              </div>
            ) : null}

            {supports('bracketSpacing') ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="format-bracket-spacing">Espacios entre llaves</Label>
                  <p className="text-xs text-muted-foreground">
                    Escribir <code>{'{ foo: bar }'}</code> en objetos.
                  </p>
                </div>
                <Switch
                  id="format-bracket-spacing"
                  checked={settings.bracketSpacing}
                  onCheckedChange={(checked) => onChange('bracketSpacing', checked)}
                  aria-label="Espacios entre llaves"
                />
              </div>
            ) : null}

            {supports('arrowParens') ? (
              <div className="space-y-1.5">
                <Label htmlFor="format-arrow-parens">Paréntesis en arrow functions</Label>
                <NativeSelect
                  id="format-arrow-parens"
                  aria-label="Paréntesis en arrow functions"
                  value={settings.arrowParens}
                  onChange={(event) => onChange('arrowParens', event.target.value as ArrowParens)}
                >
                  <option value="always">Siempre</option>
                  <option value="avoid">Evitar cuando sea posible</option>
                </NativeSelect>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {supports('proseWrap') ? (
        <>
          <Separator />
          <div className="space-y-1.5">
            <p className={SECTION_TITLE_CLASS}>Markdown</p>
            <Label htmlFor="format-prose-wrap">Ajuste de prosa</Label>
            <NativeSelect
              id="format-prose-wrap"
              aria-label="Ajuste de prosa"
              value={settings.proseWrap}
              onChange={(event) => onChange('proseWrap', event.target.value as ProseWrap)}
            >
              <option value="preserve">Preservar el ajuste original</option>
              <option value="always">Ajustar al ancho de línea</option>
              <option value="never">Una línea por párrafo</option>
            </NativeSelect>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function FormatOptionsPanel({
  settings,
  language,
  onChange,
  onReset,
}: FormatOptionsPanelProps) {
  const definition = getLanguageDefinition(language);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label="Abrir opciones de formato">
          <SlidersHorizontal />
          Opciones
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">Opciones de formato</p>
            <p className="text-xs text-muted-foreground">{definition.label}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            title="Restaurar valores por defecto"
          >
            <RotateCcw />
            Restaurar
          </Button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-4">
          <FormatOptionsFields settings={settings} language={language} onChange={onChange} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
