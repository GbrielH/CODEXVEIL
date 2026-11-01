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

  it('lê encontros, blocos de roteiro e ficha de estatísticas da criatura', () => {
    const reply = [
      '```tomo-acao',
      '{"acao":"criar_encontro","titulo":"Emboscada","criaturas":[{"nome":"Lobo","quantidade":3,"estatisticas":{"armorClass":13}}],"sessao":2}',
      '```',
      '```tomo-acao',
      '{"acao":"bloco_no_roteiro","sessao":2,"tipo":"nota_do_mestre","texto":"Os lobos fogem com metade da vida."}',
      '```',
    ].join('\n');
    const { actions } = extractTomoActions(reply);
    expect(actions[0]).toMatchObject({ acao: 'criar_encontro', criaturas: [{ nome: 'Lobo', quantidade: 3, tipo: 'monstro' }] });
    expect(actions[1]).toMatchObject({ acao: 'bloco_no_roteiro', tipo: 'nota_do_mestre' });
  });

  it('mostra o formato de estatísticas do sistema da campanha ao mestre', () => {
    expect(tomoActionsPrompt({ campaignRole: 'gm', characterEditable: false, systemId: 'tormenta20' })).toContain('"defense"');
    expect(tomoActionsPrompt({ campaignRole: 'gm', characterEditable: false, systemId: 'assimilacao' })).toContain('"neutralize"');
    expect(tomoActionsPrompt({ campaignRole: 'gm', characterEditable: false, systemId: 'dnd5e' })).toContain('"armorClass"');
  });
});
