'use client';

import {
  CAMPAIGN_MEDIA_BUCKET,
  countTavernUnread,
  deleteTavernMessage,
  tavernImagePath,
  listFriends,
  listMyCampaigns,
  listTavernMessages,
  signedMediaUrls,
  sendTavernMessage,
  subscribeToChanges,
  type TavernChannel,
  type TavernMessage,
} from '@codexveil/database';
import { Beer, Paperclip, Pin, ScrollText, Send, Trash2, Users, X } from 'lucide-react';
import Image from 'next/image';
import { TomoChat } from '@/components/layout/assistant-card';
import { IMAGE_EXTENSIONS } from '@codexveil/validation';
import { prepareImage } from '@/lib/images';
import type { AvatarIcon } from '@codexveil/validation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
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
  /** Capa da campanha (endereço assinado), quando há. */
  cover?: string | null;
}

/** Cores dos selos das campanhas (escolhida pelo nome, sempre a mesma para a mesma campanha). */
const SEAL_COLORS = [
  'from-wine-600 to-wine-800',
  'from-arcane-400 to-wine-700',
  'from-ember-400 to-wine-700',
  'from-verdigris-400 to-charcoal-800',
  'from-amber-400 to-ember-900',
];
const sealColor = (text: string) =>
  SEAL_COLORS[[...text].reduce((sum, char) => sum + char.charCodeAt(0), 0) % SEAL_COLORS.length]!;

const subscribeNothing = () => () => undefined;
const time = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Taverna: chat livre e flutuante (arrastável, acima até do Tomo). Grupos = campanhas em que a
 * pessoa participa e amigos (conversa direta). Mensagens somem depois de 24 horas.
 */
/** Quando a pessoa leu cada grupo (neste navegador): `c:<campanha>` ou `f:<amigo>` → data ISO. */
const readKey = (userId: string) => `codexveil:taverna-lidas:${userId}`;
function readMarks(userId: string): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(readKey(userId)) ?? '{}') as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}
function saveMark(userId: string, channelId: string) {
  try {
    window.localStorage.setItem(
      readKey(userId),
      JSON.stringify({ ...readMarks(userId), [channelId]: new Date().toISOString() }),
    );
  } catch {
    // Sem armazenamento: o contador volta a contar ao recarregar.
  }
}

/** Estado compartilhado entre o card do menu e a janela: aberta? quantas não lidas? */
let shared = { open: false, total: 0 };
const listeners = new Set<() => void>();
function setShared(next: Partial<typeof shared>) {
  shared = { ...shared, ...next };
  listeners.forEach((listener) => listener());
}
function useShared() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => shared,
    () => shared,
  );
}
const TOMO_ID = 'tomo';

/** Card do menu lateral (no lugar do antigo card do Tomo): abre a Taverna e mostra as não lidas. */
export function TavernCard({ compact = false }: { compact?: boolean }) {
  const { total } = useShared();
  const badge = total ? (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[0.65rem] font-bold text-white">
      {total > 99 ? '99+' : total}
    </span>
  ) : null;
  return (
    <button
      type="button"
      onClick={() => setShared({ open: true })}
      aria-label={compact ? (total ? `Taverna (${total} não lidas)` : 'Taverna') : undefined}
      className={
        compact
          ? 'relative flex h-11 w-11 items-center justify-center rounded-md text-fg-accent hover:bg-hover'
          : 'flex w-full items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5 text-left hover:border-line-strong hover:bg-hover'
      }
    >
      <span
        className={cx(
          'flex shrink-0 items-center justify-center rounded-md bg-wine-900/60 text-fg-accent',
          compact ? 'h-8 w-8' : 'h-9 w-9',
        )}
      >
        <Beer className="h-5 w-5" aria-hidden="true" />
      </span>
      {compact ? (
        total ? (
          <span className="absolute -top-0.5 -right-0.5">{badge}</span>
        ) : null
      ) : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-fg">Taverna</span>
            <span className="block truncate text-xs text-fg-muted">Grupo, amigos e o Tomo</span>
          </span>
          {badge}
        </>
      )}
    </button>
  );
}

