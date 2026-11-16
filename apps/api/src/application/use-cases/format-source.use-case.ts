import type { FormatStats, LanguageId, PartialFormatOptions } from '@formatjs/shared';
import { SourceFile } from '../../domain/entities/source-file';
import type { CodeFormatterPort } from '../../domain/ports/code-formatter.port';
import { ResolvedFormatOptions } from '../../domain/value-objects/format-options';

export interface FormatSourceInput {
  readonly fileName: string;
  readonly source: string;
  readonly options?: PartialFormatOptions;
}

export interface FormatSourceOutput {
  readonly formatted: string;
  readonly language: LanguageId;
  readonly stats: FormatStats;
}

/**
 * Caso de uso principal: valida la entrada, resuelve las opciones y delega el
 * trabajo pesado en el puerto del formateador. No conoce Fastify ni Prettier.
 */
export class FormatSourceUseCase {
  constructor(private readonly formatter: CodeFormatterPort) {}

  async execute(input: FormatSourceInput): Promise<FormatSourceOutput> {
    const file = SourceFile.create(input.fileName, input.source);
    const options = ResolvedFormatOptions.resolve(file.language, input.options);

    const startedAt = performance.now();
    const result = await this.formatter.format({
      source: file.source,
      fileName: file.fileName,
      language: file.language,
      options: options.toJSON(),
    });
    const durationMs = Number((performance.now() - startedAt).toFixed(2));

    return {
      formatted: result.formatted,
      language: file.language,
      stats: {
        inputLines: countLines(file.source),
        outputLines: countLines(result.formatted),
        durationMs,
      },
    };
  }
}

function countLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  const withoutTrailingNewline = text.endsWith('\n') ? text.slice(0, -1) : text;
  return withoutTrailingNewline.split(/\r\n|\r|\n/).length;
}
