import type { FormatStats, LanguageDefinition } from '@formatjs/shared';
import { Copy, Download, FileOutput, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LazyEditorPane } from './lazy-editor-pane';
interface ResultPanelProps {
  readonly formatted: string | null;
  readonly stats: FormatStats | null;
  readonly language: LanguageDefinition;
  readonly isStale: boolean;
  readonly canExport: boolean;
  readonly onCopy: () => void;
  readonly onDownload: () => void;
}

function formatDuration(durationMs: number): string {
  return durationMs < 1 ? '<1 ms' : `${durationMs.toFixed(0)} ms`;
}

export function ResultPanel({
  formatted,
  stats,
  language,
  isStale,
  canExport,
  onCopy,
  onDownload,
}: ResultPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden="true" />
            Resultado
          </CardTitle>
          <CardDescription>Código formateado listo para copiar o exportar.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats ? (
            <>
              <Badge variant="outline" title={`${stats.inputLines} líneas de entrada`}>
                {stats.outputLines} líneas
              </Badge>
              <Badge variant="outline">{formatDuration(stats.durationMs)}</Badge>
            </>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onCopy} disabled={!canExport}>
            <Copy />
            Copiar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={!canExport}
          >
            <Download />
            Descargar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col pt-0">
        {formatted === null ? (
          <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <FileOutput className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Aún no hay resultado</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Carga un archivo o pega código y pulsa Formatear para ver el resultado.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isStale ? (
              <div
                className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
                role="status"
              >
                <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                El resultado está desactualizado. Vuelve a formatear para aplicar los cambios.
              </div>
            ) : null}
            <LazyEditorPane
              value={formatted}
              language={language.id}
              label="Código formateado"
              readOnly
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
