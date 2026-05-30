import { describe, expect, it } from 'vitest';
import { parseClassification } from '../src/anthropic/classify.js';

describe('parseClassification', () => {
  it('passes through valid classification', () => {
    const result = parseClassification({
      categoria: 'financeiro',
      urgencia: 'alta',
      idioma: 'pt',
      resumo: 'Cobrança duplicada.',
    });
    expect(result).toEqual({
      categoria: 'financeiro',
      urgencia: 'alta',
      idioma: 'pt',
      resumo: 'Cobrança duplicada.',
    });
  });

  it('falls back to "outro" for an unknown category', () => {
    const result = parseClassification({
      categoria: 'spam',
      urgencia: 'media',
      idioma: 'pt',
      resumo: 'x',
    });
    expect(result.categoria).toBe('outro');
  });

  it('falls back to "media" for an unknown urgency', () => {
    const result = parseClassification({
      categoria: 'duvida',
      urgencia: 'urgentíssimo',
      idioma: 'pt',
      resumo: 'x',
    });
    expect(result.urgencia).toBe('media');
  });

  it('normalises casing and whitespace', () => {
    const result = parseClassification({
      categoria: '  Suporte_Tecnico ',
      urgencia: ' ALTA ',
      idioma: ' EN ',
      resumo: '  hello  ',
    });
    expect(result.categoria).toBe('suporte_tecnico');
    expect(result.urgencia).toBe('alta');
    expect(result.idioma).toBe('en');
    expect(result.resumo).toBe('hello');
  });

  it('applies sane defaults for missing fields', () => {
    const result = parseClassification({});
    expect(result.categoria).toBe('outro');
    expect(result.urgencia).toBe('media');
    expect(result.idioma).toBe('pt');
    expect(result.resumo).toBe('Sem resumo.');
  });

  it('handles null/garbage input without throwing', () => {
    expect(() => parseClassification(null)).not.toThrow();
    expect(() => parseClassification(undefined)).not.toThrow();
    expect(parseClassification(null).categoria).toBe('outro');
  });
});
