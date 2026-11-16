import type { ChangeEvent } from 'react';

interface MockCodeMirrorProps {
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly editable?: boolean;
  readonly readOnly?: boolean;
  readonly placeholder?: string;
  readonly 'aria-label'?: string;
}

/**
 * Sustituto ligero de CodeMirror para las pruebas de componentes. Mantiene el
 * contrato de valor/onChange sin montar el editor real en jsdom.
 */
export function MockCodeMirror({
  value = '',
  onChange,
  editable = true,
  readOnly = false,
  placeholder,
  'aria-label': ariaLabel,
}: MockCodeMirrorProps) {
  return (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      readOnly={readOnly || !editable}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(event.target.value);
      }}
    />
  );
}
