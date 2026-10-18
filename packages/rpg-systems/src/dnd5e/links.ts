import type { OfficialLink } from '../types';

/**
 * Fontes oficiais de D&D (D&D Beyond, o site oficial da Wizards of the Coast). Os endereços
 * foram conferidos em 2026-10-17. O Codexveil só reproduz o SRD; para o restante das regras,
 * o caminho é o livro oficial.
 */
export const dnd5eOfficialLinks: readonly OfficialLink[] = [
  {
    label: 'Regras gratuitas (2024)',
    description: 'As regras oficiais e gratuitas do D&D 2024: como jogar, criar personagens e conjurar magias.',
    url: 'https://www.dndbeyond.com/sources/dnd/br-2024',
    access: 'free',
  },
  {
    label: 'Documento de Referência do Sistema (SRD 5.2.1)',
    description: 'As regras abertas usadas pelo Codexveil, com magias, monstros e itens mágicos.',
    url: 'https://www.dndbeyond.com/srd',
    access: 'free',
  },
  {
    label: 'Livro do Jogador (2024)',
    description: 'Todas as classes, subclasses, espécies, antecedentes, talentos e magias.',
    url: 'https://www.dndbeyond.com/sources/dnd/phb-2024',
    access: 'paid',
  },
  {
    label: 'Livro de criaturas: Manual dos Monstros',
    description: 'As fichas oficiais das criaturas para o mestre.',
    url: 'https://www.dndbeyond.com/sources/dnd/mm-2024',
    access: 'paid',
  },
  {
    label: 'Guia do Mestre (2024)',
    description: 'Como conduzir o jogo, montar aventuras, recompensas e itens mágicos.',
    url: 'https://www.dndbeyond.com/sources/dnd/dmg-2024',
    access: 'paid',
  },
  {
    label: 'D&D Beyond',
    description: 'O site oficial de Dungeons & Dragons, com os livros digitais e ferramentas.',
    url: 'https://www.dndbeyond.com/',
    access: 'free',
  },
];

/**
 * Página oficial da classe ou espécie no D&D Beyond, com as ilustrações dos livros. A arte é da
 * Wizards of the Coast e não pode ser copiada para o Codexveil (o SRD só libera o texto), então
 * a ficha leva até ela. Endereços curtos conferidos em 2026-10-18 (redirecionam para a página).
 */
export function dnd5eOfficialPageUrl(kind: 'class' | 'species', id: string): string {
  const slug = id.replace(/_/g, '-');
  return `https://www.dndbeyond.com/${kind === 'class' ? 'classes' : 'species'}/${slug}`;
}
