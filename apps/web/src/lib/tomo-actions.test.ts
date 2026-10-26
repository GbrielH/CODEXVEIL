import { describe, expect, it } from 'vitest';
import { extractTomoActions } from './tomo-actions';

describe('ações do Tomo', () => {
  it('separa o texto das propostas válidas', () => {
    const reply = [
      'Aqui está o taverneiro.',
      '```tomo-acao',
      '{"acao":"criar_criatura","tipo":"npc","nome":"Bram","descricao":"Taverneiro","tamanho":"enorme"}',
      '```',
      '```tomo-acao',
      '{"acao":"apagar_tudo"}',
      '```',
      '```tomo-acao',
      'não é json',
      '```',
    ].join('\n');
    const { text, actions } = extractTomoActions(reply);
    expect(text).toBe('Aqui está o taverneiro.');
    expect(actions).toEqual([
      { acao: 'criar_criatura', tipo: 'npc', nome: 'Bram', subtitulo: '', descricao: 'Taverneiro', segredos: '', tamanho: 'medium' },
    ]);
  });

  it('esconde o bloco ainda chegando', () => {
    expect(extractTomoActions('Pronto.\n```tomo-acao\n{"acao":"cri').text).toBe('Pronto.');
  });
});
