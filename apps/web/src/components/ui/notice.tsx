import { Alert, type AlertTone } from './alert';

/**
 * Avisos exibidos após redirecionamentos (ex.: `?aviso=senha-alterada`). Apenas chaves
 * conhecidas são aceitas: a URL nunca injeta texto arbitrário na página.
 */
const notices = {
  'senha-alterada': { tone: 'success', text: 'Senha alterada com sucesso.' },
  'campanha-criada': { tone: 'success', text: 'Campanha criada. Convide seus jogadores quando quiser.' },
  'campanha-criada-sem-capa': {
    tone: 'warning',
    text: 'Campanha criada, mas a capa não foi enviada. Tente de novo em Configurações.',
  },
  'campanha-excluida': { tone: 'success', text: 'A campanha foi excluída definitivamente.' },
  'campanha-arquivada': { tone: 'success', text: 'Campanha arquivada. Os dados continuam preservados.' },
  'saiu-da-campanha': { tone: 'info', text: 'Você saiu da campanha. Seus personagens continuam com você.' },
  'convite-aceito': { tone: 'success', text: 'Bem-vindo à mesa! Você agora participa desta campanha.' },
  'convite-recusado': { tone: 'info', text: 'Convite recusado.' },
  'perfil-salvo': { tone: 'success', text: 'Perfil atualizado.' },
  'personagem-criado': { tone: 'success', text: 'Personagem criado. Complete a ficha quando quiser — tudo é salvo automaticamente.' },
  'personagem-excluido': { tone: 'success', text: 'O personagem foi excluído definitivamente.' },
  'sessao-excluida': { tone: 'success', text: 'A sessão e o roteiro foram excluídos.' },
  'registro-excluido': { tone: 'success', text: 'O registro foi removido da biblioteca.' },
  'item-excluido': { tone: 'success', text: 'O item foi removido da biblioteca.' },
} satisfies Record<string, { tone: AlertTone; text: string }>;

export type NoticeKey = keyof typeof notices;

export function Notice({ value }: { value: string | string[] | undefined }) {
  const key = typeof value === 'string' ? value : undefined;
  if (!key || !(key in notices)) return null;
  const notice = notices[key as NoticeKey];
  return <Alert tone={notice.tone}>{notice.text}</Alert>;
}
