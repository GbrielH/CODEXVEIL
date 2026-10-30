'use client';

import { AssistantMarkdown } from './assistant-markdown';
import { TomoActionCard, type TomoActionDone } from './tomo-action-card';
import { VoiceInputButton } from './voice-input';
import { extractTomoActions } from '@/lib/tomo-actions';
import { Copy, Paperclip, Send, X } from 'lucide-react';
import { prepareImageForUpload } from '@/lib/images';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Miniaturas das imagens anexadas (só na memória desta aba). */
  images?: string[];
  /** Campanha e personagem abertos quando o Tomo respondeu (as ações propostas valem para eles). */
  campaignId?: string;
  characterId?: string;
  /** Ações já gravadas, por posição na resposta. */
  done?: Record<number, TomoActionDone>;
}

interface Attachment {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Base64 sem o prefixo `data:`. */
  data: string;
  preview: string;
}

/** Reduz a imagem no navegador (até 1600 px) e devolve o base64 para a pergunta. */
async function toAttachment(file: File): Promise<Attachment | null> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return null;
  const prepared = await prepareImageForUpload(file, 'scene');
  const preview = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('leitura'));
    reader.readAsDataURL(prepared.file);
  });
  const mimeType = (prepared.file.type || 'image/webp') as Attachment['mimeType'];
  return { mimeType, data: preview.slice(preview.indexOf(',') + 1), preview };
}

/** Mascote: Tomo, o grimório encapuzado que mestra (arte do responsável, em `public/mestre`). */
const MASCOT_NAME = 'Tomo';

/*
 * Estado do chat fora dos componentes: mudar de aba ou de página não fecha o painel nem apaga a
 * conversa. O texto fica também no sessionStorage desta aba, então recarregar a página (ex.: ao
 * criar uma campanha) não apaga; fechar a aba apaga. Nada vai para o servidor. As imagens
 * anexadas não são guardadas (só o texto).
 */
interface AssistantState {
  open: boolean;
  messages: ChatMessage[];
}
const EMPTY: AssistantState = { open: false, messages: [] };
const STORAGE_KEY = 'codexveil:tomo-chat';
let state: AssistantState = EMPTY;
let restored = false;
const listeners = new Set<() => void>();

function readState(): AssistantState {
  if (!restored && typeof window !== 'undefined') {
    restored = true;
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) state = { ...EMPTY, ...(JSON.parse(saved) as Partial<AssistantState>) };
    } catch {
      // Sem armazenamento: começa do zero.
    }
  }
  return state;
}

function setState(update: (current: AssistantState) => AssistantState) {
  state = update(readState());
  try {
    const messages = state.messages
      .slice(-40)
      .map(({ role, content, campaignId, characterId, done }) => ({
        role,
        content,
        campaignId,
        characterId,
        done,
      }));
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ open: state.open, messages }));
  } catch {
    // Sem armazenamento (ou cheio): vale só nesta página.
  }
  for (const listener of listeners) listener();
}

function useAssistantState(): AssistantState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readState,
    () => EMPTY,
  );
}

/**
 * Assistente de IA: card no menu (acima do perfil/"Sair") que abre um painel de conversa por
 * cima da página atual. O histórico fica só nesta aba do navegador.
 */
export function AssistantCard({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <button
        type="button"
        onClick={() => setState((current) => ({ ...current, open: true }))}
        aria-label={compact ? `${MASCOT_NAME}, o Mestre (assistente de IA)` : undefined}
        className={
          compact
            ? 'flex h-11 w-11 items-center justify-center rounded-md text-fg-brand hover:bg-hover'
            : 'flex w-full items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5 text-left hover:border-line-strong hover:bg-hover'
        }
      >
        <Image
          src="/mestre/icone.webp"
          alt=""
          width={36}
          height={36}
          className={compact ? 'h-8 w-8 rounded-md' : 'h-9 w-9 shrink-0 rounded-md'}
        />
        {compact ? null : (
          <span className="min-w-0">
            <span className="block text-sm font-medium text-fg">{MASCOT_NAME}, o Mestre</span>
            <span className="block truncate text-xs text-fg-muted">Pergunte sem sair da tela</span>
          </span>
        )}
      </button>
    </>
  );
}

/**
 * O painel do chat, montado uma vez só no layout (os cards só o abrem). Portal no body: o menu
 * lateral cria um contexto de empilhamento que prendia o painel atrás da página.
 */
