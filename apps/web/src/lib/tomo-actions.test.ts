import { describe, expect, it } from 'vitest';
import { extractTomoActions, tomoActionsPrompt } from './tomo-actions';

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

  it('aceita as ações novas e corrige valores fora da lista', () => {
    const reply = ['```tomo-acao', '{"acao":"item_no_personagem","nome":"Corda","categoria":"corda","quantidade":0}', '```'].join('\n');
    expect(extractTomoActions(reply).actions).toEqual([
      { acao: 'item_no_personagem', nome: 'Corda', categoria: 'gear', quantidade: 1, descricao: '' },
    ]);
  });

  it('só oferece ações de mestre ao mestre', () => {
    expect(tomoActionsPrompt({ campaignRole: 'player', characterEditable: false })).not.toContain('criar_criatura');
    expect(tomoActionsPrompt({ campaignRole: 'gm', characterEditable: false })).toContain('criar_criatura');
    expect(tomoActionsPrompt({ campaignRole: null, characterEditable: false })).toContain('criar_personagem');
  });
});
