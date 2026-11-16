import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT_OPTIONS, LANGUAGES } from '@formatjs/shared';
import { FormatOptionsFields, FormatOptionsPanel } from './format-options-panel';

const settings = { ...DEFAULT_FORMAT_OPTIONS };

describe('FormatOptionsFields', () => {
  it('muestra las opciones de scripts para JavaScript', () => {
    render(<FormatOptionsFields settings={settings} language="javascript" onChange={vi.fn()} />);

    expect(screen.getByText('JavaScript / TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Punto y coma')).toBeInTheDocument();
    expect(screen.getByText('Comillas simples')).toBeInTheDocument();
    expect(screen.getByText('Comas finales')).toBeInTheDocument();
    expect(screen.queryByText('Ajuste de prosa')).not.toBeInTheDocument();
  });

  it('oculta opciones de scripts para JSON', () => {
    render(<FormatOptionsFields settings={settings} language="json" onChange={vi.fn()} />);

    expect(screen.getByText('Ancho de línea')).toBeInTheDocument();
    expect(screen.queryByText('Punto y coma')).not.toBeInTheDocument();
    expect(screen.queryByText('JavaScript / TypeScript')).not.toBeInTheDocument();
  });

  it('muestra el ajuste de prosa solo en Markdown', () => {
    render(<FormatOptionsFields settings={settings} language="markdown" onChange={vi.fn()} />);

    expect(screen.getByText('Ajuste de prosa')).toBeInTheDocument();
    expect(screen.queryByText('Punto y coma')).not.toBeInTheDocument();
  });

  it('notifica cambios en la indentación', async () => {
    const onChange = vi.fn();
    render(<FormatOptionsFields settings={settings} language="javascript" onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Indentación'), '4');

    expect(onChange).toHaveBeenCalledWith('tabWidth', 4);
  });

  it('notifica cambios en un switch', async () => {
    const onChange = vi.fn();
    render(<FormatOptionsFields settings={settings} language="javascript" onChange={onChange} />);

    await userEvent.click(screen.getByLabelText('Punto y coma'));

    expect(onChange).toHaveBeenCalledWith('semi', false);
  });
});

describe('FormatOptionsPanel', () => {
  it('abre el panel y permite restaurar', async () => {
    const onReset = vi.fn();
    render(
      <FormatOptionsPanel
        settings={settings}
        language="javascript"
        onChange={vi.fn()}
        onReset={onReset}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abrir opciones de formato' }));

    expect(await screen.findByText('Opciones de formato')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Restaurar/ }));
    expect(onReset).toHaveBeenCalled();
  });

  it('usa el nombre del lenguaje activo', async () => {
    render(
      <FormatOptionsPanel
        settings={settings}
        language="markdown"
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abrir opciones de formato' }));

    expect(await screen.findAllByText(LANGUAGES.markdown.label)).not.toHaveLength(0);
  });
});
