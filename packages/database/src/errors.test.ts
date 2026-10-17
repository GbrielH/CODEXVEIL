import { AppError } from '@codexveil/domain';
import { describe, expect, it } from 'vitest';
import { toAppError, unwrap } from './errors';

describe('toAppError', () => {
  it.each([
    ['42501', 'forbidden'],
    ['CVARC', 'forbidden'],
    ['CVGMC', 'forbidden'],
    ['P0002', 'not_found'],
    ['PGRST116', 'not_found'],
    ['23505', 'conflict'],
    ['23514', 'validation'],
    ['PGRST301', 'session_expired'],
    ['XX000', 'unknown'],
  ])('SQLSTATE %s → %s', (code, expected) => {
    expect(toAppError({ code, message: 'erro', details: null, hint: null }).code).toBe(expected);
  });

  it('explica que mestres usam NPCs e monstros em vez de personagens', () => {
    expect(toAppError({ code: 'CVGMC', message: 'x' }).message).toContain('NPCs e monstros');
  });

  it('usa a mensagem do recurso limitado', () => {
    const error = toAppError({ code: 'CVLIM', message: 'x', hint: 'maxOwnedCampaigns' });
    expect(error.code).toBe('limit_reached');
    expect(error.message).toMatch(/campanhas/);
    expect(error.details).toEqual({ resource: 'maxOwnedCampaigns' });
  });

  it('reconhece falhas de rede', () => {
    expect(toAppError(new TypeError('Failed to fetch')).code).toBe('network');
    expect(toAppError({ code: '', message: 'TypeError: fetch failed' }).code).toBe('network');
  });

  it('preserva AppError e guarda a causa original', () => {
    const original = new AppError('conflict');
    expect(toAppError(original)).toBe(original);
    const wrapped = toAppError({ code: '42501', message: 'negado' });
    expect(wrapped.cause).toEqual({ code: '42501', message: 'negado' });
  });

  it('unwrap devolve dados ou lança AppError', () => {
    expect(unwrap({ data: 1, error: null })).toBe(1);
    expect(() => unwrap({ data: null, error: { code: '42501', message: 'x' } })).toThrow(AppError);
  });
});
