'use client';

import { Maximize2 } from 'lucide-react';
import { useState } from 'react';
import { Modal } from './modal';

/**
 * Abre um texto longo (história, personalidade, aparência) em tela cheia, para ler sem rolar a
 * caixinha. Com `onChange`, também edita ali mesmo.
 */
export function ExpandTextButton({
  title,
  value,
  onChange,
  maxLength,
}: {
  title: string;
  value: string;
  onChange?: ((value: string) => void) | undefined;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-fg-muted hover:bg-hover hover:text-fg"
        aria-label={`Abrir ${title} em tela cheia`}
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Tela cheia
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="full">
        {onChange ? (
          <textarea
            value={value}
            maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
            aria-label={title}
            className="min-h-[60dvh] w-full flex-1 resize-none rounded-md border border-line bg-sunken p-4 font-serif text-lg leading-relaxed text-fg"
          />
        ) : (
          <p className="font-serif text-lg leading-relaxed whitespace-pre-wrap text-fg">{value || '—'}</p>
        )}
      </Modal>
    </>
  );
}
