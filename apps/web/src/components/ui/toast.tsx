'use client';

import { X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from '@/lib/cx';

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (message: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: 'border-verdigris-400/50',
  info: 'border-arcane-400/50',
  warning: 'border-amber-400/50',
  danger: 'border-ember-400/60',
};

const toneDot: Record<ToastTone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/**
 * Notificações temporárias. Ficam numa região `aria-live` para serem anunciadas por
 * leitores de tela; erros usam `assertive`. Somem após alguns segundos ou ao fechar.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const toast = useCallback(
    (message: Omit<ToastMessage, 'id'>) => {
      const id = nextId.current++;
      setMessages((current) => [...current.slice(-3), { ...message, id }]);
      window.setTimeout(() => dismiss(id), message.tone === 'danger' ? 8000 : 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 lg:items-end lg:pr-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            role={message.tone === 'danger' ? 'alert' : 'status'}
            className={cx(
              'animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border bg-raised px-4 py-3 shadow-overlay',
              toneStyles[message.tone],
            )}
          >
            <span
              className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneDot[message.tone])}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{message.title}</p>
              {message.description ? (
                <p className="mt-0.5 text-sm text-fg-muted">{message.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(message.id)}
              className="-m-1 rounded p-1 text-fg-muted hover:text-fg"
              aria-label="Fechar notificação"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  }
  return context;
}