export function AssistantHost() {
  const { open } = useAssistantState();
  return open
    ? createPortal(
        <AssistantPanel onClose={() => setState((current) => ({ ...current, open: false }))} />,
        document.body,
      )
    : null;
}

/** Chat do Tomo dentro de outra janela (a Taverna): sem moldura, cabeçalho nem arrasto. */
export function TomoChat() {
  return <AssistantPanel onClose={() => undefined} embedded />;
}

function AssistantPanel({
  onClose,
  embedded = false,
}: {
  onClose: () => void;
  embedded?: boolean;
}) {
  const pathname = usePathname();
  const { messages } = useAssistantState();
  const setMessages = (update: ChatMessage[] | ((current: ChatMessage[]) => ChatMessage[])) =>
    setState((current) => ({
      ...current,
      messages: typeof update === 'function' ? update(current.messages) : update,
    }));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const addFiles = async (files: Iterable<File>) => {
    const added = (
      await Promise.all([...files].slice(0, 3).map((file) => toAttachment(file).catch(() => null)))
    ).filter((item): item is Attachment => item !== null);
    setAttachments((current) => [...current, ...added].slice(0, 3));
  };
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Posição escolhida ao arrastar pelo cabeçalho (sem ela, o painel fica no canto padrão).
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button') || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const move = (moveEvent: PointerEvent) => {
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      setPosition({
        x: Math.min(Math.max(0, moveEvent.clientX - offsetX), Math.max(0, maxX)),
        y: Math.min(Math.max(0, moveEvent.clientY - offsetY), Math.max(0, maxY)),
      });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    event.preventDefault();
  };

  const scrollDown = () =>
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));

  async function ask(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim() || (attachments.length ? 'O que você vê nesta imagem?' : '');
    if (!question || busy) return;
    const sending = attachments;
    const next: ChatMessage[] = [
      ...messages,
      {
        role: 'user',
        content: question,
        ...(sending.length ? { images: sending.map((item) => item.preview) } : {}),
      },
    ];
    const campaignId = /^\/campanhas\/([0-9a-f-]{36})/.exec(pathname)?.[1];
    const characterId = /^\/personagens\/([0-9a-f-]{36})/.exec(pathname)?.[1];
    setMessages([
      ...next,
      {
        role: 'assistant',
        content: '',
        ...(campaignId ? { campaignId } : {}),
        ...(characterId ? { characterId } : {}),
      },
    ]);
    setDraft('');
    setAttachments([]);
    setBusy(true);
    scrollDown();
    const write = (content: string) =>
      setMessages((current) => [...current.slice(0, -1), { role: 'assistant', content }]);
    try {
      const response = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pathname,
          messages: next.slice(-20).map(({ role, content }) => ({ role, content })),
          images: sending.map(({ mimeType, data }) => ({ mimeType, data })),
        }),
      });
      if (!response.ok || !response.body) {
        write(await response.text());
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        write(answer);
        scrollDown();
      }
    } catch {
      write('Sem conexão com o assistente. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Assistente de IA"
      style={
        position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined
      }
      className={
        embedded
          ? 'flex min-h-0 flex-1 flex-col'
          : 'fixed right-4 bottom-24 z-[100] flex max-h-[min(640px,calc(100dvh-8rem))] w-[min(420px,calc(100vw-2rem))] flex-col rounded-xl border border-line-strong bg-raised shadow-2xl lg:bottom-6 lg:left-[calc(var(--sidebar-width,16rem)+1rem)] lg:right-auto'
      }
    >
      {embedded ? null : (
        <header
          onPointerDown={startDrag}
          title="Arraste para mover"
          className="flex cursor-grab touch-none items-center gap-2 border-b border-line px-4 py-3 select-none active:cursor-grabbing"
        >
          <Image
            src="/mestre/icone.webp"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-md"
          />
          <h2 className="flex-1 text-sm font-medium text-fg">{MASCOT_NAME}, o Mestre</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
      )}
      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="relative m-auto flex max-w-sm flex-col items-center gap-3 py-4 text-center">
            {/* Boas-vindas: o Tomo grande, com um halo arcano atrás. */}
            <span
              aria-hidden="true"
              className="absolute top-6 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgb(124_92_220/0.35),transparent_70%)] blur-md"
            />
            <Image
              src="/mestre/feliz.webp"
              alt={`${MASCOT_NAME}, o grimório mestre`}
              width={240}
              height={231}
              className="relative h-auto w-52 drop-shadow-[0_12px_30px_rgb(107_59_198/0.55)]"
            />
            <p className="relative font-display text-xl text-fg-accent">Saudações, aventureiro!</p>
            <p className="relative text-sm text-fg-muted">
              Eu sou {MASCOT_NAME}. Pergunte sobre regras, a ficha ou a campanha aberta, ou peça
              para eu criar algo: você confirma antes de gravar. Posso errar; a regra do livro vale.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === 'user'
                  ? 'self-end rounded-lg bg-ember-400/15 px-3 py-2 text-sm text-fg'
                  : 'group relative self-start rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg'
              }
            >
              {message.images?.length ? (
                <span className="mb-1 flex flex-wrap gap-1">
                  {message.images.map((src, imageIndex) => (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura local (data: URL) da imagem anexada
                    <img
                      key={imageIndex}
                      src={src}
                      alt="Imagem anexada"
                      className="h-16 w-16 rounded object-cover"
                    />
                  ))}
                </span>
              ) : null}
              {(message.content && message.role === 'assistant' ? (
                <AssistantMarkdown text={extractTomoActions(message.content).text} />
              ) : (
                message.content
              )) ||
                (busy ? (
                  <span className="flex items-center gap-2 text-fg-muted">
                    <Image
                      src="/mestre/pensando.webp"
                      alt=""
                      width={40}
                      height={45}
                      className="h-11 w-10 animate-pulse"
                    />
                    {MASCOT_NAME} está consultando o grimório…
                  </span>
                ) : (
                  ''
                ))}
              {message.role === 'assistant' && !(busy && index === messages.length - 1)
                ? extractTomoActions(message.content).actions.map((action, actionIndex) => (
                    <TomoActionCard
                      key={actionIndex}
                      scope={{ campaignId: message.campaignId, characterId: message.characterId }}
                      action={action}
                      done={message.done?.[actionIndex]}
                      onDone={(result) =>
                        setMessages((current) =>
                          current.map((entry, position) =>
                            position === index
                              ? { ...entry, done: { ...entry.done, [actionIndex]: result } }
                              : entry,
                          ),
                        )
                      }
                    />
                  ))
                : null}
              {message.role === 'assistant' && message.content ? (
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(extractTomoActions(message.content).text)
                  }
                  aria-label="Copiar resposta"
                  className="absolute -top-2 -right-2 hidden rounded border border-line bg-raised p-1 text-fg-muted group-hover:block hover:text-fg"
                >
                  <Copy className="h-3 w-3" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
      {attachments.length ? (
        <div className="flex gap-2 border-t border-line px-3 pt-2">
          {attachments.map((item, index) => (
            <span key={index} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (data: URL) */}
              <img
                src={item.preview}
                alt="Imagem anexada"
                className="h-14 w-14 rounded-md border border-line object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  setAttachments((current) => current.filter((_, position) => position !== index))
                }
                aria-label="Remover imagem"
                className="absolute -top-1.5 -right-1.5 rounded-full border border-line bg-raised p-0.5 text-fg-muted hover:text-fg"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <form
        onSubmit={(event) => void ask(event)}
        className="relative flex items-end gap-2 border-t border-line p-3"
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={busy || attachments.length >= 3}
          onClick={() => fileInput.current?.click()}
          aria-label="Anexar imagem"
          title="Anexar imagem (até 3; também dá para colar)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
        </button>
        <textarea
          onPaste={(event) => {
            const files = [...event.clipboardData.files].filter((file) =>
              file.type.startsWith('image/'),
            );
            if (files.length) {
              event.preventDefault();
              void addFiles(files);
            }
          }}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) void ask(event);
          }}
          maxLength={2000}
          rows={2}
          placeholder="Sua pergunta…"
          className="min-h-0 flex-1 resize-none rounded-md border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none focus:border-line-strong"
        />
        {/* Ditado por voz: o texto entra na caixa e a pessoa confere antes de enviar. */}
        <VoiceInputButton value={draft} onChange={setDraft} disabled={busy} />
        <button
          type="submit"
          disabled={busy || (!draft.trim() && attachments.length === 0)}
          aria-label="Enviar"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
