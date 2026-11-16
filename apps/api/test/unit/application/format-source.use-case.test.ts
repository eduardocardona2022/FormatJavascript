import { describe, expect, it } from 'vitest';
import { FormatSyntaxError } from '../../../src/domain/errors';
import type {
  CodeFormatRequest,
  CodeFormatResult,
  CodeFormatterPort,
} from '../../../src/domain/ports/code-formatter.port';
import { FormatSourceUseCase } from '../../../src/application/use-cases/format-source.use-case';

class FakeFormatter implements CodeFormatterPort {
  lastRequest?: CodeFormatRequest;

  async format(request: CodeFormatRequest): Promise<CodeFormatResult> {
    this.lastRequest = request;
    return { formatted: 'const x = 1;\n' };
  }
}

class FailingFormatter implements CodeFormatterPort {
  async format(): Promise<CodeFormatResult> {
    throw new FormatSyntaxError('Unexpected token', { line: 2, column: 5 });
  }
}

describe('FormatSourceUseCase', () => {
  it('valida, resuelve opciones y delega en el puerto', async () => {
    const formatter = new FakeFormatter();
    const useCase = new FormatSourceUseCase(formatter);

    const result = await useCase.execute({
      fileName: 'app.js',
      source: 'const x=1;\nconsole.log(x)',
      options: { semi: false, singleQuote: true },
    });

    expect(formatter.lastRequest?.fileName).toBe('app.js');
    expect(formatter.lastRequest?.language).toBe('javascript');
    expect(formatter.lastRequest?.options.semi).toBe(false);
    expect(formatter.lastRequest?.options.singleQuote).toBe(true);
    expect(result.formatted).toBe('const x = 1;\n');
    expect(result.language).toBe('javascript');
    expect(result.stats.inputLines).toBe(2);
    expect(result.stats.outputLines).toBe(1);
    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('propaga los errores de sintaxis del formateador', async () => {
    const useCase = new FormatSourceUseCase(new FailingFormatter());

    await expect(
      useCase.execute({ fileName: 'app.js', source: 'const x = ;' }),
    ).rejects.toBeInstanceOf(FormatSyntaxError);
  });

  it('no invoca al formateador si la entrada es inválida', async () => {
    const formatter = new FakeFormatter();
    const useCase = new FormatSourceUseCase(formatter);

    await expect(useCase.execute({ fileName: 'app.txt', source: 'hola' })).rejects.toThrow();

    expect(formatter.lastRequest).toBeUndefined();
  });
});
