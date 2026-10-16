import { describe, expect, it } from 'vitest';
import { isSecretKey, parseSupabasePublicConfig } from './config';

const names = { url: 'SUPABASE_URL', publishableKey: 'SUPABASE_KEY' };

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.assinatura`;
}

describe('configuração pública do Supabase', () => {
  it('aceita URL https e chave publicável', () => {
    const result = parseSupabasePublicConfig({
      url: 'https://abc.supabase.co/',
      publishableKey: 'sb_publishable_123',
      names,
    });
    expect(result).toEqual({
      ok: true,
      config: { url: 'https://abc.supabase.co', publishableKey: 'sb_publishable_123' },
    });
  });

  it('aceita a antiga chave anon e ambiente local', () => {
    const result = parseSupabasePublicConfig({
      url: 'http://127.0.0.1:54321',
      publishableKey: fakeJwt({ role: 'anon' }),
      names,
    });
    expect(result.ok).toBe(true);
  });

  it('lista variáveis ausentes', () => {
    const result = parseSupabasePublicConfig({ url: undefined, publishableKey: ' ', names });
    expect(result).toEqual({
      ok: false,
      problems: ['SUPABASE_URL não foi definida.', 'SUPABASE_KEY não foi definida.'],
    });
  });

  it('recusa chaves secretas, inclusive no formato JWT service_role', () => {
    expect(isSecretKey('sb_secret_abc')).toBe(true);
    expect(isSecretKey(fakeJwt({ role: 'service_role' }))).toBe(true);
    expect(isSecretKey(fakeJwt({ role: 'anon' }))).toBe(false);
    const result = parseSupabasePublicConfig({
      url: 'https://abc.supabase.co',
      publishableKey: 'sb_secret_abc',
      names,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toMatch(/SECRETA/);
  });

  it('exige https fora do ambiente local', () => {
    const result = parseSupabasePublicConfig({
      url: 'http://abc.supabase.co',
      publishableKey: 'sb_publishable_123',
      names,
    });
    expect(result.ok).toBe(false);
  });
});
