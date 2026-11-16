import { lazy, Suspense } from 'react';
import type { EditorPaneProps } from './editor-pane';

const EditorPane = lazy(() =>
  import('./editor-pane').then((module) => ({ default: module.EditorPane })),
);

/**
 * CodeMirror es pesado. Se carga en un chunk aparte para que el primer render
 * de la página no tenga que descargar todo el editor.
 */
export function LazyEditorPane(props: EditorPaneProps) {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-[420px] items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground"
          role="status"
        >
          Cargando editor…
        </div>
      }
    >
      <EditorPane {...props} />
    </Suspense>
  );
}