export function TavernHost() {
  const { open } = useShared();
  const setOpen = (value: boolean) => setShared({ open: value });
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  useEffect(() => {
    void getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Não lidas: mensagens de outras pessoas depois da última leitura de cada grupo (até 24 h atrás).
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      setUnread(
        await countTavernUnread(getSupabaseBrowserClient(), userId, readMarks(userId), dayAgo),
      );
    } catch {
      // Sem contador agora; tenta de novo na próxima mensagem.
    }
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    return subscribeToChanges(
      getSupabaseBrowserClient(),
      'taverna-aviso',
      [{ table: 'tavern_messages' }],
      { onChange: () => void refresh() },
    );
  }, [userId, refresh]);

  const markRead = useCallback(
    (channelId: string) => {
      if (!userId) return;
      saveMark(userId, channelId);
      setUnread((current) => ({ ...current, [channelId]: 0 }));
    },
    [userId],
  );

  const total = Object.values(unread).reduce((sum, value) => sum + value, 0);
  useEffect(() => setShared({ total }), [total]);
  if (!mounted) return null;
  return createPortal(
    <>
      {open ? (
        <TavernPanel
          onClose={() => {
            setOpen(false);
            void refresh();
          }}
          unread={unread}
          onRead={markRead}
        />
      ) : null}
    </>,
    document.body,
  );
}

