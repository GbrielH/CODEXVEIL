import { describe, expect, it } from 'vitest';
import {
  INVITE_CODE_ALPHABET,
  INVITE_MAX_TTL_DAYS,
  computeInviteExpiry,
  formatInviteCode,
  getInviteStatus,
  isInviteRejectionReason,
  isValidInviteCode,
  normalizeInviteCode,
  type InviteState,
} from './invites';

describe('códigos de convite', () => {
  it('usa um alfabeto de 32 símbolos sem caracteres ambíguos', () => {
    expect(INVITE_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(INVITE_CODE_ALPHABET).size).toBe(32);
    for (const ambiguous of ['I', 'O', '0', '1']) {
      expect(INVITE_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it('normaliza entradas digitadas pelo usuário', () => {
    expect(normalizeInviteCode(' abcd-efgh-jkmn ')).toBe('ABCDEFGHJKMN');
    expect(isValidInviteCode('abcd efgh jkmn')).toBe(true);
  });

  it('rejeita códigos com tamanho ou caracteres inválidos', () => {
    expect(isValidInviteCode('ABCD-EFGH')).toBe(false);
    expect(isValidInviteCode('ABCD-EFGH-JKL0')).toBe(false);
    expect(isValidInviteCode('ABCD-EFGH-JKLI')).toBe(false);
    expect(isValidInviteCode("ABCD-EFGH-JK'--")).toBe(false);
  });

  it('formata em grupos de quatro', () => {
    expect(formatInviteCode('abcdefghjkmn')).toBe('ABCD-EFGH-JKMN');
  });
});

describe('status do convite', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  const base: InviteState = {
    expiresAt: new Date('2026-10-20T12:00:00Z'),
    revokedAt: null,
    declinedAt: null,
    maxUses: 1,
    usesCount: 0,
  };

  it('ativo enquanto válido', () => {
    expect(getInviteStatus(base, now)).toBe('active');
  });

  it('expira no instante limite', () => {
    expect(getInviteStatus({ ...base, expiresAt: now }, now)).toBe('expired');
  });

  it('esgota ao atingir o limite de usos; ilimitado nunca esgota', () => {
    expect(getInviteStatus({ ...base, usesCount: 1 }, now)).toBe('exhausted');
    expect(getInviteStatus({ ...base, maxUses: null, usesCount: 999 }, now)).toBe('active');
  });

  it('revogação tem precedência sobre os demais estados', () => {
    expect(getInviteStatus({ ...base, revokedAt: now, usesCount: 1 }, now)).toBe('revoked');
  });

  it('limita a validade ao máximo permitido', () => {
    const expiry = computeInviteExpiry(365, now);
    const days = (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(INVITE_MAX_TTL_DAYS);
    expect(computeInviteExpiry(0, now).getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000);
  });

  it('reconhece motivos de recusa vindos do banco', () => {
    expect(isInviteRejectionReason('expired')).toBe(true);
    expect(isInviteRejectionReason('drop table')).toBe(false);
    expect(isInviteRejectionReason(42)).toBe(false);
  });
});
