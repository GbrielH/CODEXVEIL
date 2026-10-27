'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';

const CARD_WIDTH = 336;
const GAP = 6;
const OPEN_DELAY = 300;
const CLOSE_DELAY = 150;

type Placement = { left: number; top: number } | { left: number; bottom: number };

interface HoverCardProps {
  /** Conteúdo do cartão, criado só quando ele abre (pode carregar dados sob demanda). */
  content: () => ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Cartão de detalhes que aparece ao passar o mouse (só com mouse: no toque e no teclado, a
 * mesma informação fica no conteúdo expandido do item). Fica acima ou abaixo do item, conforme
 * o espaço, e fecha ao rolar a página.
 */
export function HoverCard({ content, children, className }: HoverCardProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const clear = () => window.clearTimeout(timer.current);
  const show = () => {
    clear();
    timer.current = window.setTimeout(() => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - CARD_WIDTH - 8));
      const below = window.innerHeight - rect.bottom;
      setPlacement(
        below >= 300 || below >= rect.top
          ? { left, top: rect.bottom + GAP }
          : { left, bottom: window.innerHeight - rect.top + GAP },
      );
    }, OPEN_DELAY);
  };
  const hide = () => {
    clear();
    timer.current = window.setTimeout(() => setPlacement(null), CLOSE_DELAY);
  };

  useEffect(() => {
    if (!placement) return;
    const close = () => setPlacement(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [placement]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      ref={anchor}
      className={cx('min-w-0', className)}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') show();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') hide();
      }}
      onPointerDown={() => {
        clear();
        setPlacement(null);
      }}
    >
      {children}
      {placement
        ? createPortal(
            <div
              aria-hidden="true"
              onPointerEnter={clear}
              onPointerLeave={hide}
              style={{ ...placement, width: CARD_WIDTH, maxWidth: 'calc(100vw - 16px)' }}
              className="fixed z-[110] max-h-[70vh] overflow-y-auto rounded-lg border border-line-strong bg-raised p-3 text-left text-sm shadow-[0_18px_40px_-12px_rgb(0_0_0/0.85)]"
            >
              {content()}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
