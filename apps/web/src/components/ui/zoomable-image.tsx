'use client';

import { X } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

/**
 * Imagem que abre em tela cheia ao clicar (Esc, clique fora ou o X fecham). Dentro de um link,
 * o clique na imagem não navega.
 */
export function ZoomableImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  const show = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };
  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={`Ampliar ${alt || 'imagem'}`}
        onClick={show}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }
        }}
        className="block h-full w-full cursor-zoom-in"
      >
        {/* URL assinada e temporária do Storage privado. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </span>
      {open
        ? createPortal(
            <div
              role="dialog"
              aria-label={alt || 'Imagem'}
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                setOpen(false);
              }}
            >
              <button
                type="button"
                aria-label="Fechar"
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  setOpen(false);
                }}
                className="absolute top-4 right-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="max-h-full max-w-full object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
