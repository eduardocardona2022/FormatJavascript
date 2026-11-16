import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { Prec, type Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { LoaderCircle } from 'lucide-react';
import type { LanguageId } from '@formatjs/shared';
import { useTheme } from '@/app/theme-provider';
import { cn } from '@/lib/utils';

const languageCache = new Map<LanguageId, Promise<Extension>>();

async function loadLanguageExtension(language: LanguageId): Promise<Extension> {
  switch (language) {
    case 'javascript': {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript({ jsx: false, typescript: false });
    }
    case 'javascript-jsx': {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript({ jsx: true, typescript: false });
    }
    case 'typescript': {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript({ jsx: false, typescript: true });
    }
    case 'typescript-tsx': {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript({ jsx: true, typescript: true });
    }
    case 'json': {
      const { json } = await import('@codemirror/lang-json');
      return json();
    }
    case 'css': {
      const { css } = await import('@codemirror/lang-css');
      return css();
    }
    case 'html': {
      const { html } = await import('@codemirror/lang-html');
      return html();
    }
    case 'markdown': {
      const { markdown } = await import('@codemirror/lang-markdown');
      return markdown();
    }
  }
}

function getLanguageExtension(language: LanguageId): Promise<Extension> {
  const cached = languageCache.get(language);

  if (cached) {
    return cached;
  }

  const promise = loadLanguageExtension(language).catch((error: unknown) => {
    languageCache.delete(language);
    throw error;
  });
  languageCache.set(language, promise);
  return promise;
}

interface EditorPaneProps {
  readonly value: string;
  readonly language: LanguageId;
  readonly label: string;
  readonly onChange?: (value: string) => void;
  readonly onSubmit?: () => void;
  readonly readOnly?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
}

export type { EditorPaneProps };

/**
 * Editor con resaltado por lenguaje. Las extensiones de CodeMirror se cargan
 * de forma diferida para no incluir todos los lenguajes en el bundle inicial.
 */
export function EditorPane({
  value,
  language,
  label,
  onChange,
  onSubmit,
  readOnly = false,
  placeholder,
  className,
}: EditorPaneProps) {
  const { theme } = useTheme();

  const submitKeymap = useMemo(
    () =>
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              if (!onSubmit) {
                return false;
              }

              onSubmit();
              return true;
            },
          },
        ]),
      ),
    [onSubmit],
  );
  const [loaded, setLoaded] = useState<{
    language: LanguageId;
    extension: Extension | null;
  } | null>(null);

  useEffect(() => {
    let active = true;

    getLanguageExtension(language)
      .then((loadedExtension) => {
        if (active) {
          setLoaded({ language, extension: loadedExtension });
        }
      })
      .catch(() => {
        if (active) {
          setLoaded({ language, extension: null });
        }
      });

    return () => {
      active = false;
    };
  }, [language]);

  const loadingLanguage = loaded?.language !== language;
  const extension = loaded?.language === language && loaded.extension ? [loaded.extension] : [];
  const extensions = readOnly ? extension : [...extension, submitKeymap];

  return (
    <div
      className={cn('relative h-[420px] overflow-hidden rounded-lg border bg-card', className)}
      aria-busy={loadingLanguage}
    >
      {loadingLanguage ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-md border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
          <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
          <span>Resaltado</span>
        </div>
      ) : null}
      <CodeMirror
        value={value}
        height="100%"
        theme={theme === 'dark' ? oneDark : 'light'}
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        onChange={readOnly ? undefined : onChange}
        placeholder={placeholder}
        aria-label={label}
        className="h-full text-sm"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          autocompletion: false,
          closeBrackets: !readOnly,
          bracketMatching: true,
          highlightSelectionMatches: false,
        }}
      />
    </div>
  );
}
