import { useEffect } from 'react';
import { FileCode2, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatter } from '../application/use-formatter';
import { ErrorAlert } from './error-alert';
import { FileDropzone } from './file-dropzone';
import { FormatToolbar } from './format-toolbar';
import { LazyEditorPane } from './lazy-editor-pane';
import { ResultPanel } from './result-panel';

const FEATURES = [
  { icon: FileCode2, label: '8 formatos' },
  { icon: ShieldCheck, label: 'Sin persistencia' },
  { icon: Zap, label: 'Workers en backend' },
] as const;

export function FormatterPage() {
  const formatter = useFormatter();
  const { format } = formatter;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        void format();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [format]);

  async function handleCopy(): Promise<void> {
    try {
      await formatter.copy();
      toast.success('Código copiado al portapapeles');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo copiar el código.');
    }
  }

  function handleDownload(): void {
    formatter.download();
    toast.success('Archivo descargado');
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4">
        <Badge variant="outline" className="w-fit gap-1.5 px-2.5 py-1">
          <Sparkles className="size-3" aria-hidden="true" />
          Prettier 3 · 8 lenguajes
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Formatea tu código, sin ruido.
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Carga un archivo o pega tu código, ajusta el estilo y exporta el resultado. El formateo
            se ejecuta en tu API local y no guarda nada en disco.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {FEATURES.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Hasta 1 MB
          </span>
        </div>
      </section>

      <p className="sr-only" aria-live="polite">
        {formatter.status === 'loading'
          ? 'Formateando código.'
          : formatter.formatted !== null
            ? 'Formateo completado.'
            : ''}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader className="border-b pb-4">
            <CardTitle>Entrada</CardTitle>
            <CardDescription>
              Arrastra un archivo, selecciónalo o pega el código directamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 pt-0">
            <FileDropzone
              fileName={formatter.fileName}
              fileSize={formatter.fileSize}
              language={formatter.languageDefinition}
              isFileMode={formatter.isFileMode}
              onFile={(file) => {
                void formatter.loadFile(file);
              }}
              onClear={formatter.clear}
            />

            <FormatToolbar
              language={formatter.language}
              isFileMode={formatter.isFileMode}
              canFormat={formatter.canFormat}
              canClear={formatter.source.length > 0 || formatter.formatted !== null}
              status={formatter.status}
              settings={formatter.settings}
              onLanguageChange={formatter.selectLanguage}
              onFormat={() => {
                void formatter.format();
              }}
              onClear={formatter.clear}
              onSettingChange={formatter.updateSetting}
              onResetSettings={formatter.resetSettings}
            />

            {formatter.error ? (
              <ErrorAlert error={formatter.error} onDismiss={formatter.dismissError} />
            ) : null}

            <LazyEditorPane
              value={formatter.source}
              language={formatter.language}
              label="Editor de código de entrada"
              onChange={formatter.setSource}
              onSubmit={() => {
                void formatter.format();
              }}
              placeholder="Pega tu código aquí o carga un archivo…"
            />

            <p className="text-xs text-muted-foreground">
              El nombre del archivo determina el lenguaje. Puedes editar el contenido antes de
              formatear.
            </p>
          </CardContent>
        </Card>

        <ResultPanel
          formatted={formatter.formatted}
          stats={formatter.stats}
          language={formatter.languageDefinition}
          isStale={formatter.isStale}
          canExport={formatter.canExport}
          onCopy={() => {
            void handleCopy();
          }}
          onDownload={handleDownload}
        />
      </div>
    </div>
  );
}
