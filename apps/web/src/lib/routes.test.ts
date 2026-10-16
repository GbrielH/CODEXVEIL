import { describe, expect, it } from 'vitest';
import { campaignPath, characterPath, isGuestOnlyPath, isPrivatePath, routes, sessionPath, signInPath } from './routes';

describe('rotas privadas', () => {
  it('protege painel, campanhas, personagens, perfil e convites', () => {
    for (const path of ['/painel', '/campanhas', '/campanhas/abc/sessoes', '/personagens/x', '/perfil', '/convite/ABCD']) {
      expect(isPrivatePath(path)).toBe(true);
    }
  });

  it('não confunde prefixos parecidos', () => {
    expect(isPrivatePath('/painelzinho')).toBe(false);
    expect(isPrivatePath('/')).toBe(false);
    expect(isPrivatePath('/licencas')).toBe(false);
  });

  it('páginas de visitante não fazem sentido para quem já entrou', () => {
    expect(isGuestOnlyPath(routes.signIn)).toBe(true);
    expect(isGuestOnlyPath(routes.resetPassword)).toBe(false);
  });
});

describe('caminho de login', () => {
  it('preserva o destino e o motivo', () => {
    expect(signInPath('/campanhas/1')).toBe('/entrar?next=%2Fcampanhas%2F1');
    expect(signInPath('/perfil', 'sessao-expirada')).toBe('/entrar?next=%2Fperfil&motivo=sessao-expirada');
  });

  it('omite o destino padrão', () => {
    expect(signInPath(routes.dashboard)).toBe('/entrar');
  });
});

describe('construtores de caminho', () => {
  it('montam os caminhos usados nos links', () => {
    expect(campaignPath('c1')).toBe('/campanhas/c1');
    expect(campaignPath('c1', '/biblioteca')).toBe('/campanhas/c1/biblioteca');
    expect(characterPath('p1')).toBe('/personagens/p1');
    expect(sessionPath('c1', 's1', '/editar')).toBe('/campanhas/c1/sessoes/s1/editar');
  });
});
