import { CircleAlert, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { FormatterError } from '../domain/types';

interface ErrorAlertProps {
  readonly error: FormatterError;
  readonly onDismiss: () => void;
}

function errorTitle(code: string): string {
  switch (code) {
    case 'SYNTAX_ERROR':
      return 'El código tiene un error de sintaxis';
    case 'UNSUPPORTED_LANGUAGE':
      return 'Formato no soportado';
    case 'PAYLOAD_TOO_LARGE':
      return 'El archivo es demasiado grande';
    case 'EMPTY_SOURCE':
      return 'No hay código para formatear';
    case 'FORMAT_TIMEOUT':
      return 'El formateo tardó demasiado';
    case 'NETWORK_ERROR':
    case 'FORMATTER_UNAVAILABLE':
      return 'No se pudo contactar con el formateador';
    default:
      return 'No se pudo completar la operación';
  }
}

export function ErrorAlert({ error, onDismiss }: ErrorAlertProps) {
  const hasLocation = error.line !== undefined;

  return (
    <Alert variant="destructive" className="relative pr-10">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{errorTitle(error.code)}</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        {hasLocation ? (
          <p className="text-xs font-medium">
            Línea {error.line}
            {error.column !== undefined ? `, columna ${error.column}` : ''}
          </p>
        ) : null}
      </AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        className="absolute right-2 top-2 size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label="Cerrar error"
      >
        <X />
      </Button>
    </Alert>
  );
}
