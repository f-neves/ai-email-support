import { describe, expect, it } from 'vitest';
import { parseDraftResult } from '../src/anthropic/draft.js';

describe('parseDraftResult', () => {
  it('passes through a valid draft', () => {
    const result = parseDraftResult({ resposta: 'Olá, tudo certo!', confianca: 0.83 });
    expect(result).toEqual({ resposta: 'Olá, tudo certo!', confianca: 0.83 });
  });

  it('clamps confidence above 1', () => {
    expect(parseDraftResult({ resposta: 'x', confianca: 1.7 }).confianca).toBe(1);
  });

  it('clamps confidence below 0', () => {
    expect(parseDraftResult({ resposta: 'x', confianca: -0.4 }).confianca).toBe(0);
  });

  it('coerces a numeric string confidence', () => {
    expect(parseDraftResult({ resposta: 'x', confianca: '0.5' }).confianca).toBe(0.5);
  });

  it('defaults confidence to 0.5 when unparseable', () => {
    expect(parseDraftResult({ resposta: 'x', confianca: 'abc' }).confianca).toBe(0.5);
    expect(parseDraftResult({ resposta: 'x' }).confianca).toBe(0.5);
  });

  it('trims the reply text', () => {
    expect(parseDraftResult({ resposta: '  oi  ', confianca: 0.9 }).resposta).toBe('oi');
  });

  it('throws on an empty reply', () => {
    expect(() => parseDraftResult({ resposta: '   ', confianca: 0.9 })).toThrow();
    expect(() => parseDraftResult({ confianca: 0.9 })).toThrow();
  });
});
