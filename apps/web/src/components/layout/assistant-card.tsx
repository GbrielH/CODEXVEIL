'use client';

import { Copy, Send, Sparkles, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
        aria-label={compact ? 'Assistente de IA' : undefined}
        className={
          compact
            ? 'flex h-11 w-11 items-center justify-center rounded-md text-fg-brand hover:bg-hover'
            : 'flex w-full items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5 text-left hover:border-line-strong hover:bg-hover'
        }
      >
        <Sparkles className="h-5 w-5 shrink-0 text-fg-brand" aria-hidden="true" />
        {compact ? null : (
          <span className="min-w-0">
            <span className="block text-sm font-medium text-fg">Mestre</span>
            <span className="block truncate text-xs text-fg-muted">Pergunte ao Mestre sem sair da tela</span>
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
      role="dialog"
      aria-label="Assistente de IA"
      className="fixed right-4 bottom-24 z-[100] flex max-h-[min(640px,calc(100dvh-8rem))] w-[min(420px,calc(100vw-2rem))] flex-col rounded-xl border border-line-strong bg-raised shadow-2xl lg:bottom-6 lg:left-[calc(var(--sidebar-width,16rem)+1rem)] lg:right-auto"
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Sparkles className="h-4 w-4 text-fg-brand" aria-hidden="true" />
        <h2 className="flex-1 text-sm font-medium text-fg">Mestre</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-sm text-fg-muted">
            Pergunte sobre regras, a ficha ou a campanha aberta. O assistente só consulta: não muda nada. Ele pode errar; a regra do
            livro vale.
          </p>
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
              {message.content || (busy ? '…' : '')}
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
