import { describe, expect, it } from 'vitest';
import { cx } from './cx';
import { formatRelative, fromBrasiliaInput, pluralize, toBrasiliaInput } from './format';

describe('datas no horário de Brasília', () => {
  it('converte entre ISO e o campo datetime-local', () => {
    expect(toBrasiliaInput('2026-10-16T23:30:00.000Z')).toBe('2026-10-16T20:30');
    expect(fromBrasiliaInput('2026-10-16T20:30')).toBe('2026-10-16T23:30:00.000Z');
  });

  it('é uma conversão de ida e volta', () => {
    const iso = '2027-01-02T03:04:00.000Z';
    expect(fromBrasiliaInput(toBrasiliaInput(iso))).toBe(iso);
  });

  it('trata vazio e valores inválidos', () => {
    expect(toBrasiliaInput(null)).toBe('');
    expect(toBrasiliaInput('não é data')).toBe('');
    expect(fromBrasiliaInput('')).toBeNull();
    expect(fromBrasiliaInput('16/10/2026')).toBeUndefined();
  });
});

describe('textos', () => {
  it('pluraliza', () => {
    expect(pluralize(1, 'sessão', 'sessões')).toBe('1 sessão');
    expect(pluralize(3, 'sessão', 'sessões')).toBe('3 sessões');
  });

  it('formata tempo relativo', () => {
    const now = new Date('2026-10-16T12:00:00Z');
    expect(formatRelative('2026-10-13T12:00:00Z', now)).toBe('há 3 dias');
    expect(formatRelative('2026-10-16T11:59:50Z', now)).toBe('agora mesmo');
  });

  it('junta classes ignorando valores falsos', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });
});
