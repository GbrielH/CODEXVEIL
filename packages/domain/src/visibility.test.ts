import { describe, expect, it } from 'vitest';
import { canViewContent } from './visibility';

const player = { isMember: true, isGm: false, isAuthor: false };
const gm = { isMember: true, isGm: true, isAuthor: false };
const outsider = { isMember: false, isGm: false, isAuthor: true };

describe('canViewContent', () => {
  it('conteúdo de participantes é visível a todos os membros', () => {
    expect(canViewContent('members', player)).toBe(true);
    expect(canViewContent('members', gm)).toBe(true);
  });

  it('conteúdo de mestre é visível apenas a mestres e ao autor', () => {
    expect(canViewContent('gm', player)).toBe(false);
    expect(canViewContent('gm', gm)).toBe(true);
    expect(canViewContent('gm', { ...player, isAuthor: true })).toBe(true);
  });

  it('anotações pessoais são visíveis apenas ao autor', () => {
    expect(canViewContent('author', gm)).toBe(false);
    expect(canViewContent('author', { ...player, isAuthor: true })).toBe(true);
  });

  it('quem saiu da campanha perde o acesso, mesmo sendo o autor', () => {
    expect(canViewContent('author', outsider)).toBe(false);
  });
});
