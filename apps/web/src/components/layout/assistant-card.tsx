'use client';

import { Copy, Send, X } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Mascote: Tomo, o grimório encapuzado que mestra (arte do responsável, em `public/mestre`). */
const MASCOT_NAME = 'Tomo';

/**
 * Assistente de IA: card no menu (acima do perfil/"Sair") que abre um painel de conversa por
 * cima da página atual. O histórico fica só nesta aba do navegador.
 */
export function AssistantCard({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={compact ? `${MASCOT_NAME}, o Mestre (assistente de IA)` : undefined}
        className={
          compact
            ? 'flex h-11 w-11 items-center justify-center rounded-md text-fg-brand hover:bg-hover'
            : 'flex w-full items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5 text-left hover:border-line-strong hover:bg-hover'
        }
      >
        <Image src="/mestre/icone.webp" alt="" width={36} height={36} className={compact ? 'h-8 w-8 rounded-md' : 'h-9 w-9 shrink-0 rounded-md'} />
        {compact ? null : (
          <span className="min-w-0">
            <span className="block text-sm font-medium text-fg">{MASCOT_NAME}, o Mestre</span>
            <span className="block truncate text-xs text-fg-muted">Pergunte sem sair da tela</span>
          </span>
        )}
      </button>
      {/* Portal no body: o menu lateral cria um contexto de empilhamento que prendia o painel atrás da página. */}
      {open ? createPortal(<AssistantPanel onClose={() => setOpen(false)} />, document.body) : null}
    </>
  );
}

function AssistantPanel({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
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
      const maxY = window.innerHeight - 48;
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

  const scrollDown = () => requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));

  async function ask(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setDraft('');
    setBusy(true);
    scrollDown();
    const write = (content: string) =>
      setMessages((current) => [...current.slice(0, -1), { role: 'assistant', content }]);
    try {
      const response = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pathname, messages: next.slice(-20) }),
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
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
      className="fixed right-4 bottom-24 z-[100] flex max-h-[min(640px,calc(100dvh-8rem))] w-[min(420px,calc(100vw-2rem))] flex-col rounded-xl border border-line-strong bg-raised shadow-2xl lg:bottom-6 lg:left-[calc(var(--sidebar-width,16rem)+1rem)] lg:right-auto"
    >
      <header
        onPointerDown={startDrag}
        title="Arraste para mover"
        className="flex cursor-grab touch-none items-center gap-2 border-b border-line px-4 py-3 select-none active:cursor-grabbing"
      >
        <Image src="/mestre/icone.webp" alt="" width={28} height={28} className="h-7 w-7 rounded-md" />
        <h2 className="flex-1 text-sm font-medium text-fg">{MASCOT_NAME}, o Mestre</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <Image src="/mestre/feliz.webp" alt={`${MASCOT_NAME}, o grimório mestre`} width={160} height={154} className="h-auto w-36" />
            <p className="text-sm text-fg-muted">
              Saudações, aventureiro! Eu sou {MASCOT_NAME}. Pergunte sobre regras, a ficha ou a campanha aberta. Só consulto: não mudo
              nada. Posso errar; a regra do livro vale.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === 'user'
                  ? 'self-end rounded-lg bg-ember-400/15 px-3 py-2 text-sm text-fg'
                  : 'group relative self-start rounded-lg border border-line bg-card px-3 py-2 text-sm whitespace-pre-wrap text-fg'
              }
            >
              {message.content ||
                (busy ? (
                  <span className="flex items-center gap-2 text-fg-muted">
                    <Image src="/mestre/pensando.webp" alt="" width={40} height={45} className="h-11 w-10 animate-pulse" />
                    {MASCOT_NAME} está consultando o grimório…
                  </span>
                ) : (
                  ''
                ))}
              {message.role === 'assistant' && message.content ? (
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(message.content)}
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
      <form onSubmit={(event) => void ask(event)} className="flex items-end gap-2 border-t border-line p-3">
        <textarea
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
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          aria-label="Enviar"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
