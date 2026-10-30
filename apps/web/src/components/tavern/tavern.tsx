'use client';

import {
  deleteTavernMessage,
  listFriends,
  listMyCampaigns,
  listTavernMessages,
  sendTavernMessage,
  subscribeToChanges,
  type TavernChannel,
  type TavernMessage,
} from '@codexveil/database';
import { Beer, ScrollText, Send, Trash2, Users, X } from 'lucide-react';
import type { AvatarIcon } from '@codexveil/validation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '@/components/ui/avatar';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface ChannelOption {
  id: string;
  label: string;
  group: 'Campanhas' | 'Amigos';
  channel: TavernChannel;
  /** Retrato do amigo (campanhas usam o selo com a inicial). */
  icon?: AvatarIcon | null;
}

/** Cores dos selos das campanhas (escolhida pelo nome, sempre a mesma para a mesma campanha). */
const SEAL_COLORS = ['from-wine-600 to-wine-800', 'from-arcane-400 to-wine-700', 'from-ember-400 to-wine-700', 'from-verdigris-400 to-charcoal-800', 'from-amber-400 to-ember-900'];
const sealColor = (text: string) => SEAL_COLORS[[...text].reduce((sum, char) => sum + char.charCodeAt(0), 0) % SEAL_COLORS.length]!;

const subscribeNothing = () => () => undefined;
const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Taverna: chat livre e flutuante (arrastável, acima até do Tomo). Grupos = campanhas em que a
 * pessoa participa e amigos (conversa direta). Mensagens somem depois de 24 horas.
 */
export function TavernHost() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  // Avisa (bolinha no botão) quando chega mensagem com a janela fechada.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    let first = true;
    return subscribeToChanges(client, 'taverna-aviso', [{ table: 'tavern_messages' }], {
      onChange: () => {
        if (first) {
          first = false;
          return;
        }
        if (!openRef.current) setUnread(true);
      },
    });
  }, []);

  if (!mounted) return null;
  return createPortal(
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setUnread(false);
          }}
          aria-label="Abrir a Taverna"
          title="Taverna: converse com o grupo e com amigos"
          className="fixed bottom-20 left-3 z-[110] flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-raised text-fg-accent shadow-xl hover:bg-hover lg:bottom-4 lg:left-[calc(var(--sidebar-width,16rem)+1rem)]"
        >
          <Beer className="h-5 w-5" aria-hidden="true" />
          {unread ? <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-ember-400 ring-2 ring-raised" aria-label="Mensagens novas" /> : null}
        </button>
      ) : (
        <TavernPanel onClose={() => setOpen(false)} />
      )}
    </>,
    document.body,
  );
}

