import { createBlockContent, SESSION_BLOCK_TYPES } from '@codexveil/domain';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { safeRedirectPath, signInSchema, signUpSchema } from './auth';
import { campaignCreateSchema, inviteCodeSchema, inviteCreateSchema } from './campaigns';
import { inventoryItemSchema, resourceSchema } from './characters';
import { configureValidationLocale, fieldErrorsFrom } from './common';
import { sessionBlockSchema } from './sessions';
import { validateImageFile } from './uploads';

describe('autenticação', () => {
  it('normaliza o e-mail', () => {
    const parsed = signInSchema.parse({ email: '  Mestre@Exemplo.COM ', password: 'x' });
    expect(parsed.email).toBe('mestre@exemplo.com');
  });

  it('exige senha forte e confirmação igual no cadastro', () => {
    const result = signUpSchema.safeParse({
      displayName: 'Aria',
      email: 'aria@exemplo.com',
      password: 'curta',
      confirmPassword: 'outra',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrorsFrom(result.error);
      expect(errors.password).toMatch(/8 caracteres/);
      expect(errors.confirmPassword).toBe('As senhas não coincidem.');
    }
  });

  it('aceita um cadastro válido', () => {
    expect(
      signUpSchema.safeParse({
        displayName: '  Aria  ',
        email: 'aria@exemplo.com',
        password: 'grimorio42',
        confirmPassword: 'grimorio42',
      }).success,
    ).toBe(true);
  });

  it('impede redirecionamento para fora do site', () => {
    expect(safeRedirectPath('/campanhas/1')).toBe('/campanhas/1');
    expect(safeRedirectPath('https://malicioso.com')).toBe('/painel');
    expect(safeRedirectPath('//malicioso.com')).toBe('/painel');
    expect(safeRedirectPath('/\\malicioso.com')).toBe('/painel');
    expect(safeRedirectPath(null)).toBe('/painel');
    expect(safeRedirectPath('/ok\n')).toBe('/painel');
  });
});

describe('campanhas e convites', () => {
  it('valida a criação de campanha', () => {
    expect(campaignCreateSchema.parse({ name: ' Mina Perdida ', systemId: 'dnd5e' })).toEqual({
      name: 'Mina Perdida',
      description: '',
      systemId: 'dnd5e',
      characterRules: {},
      creationQuestions: [],
    });
    expect(campaignCreateSchema.safeParse({ name: 'X', systemId: 'dnd5e' }).success).toBe(false);
    expect(campaignCreateSchema.safeParse({ name: 'Mina', systemId: 'gurps' }).success).toBe(
      false,
    );
  });

  it('aplica padrões e limites ao convite', () => {
    expect(inviteCreateSchema.parse({})).toEqual({
      expiresInDays: 7,
      maxUses: 1,
      invitedEmail: null,
    });
    expect(inviteCreateSchema.safeParse({ expiresInDays: 31 }).success).toBe(false);
    expect(inviteCreateSchema.safeParse({ maxUses: 0 }).success).toBe(false);
    expect(inviteCreateSchema.parse({ maxUses: null }).maxUses).toBeNull();
  });

  it('normaliza e valida códigos de convite', () => {
    expect(inviteCodeSchema.parse('abcd-efgh-jkmn')).toBe('ABCDEFGHJKMN');
    expect(inviteCodeSchema.safeParse('abc').success).toBe(false);
  });
});

describe('fichas', () => {
  it('valida itens de inventário', () => {
    expect(inventoryItemSchema.parse({ name: 'Corda (15 m)' })).toMatchObject({
      quantity: 1,
      category: 'gear',
      weight: null,
    });
    expect(inventoryItemSchema.safeParse({ name: 'Poção', quantity: -1 }).success).toBe(false);
  });

  it('não permite recurso acima do máximo', () => {
    const result = resourceSchema.safeParse({ label: 'Fúria', current: 4, max: 3 });
    expect(result.success).toBe(false);
  });
});

describe('blocos de roteiro', () => {
  it('aceita o conteúdo inicial de todos os tipos', () => {
    for (const type of SESSION_BLOCK_TYPES) {
      const visibility = type === 'gm_note' ? 'gm' : 'members';
      const result = sessionBlockSchema.safeParse({
        visibility,
        content: createBlockContent(type),
      });
      expect(result.success, type).toBe(true);
    }
  });

  it('não permite nota privada visível aos jogadores', () => {
    const result = sessionBlockSchema.safeParse({
      visibility: 'members',
      content: { type: 'gm_note', data: { text: 'O duque é o vilão.' } },
    });
    expect(result.success).toBe(false);
  });

  it('rejeita tipos desconhecidos e HTML arbitrário como estrutura', () => {
    expect(
      sessionBlockSchema.safeParse({
        visibility: 'members',
        content: { type: 'html', data: { html: '<script>alert(1)</script>' } },
      }).success,
    ).toBe(false);
  });
});

describe('uploads', () => {
  it('aceita imagens comuns dentro do limite', () => {
    expect(validateImageFile({ type: 'image/webp', size: 1024 }, 'media')).toEqual({
      ok: true,
      mimeType: 'image/webp',
    });
  });

  it('rejeita SVG, arquivos vazios e grandes demais', () => {
    expect(validateImageFile({ type: 'image/svg+xml', size: 10 }, 'media').ok).toBe(false);
    expect(validateImageFile({ type: 'image/png', size: 0 }, 'media').ok).toBe(false);
    expect(validateImageFile({ type: 'image/png', size: 3 * 1024 * 1024 }, 'media').ok).toBe(false);
  });
});

describe('localização', () => {
  it('usa mensagens padrão em português', () => {
    configureValidationLocale();
    const result = z.number().safeParse('abc');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/inválid|esperado/i);
    }
  });
});
