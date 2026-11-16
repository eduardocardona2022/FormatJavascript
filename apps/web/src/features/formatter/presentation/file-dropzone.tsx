import { useRef, useState, type DragEvent } from 'react';
import {
  SUPPORTED_EXTENSIONS,
  SUPPORTED_EXTENSIONS_LABEL,
  type LanguageDefinition,
} from '@formatjs/shared';
import { FileCode2, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  readonly fileName: string;
  readonly fileSize: number | null;
  readonly language: LanguageDefinition;
  readonly isFileMode: boolean;
  readonly onFile: (file: File) => void;
  readonly onClear: () => void;
}

export function FileDropzone({
  fileName,
  fileSize,
  language,
  isFileMode,
  onFile,
  onClear,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null): void {
    const file = files?.[0];

    if (file) {
      onFile(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  if (isFileMode && fileName.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background shadow-sm ring-1 ring-border">
          <FileCode2 className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={fileName}>
            {fileName}
          </p>
          <p className="text-xs text-muted-foreground">
            {fileSize !== null ? formatFileSize(fileSize) : 'Archivo cargado'} · {language.label}
          </p>
        </div>
        <Badge variant="secondary">{language.label}</Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClear}
          aria-label="Quitar archivo y limpiar"
          title="Quitar archivo y limpiar"
        >
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_EXTENSIONS.join(',')}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        aria-label="Seleccionar archivo de código"
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          isDragging
            ? 'border-ring bg-accent/60'
            : 'border-border bg-muted/20 hover:border-ring/60 hover:bg-muted/40',
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
          <Upload className="size-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium">
          Arrastra tu archivo aquí o haz clic para seleccionar
        </span>
        <span className="text-xs text-muted-foreground">
          Formatos: {SUPPORTED_EXTENSIONS_LABEL} · Máximo 1 MB
        </span>
      </button>
    </div>
  );
}