function TavernPanel({ onClose }: { onClose: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelOption[] | null>(null);
  const [current, setCurrent] = useState<string>('');
  const [messages, setMessages] = useState<TavernMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    void (async () => {
      const { data } = await client.auth.getUser();
      const id = data.user?.id;
      if (!id) return;
      setUserId(id);
      const [campaigns, friends] = await Promise.all([listMyCampaigns(client, id), listFriends(client, id)]);
      const options: ChannelOption[] = [
        ...campaigns
          .filter((campaign) => campaign.status === 'active')
          .map((campaign): ChannelOption => ({ id: `c:${campaign.id}`, label: campaign.name, group: 'Campanhas', channel: { kind: 'campaign', campaignId: campaign.id } })),
        ...friends
          .filter((friend) => friend.status === 'accepted')
          .map((friend): ChannelOption => ({
            id: `f:${friend.userId}`,
            label: friend.displayName,
            group: 'Amigos',
            channel: { kind: 'direct', friendId: friend.userId },
            icon: friend.avatarIcon,
          })),
      ];
      setChannels(options);
      setCurrent((existing) => existing || options[0]?.id || '');
    })().catch(() => setChannels([]));
  }, []);

  const selected = channels?.find((option) => option.id === current) ?? null;
  const load = useCallback(async () => {
    if (!selected || !userId) return;
    try {
      setMessages(await listTavernMessages(getSupabaseBrowserClient(), userId, selected.channel));
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível carregar as mensagens.'));
    }
  }, [selected, userId]);

  useEffect(() => {
    if (!selected) return;
    const filter = selected.channel.kind === 'campaign' ? `campaign_id=eq.${selected.channel.campaignId}` : undefined;
    return subscribeToChanges(getSupabaseBrowserClient(), `taverna-${selected.id}`, [{ table: 'tavern_messages', ...(filter ? { filter } : {}) }], {
      onChange: () => void load(),
    });
  }, [selected, load]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendTavernMessage(getSupabaseBrowserClient(), selected.channel, body);
      setDraft('');
      await load();
    } catch (cause) {
      setError(failureMessage(cause, 'A mensagem não foi enviada.'));
    } finally {
      setBusy(false);
    }
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, select') || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const move = (moveEvent: PointerEvent) =>
      setPosition({
        x: Math.min(Math.max(0, moveEvent.clientX - offsetX), Math.max(0, window.innerWidth - rect.width)),
        y: Math.min(Math.max(0, moveEvent.clientY - offsetY), Math.max(0, window.innerHeight - rect.height)),
      });
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    event.preventDefault();
  };

  const groups = (['Campanhas', 'Amigos'] as const).map((group) => ({ group, items: (channels ?? []).filter((option) => option.group === group) }));
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Taverna"
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
      className="fixed bottom-20 left-3 z-[110] flex h-[min(560px,calc(100dvh-7rem))] w-[min(560px,calc(100vw-1.5rem))] flex-col rounded-xl border border-line-strong bg-raised shadow-2xl lg:bottom-4 lg:left-[calc(var(--sidebar-width,16rem)+1rem)]"
    >
      <header onPointerDown={startDrag} className="flex cursor-move items-center gap-2 border-b border-line px-3 py-2 select-none">
        <Beer className="h-4 w-4 text-fg-accent" aria-hidden="true" />
        <h2 className="flex-1 font-display text-base">Taverna</h2>
        <span className="hidden text-xs text-fg-muted sm:inline">mensagens somem em 24 h</span>
        <button type="button" onClick={onClose} aria-label="Fechar a Taverna" className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Grupos" className="hidden w-48 shrink-0 overflow-y-auto border-r border-line bg-sunken/40 p-2 sm:block">
          {groups.map(({ group, items }) =>
            items.length ? (
              <section key={group} className="mb-4">
                <h3 className="mb-1.5 flex items-center gap-1.5 px-1 font-display text-xs tracking-wider text-fg-accent">
                  {group === 'Campanhas' ? <ScrollText className="h-3.5 w-3.5" aria-hidden="true" /> : <Users className="h-3.5 w-3.5" aria-hidden="true" />}
                  {group}
                  <span className="ml-auto rounded-full bg-hover px-1.5 text-[0.6rem] text-fg-muted">{items.length}</span>
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {items.map((option) => {
                    const active = option.id === current;
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          title={option.label}
                          onClick={() => setCurrent(option.id)}
                          aria-current={active ? 'true' : undefined}
                          className={cx(
                            'relative flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-2.5 text-left text-sm transition-colors',
                            active
                              ? 'bg-gradient-to-r from-wine-800/70 to-transparent text-fg before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-wine-400'
                              : 'text-fg-secondary hover:bg-hover hover:text-fg',
                          )}
                        >
                          {option.group === 'Campanhas' ? (
                            <span
                              aria-hidden="true"
                              className={cx(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br font-display text-xs text-parchment-50 ring-1 ring-white/10',
                                sealColor(option.label),
                              )}
                            >
                              {option.label.trim().charAt(0).toUpperCase()}
                            </span>
                          ) : (
                            <Avatar name={option.label} icon={option.icon ?? null} size="sm" className="!h-7 !w-7" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null,
          )}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Celular: os grupos viram uma lista de seleção. */}
          <select
            aria-label="Grupo"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className="m-2 h-9 rounded-md border border-line bg-sunken px-2 text-sm text-fg sm:hidden"
          >
            {groups.map(({ group, items }) =>
              items.length ? (
                <optgroup key={group} label={group}>
                  {items.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2" aria-live="polite">
            {channels === null ? (
              <p className="text-sm text-fg-muted">Abrindo a Taverna…</p>
            ) : channels.length === 0 ? (
              <p className="text-sm text-fg-muted">Entre numa campanha ou adicione amigos para conversar aqui.</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-fg-muted">Ninguém falou nada nas últimas 24 horas. Puxe uma cadeira!</p>
            ) : (
              messages.map((message) => {
                const mine = message.senderId === userId;
                return (
                  <div key={message.id} className={cx('group flex gap-2', mine && 'flex-row-reverse')}>
                    <Avatar name={message.senderName} icon={message.senderIcon} size="sm" />
                    <div className={cx('max-w-[75%] rounded-lg px-3 py-1.5 text-sm', mine ? 'bg-wine-800 text-parchment-50' : 'bg-sunken text-fg')}>
                      {!mine ? <p className="text-xs font-semibold text-fg-accent">{message.senderName}</p> : null}
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className="mt-0.5 flex items-center justify-end gap-2 text-[0.65rem] opacity-70">
                        {time(message.createdAt)}
                        {mine ? (
                          <button
                            type="button"
                            aria-label="Apagar mensagem"
                            className="hidden group-hover:inline"
                            onClick={() => void deleteTavernMessage(getSupabaseBrowserClient(), message.id).then(load)}
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        ) : null}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {error ? (
            <p role="alert" className="px-3 text-xs text-danger">
              {error}
            </p>
          ) : null}
          <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-line p-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={1000}
              disabled={!selected}
              placeholder={selected ? `Mensagem para ${selected.label}…` : 'Escolha um grupo'}
              aria-label="Mensagem"
              className="h-10 min-w-0 flex-1 rounded-md border border-line bg-sunken px-3 text-sm text-fg"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || !selected}
              aria-label="Enviar"
              className="flex h-10 w-10 items-center justify-center rounded-md bg-wine-600 text-parchment-50 hover:bg-wine-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
