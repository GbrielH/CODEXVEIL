import { describe, expect, it } from 'vitest';
import { describeTomoAction, extractTomoActions } from './tomo-actions';

describe('ações do Tomo', () => {
  it('lê editar_bloco_roteiro e criar_mapa da resposta', () => {
    const text = [
      'Pronto, confirme abaixo.',
      '```tomo-acao',
      '{"acao":"editar_bloco_roteiro","sessao":2,"trecho":"taverna do porto","novo_texto":"A taverna pega fogo."}',
      '```',
      '```tomo-acao',
      '{"acao":"criar_mapa","sessao":2,"nome":"Docas","colunas":40,"linhas":25,"ativar":true}',
      '```',
    ].join('\n');
    const { text: rest, actions } = extractTomoActions(text);
    expect(rest.trim()).toBe('Pronto, confirme abaixo.');
    expect(actions.map((action) => action.acao)).toEqual(['editar_bloco_roteiro', 'criar_mapa']);
    expect(describeTomoAction(actions[1]!).title).toBe('Criar mapa: Docas');
  });

  it('grade fora do limite volta ao padrão', () => {
    const { actions } = extractTomoActions(
      '```tomo-acao\n{"acao":"criar_mapa","sessao":1,"nome":"X","colunas":500}\n```',
    );
    expect(actions[0]).toMatchObject({ colunas: 30, linhas: 20, ativar: false });
  });
});
