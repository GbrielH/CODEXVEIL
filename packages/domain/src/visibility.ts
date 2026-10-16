/**
 * Visibilidade de conteúdos de campanha.
 *
 * - `members`: todos os participantes da campanha.
 * - `gm`: somente mestres (e o autor, quando um jogador escreve algo "para o mestre").
 * - `author`: somente quem escreveu (anotações pessoais).
 *
 * Blocos de roteiro e registros da biblioteca aceitam apenas `members` e `gm`.
 * A filtragem real acontece nas policies RLS — o cliente nunca recebe o que não pode ver.
 */

export const CONTENT_VISIBILITIES = ['members', 'gm', 'author'] as const;
export type ContentVisibility = (typeof CONTENT_VISIBILITIES)[number];

export const SHARED_VISIBILITIES = ['members', 'gm'] as const;
export type SharedVisibility = (typeof SHARED_VISIBILITIES)[number];

export const visibilityLabels: Record<ContentVisibility, string> = {
  members: 'Todos os participantes',
  gm: 'Somente mestres',
  author: 'Somente eu',
};

export const visibilityDescriptions: Record<ContentVisibility, string> = {
  members: 'Mestres e jogadores da campanha podem ver.',
  gm: 'Visível apenas para os mestres da campanha (e para você, se for o autor).',
  author: 'Anotação pessoal: ninguém mais pode ver.',
};

export interface ContentViewer {
  isMember: boolean;
  isGm: boolean;
  isAuthor: boolean;
}

export function canViewContent(visibility: ContentVisibility, viewer: ContentViewer): boolean {
  if (!viewer.isMember) return false;
  switch (visibility) {
    case 'members':
      return true;
    case 'gm':
      return viewer.isGm || viewer.isAuthor;
    case 'author':
      return viewer.isAuthor;
  }
}
