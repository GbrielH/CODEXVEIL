'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Largura máxima do painel. */
  size?: 'md' | 'lg' | 'full';
  /** Impede fechar (Esc/botão) enquanto uma operação está em andamento. */
  busy?: boolean;
}

const subscribeNothing = () => () => undefined;

/**
 * Janela modal (formulários). Não usa o `showModal()` nativo: ele põe a janela numa camada acima
 * de tudo e deixa o resto da página inerte, e o Tomo (camada 100) precisa continuar por cima e
 * clicável enquanto o jogador preenche um formulário. Aqui: portal no <body>, fundo escuro na
 * camada 89, janela na 90, Esc fecha e o foco vai para o primeiro campo ao abrir. Confirmações
 * (ConfirmDialog) continuam nativas, acima de tudo.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  busy = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  const close = () => {
    if (!busy) onClose();
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(
      'input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
    );
    (first ?? dialog)?.focus();
    const onKey = (event: KeyboardEvent) => {
      // Com uma confirmação nativa aberta por cima, o Esc é dela (não fecha este formulário).
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('dialog[open]')) return;
      closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;
  return createPortal(
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[89] bg-overlay" />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          className={cx(
            'max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-lg border border-line-strong bg-raised text-fg shadow-overlay outline-none',
            size === 'full' ? 'h-[calc(100dvh-2rem)] max-w-5xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
          )}
        >
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-xl leading-tight">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm text-fg-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
