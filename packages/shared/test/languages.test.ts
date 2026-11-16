import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORMAT_OPTIONS,
  LANGUAGES,
  LANGUAGE_IDS,
  MAX_SOURCE_BYTES,
  buildSnippetFileName,
  detectLanguage,
  getApplicableOptions,
  getExportFileName,
  getExtension,
  isLanguageId,
  sanitizeFileName,
} from '../src';
import type { LanguageId } from '../src';

describe('catálogo de lenguajes', () => {
  it.each(Object.values(LANGUAGES))('detecta $extension como $id', (language) => {
    expect(detectLanguage(`archivo${language.extension}`)).toBe(language.id);
    expect(detectLanguage(`archivo${language.extension.toUpperCase()}`)).toBe(language.id);
  });

  it('devuelve undefined para extensiones no soportadas', () => {
    expect(detectLanguage('archivo.txt')).toBeUndefined();
    expect(detectLanguage('sin-extension')).toBeUndefined();
    expect(detectLanguage('.js')).toBeUndefined();
  });

  it('extrae la extensión sin depender del separador de rutas', () => {
    expect(getExtension('C:\\proyecto\\app.TS')).toBe('.ts');
    expect(getExtension('/home/user/app.jsx')).toBe('.jsx');
  });

  it('valida los identificadores de lenguaje', () => {
    for (const id of LANGUAGE_IDS) {
      expect(isLanguageId(id)).toBe(true);
    }
    expect(isLanguageId('python')).toBe(false);
    expect(isLanguageId(undefined)).toBe(false);
  });

  it('construye un nombre de archivo para texto pegado', () => {
    expect(buildSnippetFileName('typescript')).toBe('snippet.ts');
    expect(buildSnippetFileName('markdown')).toBe('snippet.md');
  });
});

describe('opciones por lenguaje', () => {
  const allOptions = DEFAULT_FORMAT_OPTIONS;

  it('incluye opciones de scripts solo en lenguajes de script', () => {
    const script = getApplicableOptions('typescript', allOptions);
    expect(script.semi).toBe(true);
    expect(script.singleQuote).toBe(false);
    expect(script.trailingComma).toBe('all');

    const json = getApplicableOptions('json', allOptions);
    expect(json.semi).toBeUndefined();
    expect(json.singleQuote).toBeUndefined();
    expect(json.printWidth).toBe(80);
  });

  it('incluye proseWrap solo en Markdown', () => {
    expect(getApplicableOptions('markdown', allOptions).proseWrap).toBe('preserve');
    expect(getApplicableOptions('html', allOptions).proseWrap).toBeUndefined();
  });

  it('no inventa valores ausentes', () => {
    expect(getApplicableOptions('javascript', {})).toEqual({});
  });
});

describe('nombres de archivo', () => {
  it('elimina rutas y caracteres peligrosos', () => {
    expect(sanitizeFileName('..\\..\\etc\\passwd.js')).toBe('passwd.js');
    expect(sanitizeFileName('a<b>:"c|d?.js')).toBe('a_b___c_d_.js');
    expect(sanitizeFileName('   ')).toBe('archivo.txt');
  });

  it('genera el nombre de exportación conservando la extensión', () => {
    expect(getExportFileName('app.ts')).toBe('app.formatted.ts');
    expect(getExportFileName('index.html')).toBe('index.formatted.html');
    expect(getExportFileName('README')).toBe('README.formatted');
  });

  it('expone un límite de 1 MiB', () => {
    expect(MAX_SOURCE_BYTES).toBe(1_048_576);
  });
});

describe('contrato de lenguajes', () => {
  it('define una extensión única por lenguaje', () => {
    const extensions = Object.values(LANGUAGES).map((language) => language.extension);
    expect(new Set(extensions).size).toBe(extensions.length);
  });

  it('permite tipar los identificadores conocidos', () => {
    const id: LanguageId = 'javascript';
    expect(LANGUAGES[id].label).toBe('JavaScript');
  });
});
