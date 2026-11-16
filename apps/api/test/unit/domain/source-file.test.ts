import { describe, expect, it } from 'vitest';
import { MAX_SOURCE_BYTES } from '@formatjs/shared';
import { SourceFile } from '../../../src/domain/entities/source-file';
import {
  EmptySourceError,
  InvalidSourceError,
  SourceTooLargeError,
  UnsupportedLanguageError,
  ValidationError,
} from '../../../src/domain/errors';

describe('SourceFile', () => {
  it('detecta el lenguaje a partir de la extensión', () => {
    expect(SourceFile.create('app.js', 'const x = 1;').language).toBe('javascript');
    expect(SourceFile.create('component.tsx', 'const x = <div />;').language).toBe(
      'typescript-tsx',
    );
    expect(SourceFile.create('data.JSON', '{"a":1}').language).toBe('json');
  });

  it('calcula el tamaño real en bytes UTF-8', () => {
    const file = SourceFile.create('saludo.js', 'const saludo = "ñ";');
    expect(file.sizeBytes).toBe(Buffer.byteLength('const saludo = "ñ";', 'utf8'));
  });

  it('rechaza nombres con rutas', () => {
    expect(() => SourceFile.create('../app.js', 'const x = 1;')).toThrow(ValidationError);
    expect(() => SourceFile.create('C:\\tmp\\app.js', 'const x = 1;')).toThrow(ValidationError);
  });

  it('rechaza nombres vacíos o demasiado largos', () => {
    expect(() => SourceFile.create('   ', 'const x = 1;')).toThrow(ValidationError);
    expect(() => SourceFile.create(`${'a'.repeat(256)}.js`, 'const x = 1;')).toThrow(
      ValidationError,
    );
  });

  it('acepta nombres Unicode y espacios', () => {
    expect(SourceFile.create('programación-ñ.ts', 'const x = 1;').language).toBe('typescript');
    expect(SourceFile.create('notas 2026.js', 'const x = 1;').language).toBe('javascript');
  });

  it('rechaza caracteres de control en el nombre', () => {
    expect(() => SourceFile.create('app\u0001.js', 'const x = 1;')).toThrow(ValidationError);
  });

  it('rechaza caracteres no permitidos en el nombre', () => {
    expect(() => SourceFile.create('app?.js', 'const x = 1;')).toThrow(ValidationError);
  });

  it('rechaza extensiones no soportadas', () => {
    expect(() => SourceFile.create('app.txt', 'hola')).toThrow(UnsupportedLanguageError);
    expect(() => SourceFile.create('app', 'hola')).toThrow(UnsupportedLanguageError);
  });

  it('rechaza contenido vacío o solo espacios', () => {
    expect(() => SourceFile.create('app.js', '')).toThrow(EmptySourceError);
    expect(() => SourceFile.create('app.js', '   \n\t')).toThrow(EmptySourceError);
  });

  it('rechaza caracteres nulos', () => {
    expect(() => SourceFile.create('app.js', 'const x = 1;\u0000')).toThrow(InvalidSourceError);
  });

  it('rechaza contenidos que superan 1 MiB', () => {
    const source = 'a'.repeat(MAX_SOURCE_BYTES + 1);
    expect(() => SourceFile.create('app.js', source)).toThrow(SourceTooLargeError);
  });

  it('acepta justo el límite de 1 MiB', () => {
    const source = 'a'.repeat(MAX_SOURCE_BYTES);
    expect(SourceFile.create('app.js', source).sizeBytes).toBe(MAX_SOURCE_BYTES);
  });
});
