import type { ContentLicense } from '../types';

/**
 * O módulo Tormenta20 implementa as regras de jogo (mecânicas, perícias, condições, cálculos),
 * que o próprio livro declara Conteúdo Open Game sob a OGL 1.0a (página 393). Nomes, descrições
 * e textos do livro — raças, classes, poderes, magias, deuses e o mundo de Arton — não estão no
 * código: vêm do pacote que cada usuário importa a partir do próprio exemplar. Tormenta, Arton e
 * os termos do universo são Identidade do Produto da Jambô Editora.
 */
export const tormenta20License: ContentLicense = {
  work: 'Tormenta20 — Edição Jogo do Ano (regras)',
  licenseName: 'Open Game License v1.0a',
  licenseUrl: 'https://opengamingfoundation.org/ogl.html',
  sourceUrl: 'https://jamboeditora.com.br/categoria-produto/tormenta20/',
  attribution:
    'Regras de jogo do Tormenta20, Copyright © 1999-2023 Leonel Caldela, Marcelo Cassaro, Guilherme Dei Svaldi, ' +
    'Rafael Dei Svaldi e J. M. Trevisan, declaradas Conteúdo Open Game sob a Open Game License v1.0a. Tormenta, ' +
    'Arton e os termos do universo Tormenta são Identidade do Produto e não são reproduzidos. Open Game License ' +
    'v1.0a Copyright 2000, Wizards of the Coast, Inc.',
};