function TavernPanel({
  onClose,
  unread,
  onRead,
}: {
  onClose: () => void;
  unread: Record<string, number>;
  onRead: (channelId: string) => void;
}) {
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
      const [campaigns, friends] = await Promise.all([
        listMyCampaigns(client, id),
        listFriends(client, id),
      ]);
      const covers = await signedMediaUrls(
        client,
        campaigns.map((campaign) => campaign.coverPath),
      );
      const options: ChannelOption[] = [
        ...campaigns
          .filter((campaign) => campaign.status === 'active')
          .map((campaign): ChannelOption => ({
            id: `c:${campaign.id}`,
            label: campaign.name,
            group: 'Campanhas',
            channel: { kind: 'campaign', campaignId: campaign.id },
            cover: campaign.coverPath ? (covers[campaign.coverPath] ?? null) : null,
          })),
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
      onRead(selected.id);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    } catch (cause) {
      setError(failureMessage(cause, 'Não foi possível carregar as mensagens.'));
    }
  }, [selected, userId, onRead]);

  useEffect(() => {
    if (!selected) return;
    const filter =
      selected.channel.kind === 'campaign'
        ? `campaign_id=eq.${selected.channel.campaignId}`
        : undefined;
    return subscribeToChanges(
      getSupabaseBrowserClient(),
      `taverna-${selected.id}`,
      [{ table: 'tavern_messages', ...(filter ? { filter } : {}) }],
      {
        onChange: () => void load(),
      },
    );
  }, [selected, load]);

  // Imagens das mensagens: endereços assinados, renovados a cada recarga da conversa.
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = messages
      .map((message) => message.imagePath)
      .filter((path): path is string => Boolean(path) && !imageUrls[path!]);
    if (!paths.length) return;
    void signedMediaUrls(getSupabaseBrowserClient(), paths).then((urls) =>
      setImageUrls((current) => ({ ...current, ...urls })),
    );
  }, [messages, imageUrls]);

  const [image, setImage] = useState<File | null>(null);
  const [tomoThinking, setTomoThinking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if ((!body && !image) || !selected || busy || !userId) return;
    setBusy(true);
    setError(null);
    try {
      const client = getSupabaseBrowserClient();
      let imagePath: string | null = null;
      if (image) {
        const prepared = await prepareImage(image, 'scene');
        if (!prepared.ok) throw new Error(prepared.message);
        imagePath = tavernImagePath(
          selected.channel,
          userId,
          `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[prepared.mimeType]}`,
        );
        const { error: uploadError } = await client.storage
          .from(CAMPAIGN_MEDIA_BUCKET)
          .upload(imagePath, prepared.file, { contentType: prepared.mimeType, upsert: false });
        if (uploadError) throw uploadError;
      }
      await sendTavernMessage(client, selected.channel, body, imagePath);
      setDraft('');
      setImage(null);
      await load();
      // "@tomo" chama o Tomo para responder na conversa.
      if (/@tomo\b/i.test(body)) {
        setTomoThinking(true);
        void fetch('/api/taverna/tomo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ channel: selected.channel }),
        })
          .then(async (response) => {
            if (!response.ok) setError(await response.text());
            await load();
          })
          .catch(() => setError('O Tomo não conseguiu responder agora.'))
          .finally(() => setTomoThinking(false));
      }
    } catch (cause) {
      setError(
        cause instanceof Error && !('code' in cause)
          ? cause.message
          : failureMessage(cause, 'A mensagem não foi enviada.'),
      );
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
        x: Math.min(
          Math.max(0, moveEvent.clientX - offsetX),
          Math.max(0, window.innerWidth - rect.width),
        ),
        y: Math.min(
          Math.max(0, moveEvent.clientY - offsetY),
          Math.max(0, window.innerHeight - rect.height),
        ),
      });
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    event.preventDefault();
  };

  const groups = (['Campanhas', 'Amigos'] as const).map((group) => ({
    group,
    items: (channels ?? []).filter((option) => option.group === group),
  }));
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Taverna"
      style={
        position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined
      }
      className="fixed bottom-20 left-3 z-[110] flex h-[min(560px,calc(100dvh-7rem))] w-[min(560px,calc(100vw-1.5rem))] flex-col rounded-xl border border-line-strong bg-raised shadow-2xl lg:bottom-4 lg:left-[calc(var(--sidebar-width,16rem)+1rem)]"
    >
      <header
        onPointerDown={startDrag}
        className="flex cursor-move items-center gap-2 border-b border-line px-3 py-2 select-none"
      >
        <Beer className="h-4 w-4 text-fg-accent" aria-hidden="true" />
        <h2 className="flex-1 font-display text-base">Taverna</h2>
        <span className="hidden text-xs text-fg-muted sm:inline">mensagens somem em 24 h</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar a Taverna"
          className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Grupos"
          className="hidden w-48 shrink-0 overflow-y-auto border-r border-line bg-sunken/40 p-2 sm:block"
        >
          {/* O Tomo fica fixado no topo: conversa só sua com o assistente. */}
          <button
            type="button"
            onClick={() => setCurrent(TOMO_ID)}
            aria-current={current === TOMO_ID ? 'true' : undefined}
            className={cx(
              'mb-4 flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm transition-colors',
              current === TOMO_ID
                ? 'border-wine-400/60 bg-wine-900/60 text-fg'
                : 'border-line bg-card/60 text-fg-secondary hover:bg-hover hover:text-fg',
            )}
          >
            <Image
              src="/mestre/icone.webp"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-md"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Tomo</span>
              <span className="block truncate text-[0.65rem] text-fg-muted">
                fixado · só você vê
              </span>
            </span>
            <Pin className="h-3 w-3 shrink-0 text-fg-muted" aria-hidden="true" />
          </button>
          {groups.map(({ group, items }) =>
            items.length ? (
              <section key={group} className="mb-4">
                <h3 className="mb-1.5 flex items-center gap-1.5 px-1 font-display text-xs tracking-wider text-fg-accent">
                  {group === 'Campanhas' ? (
                    <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {group}
                  <span className="ml-auto rounded-full bg-hover px-1.5 text-[0.6rem] text-fg-muted">
                    {items.length}
                  </span>
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
                          {option.group === 'Campanhas' && option.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element -- capa da campanha (endereço assinado do Storage)
                            <img
                              src={option.cover}
                              alt=""
                              className="h-7 w-7 shrink-0 rounded-md object-cover ring-1 ring-white/10"
                            />
                          ) : option.group === 'Campanhas' ? (
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
                            <Avatar
                              name={option.label}
                              icon={option.icon ?? null}
                              size="sm"
                              className="!h-7 !w-7"
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate">{option.label}</span>
                          {!active && unread[option.id] ? (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.6rem] font-bold text-white">
                              {unread[option.id]! > 99 ? '99+' : unread[option.id]}
                            </span>
                          ) : null}
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
            <option value={TOMO_ID}>📌 Tomo (assistente)</option>
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
          {current === TOMO_ID ? (
            <TomoChat />
          ) : (
            <>
              <div
                ref={listRef}
                className="relative flex-1 space-y-2 overflow-y-auto px-3 py-2"
                aria-live="polite"
              >
                {channels === null ? (
                  <p className="text-sm text-fg-muted">Abrindo a Taverna…</p>
                ) : channels.length === 0 ? (
                  <p className="text-sm text-fg-muted">
                    Entre numa campanha ou adicione amigos para conversar aqui.
                  </p>
                ) : messages.length === 0 ? (
                  // Chat vazio: a cena da taverna (campanhas e amigos têm a sua) com o convite por cima.
                  <div className="absolute inset-0 flex flex-col items-center justify-end overflow-hidden px-6 pb-8 text-center">
                    <Image
                      src={
                        selected?.group === 'Amigos'
                          ? '/taverna/amigos.webp'
                          : '/taverna/campanhas.webp'
                      }
                      alt=""
                      fill
                      sizes="400px"
                      className="object-cover"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-raised via-raised/40 to-transparent"
                    />
                    <p className="relative font-display text-lg text-parchment-100 drop-shadow">
                      {selected?.group === 'Amigos'
                        ? 'Uma mesa só para vocês…'
                        : 'A taverna está quieta…'}
                    </p>
                    <p className="relative max-w-xs text-sm text-fg-secondary">
                      Ninguém falou nada nas últimas 24 horas. Puxe uma cadeira! Escreva @tomo para
                      chamar o Tomo.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = message.senderId === userId && !message.fromTomo;
                    return (
                      <div
                        key={message.id}
                        className={cx('group flex gap-2', mine && 'flex-row-reverse')}
                      >
                        {message.fromTomo ? (
                          <Image
                            src="/mestre/icone.webp"
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 shrink-0 rounded-full bg-sunken"
                          />
                        ) : (
                          <Avatar name={message.senderName} icon={message.senderIcon} size="sm" />
                        )}
                        <div
                          className={cx(
                            'max-w-[75%] rounded-lg px-3 py-1.5 text-sm',
                            message.fromTomo
                              ? 'border border-wine-400/50 bg-wine-950/60 text-fg'
                              : mine
                                ? 'bg-wine-800 text-parchment-50'
                                : 'bg-sunken text-fg',
                          )}
                        >
                          {message.fromTomo ? (
                            <p className="text-xs font-semibold text-fg-accent">
                              Tomo · a pedido de {message.senderName}
                            </p>
                          ) : !mine ? (
                            <p className="text-xs font-semibold text-fg-accent">
                              {message.senderName}
                            </p>
                          ) : null}
                          {message.imagePath && imageUrls[message.imagePath] ? (
                            <a href={imageUrls[message.imagePath]} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- endereço assinado do Storage */}
                              <img
                                src={imageUrls[message.imagePath]}
                                alt="Imagem enviada"
                                className="my-1 max-h-60 rounded-md object-contain"
                              />
                            </a>
                          ) : null}
                          {message.body ? (
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          ) : null}
                          <p className="mt-0.5 flex items-center justify-end gap-2 text-[0.65rem] opacity-70">
                            {time(message.createdAt)}
                            {mine ? (
                              <button
                                type="button"
                                aria-label="Apagar mensagem"
                                className="hidden group-hover:inline"
                                onClick={() =>
                                  void deleteTavernMessage(
                                    getSupabaseBrowserClient(),
                                    message.id,
                                  ).then(load)
                                }
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
              {tomoThinking ? (
                <p className="px-3 text-xs text-fg-muted">O Tomo está consultando o grimório…</p>
              ) : null}
              {image ? (
                <div className="flex items-center gap-2 px-3 text-xs text-fg-secondary">
                  Imagem: {image.name}
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    aria-label="Tirar a imagem"
                    className="text-fg-muted hover:text-fg"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="px-3 text-xs text-danger">
                  {error}
                </p>
              ) : null}
              <form
                onSubmit={(event) => void send(event)}
                className="flex gap-2 border-t border-line p-2"
              >
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    setImage(event.target.files?.[0] ?? null);
                    event.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={!selected}
                  onClick={() => fileInput.current?.click()}
                  aria-label="Anexar imagem"
                  title="Anexar imagem (ou cole com Ctrl+V)"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                </button>
                <input
                  onPaste={(event) => {
                    const file = [...event.clipboardData.files].find((entry) =>
                      entry.type.startsWith('image/'),
                    );
                    if (file) {
                      event.preventDefault();
                      setImage(file);
                    }
                  }}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={1000}
                  disabled={!selected}
                  placeholder={
                    selected
                      ? `Mensagem para ${selected.label}… (@tomo chama o Tomo)`
                      : 'Escolha um grupo'
                  }
                  aria-label="Mensagem"
                  className="h-10 min-w-0 flex-1 rounded-md border border-line bg-sunken px-3 text-sm text-fg"
                />
                <button
                  type="submit"
                  disabled={busy || (!draft.trim() && !image) || !selected}
                  aria-label="Enviar"
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-wine-600 text-parchment-50 hover:bg-wine-500 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
