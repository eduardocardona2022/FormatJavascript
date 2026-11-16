import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/app/theme-provider';
import { EditorPane } from './editor-pane';

describe('EditorPane', () => {
  it('renderiza el editor editable y propaga cambios', async () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider>
        <EditorPane
          value="const x = 1;"
          language="typescript"
          label="Editor de prueba"
          onChange={onChange}
        />
      </ThemeProvider>,
    );

    const editor = await screen.findByLabelText('Editor de prueba');
    await userEvent.clear(editor);
    await userEvent.type(editor, 'const y = 2;');

    expect(onChange).toHaveBeenCalled();
    expect(editor).not.toHaveAttribute('readonly');
  });

  it('renderiza en modo solo lectura', async () => {
    render(
      <ThemeProvider>
        <EditorPane
          value="const x = 1;"
          language="javascript"
          label="Resultado de prueba"
          readOnly
        />
      </ThemeProvider>,
    );

    const editor = await screen.findByLabelText('Resultado de prueba');
    expect(editor).toHaveAttribute('readonly');
  });
});
