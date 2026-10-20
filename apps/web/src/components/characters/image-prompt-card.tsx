'use client';

import { Check, Copy, ImageIcon, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Prompt opcional para gerar a imagem do personagem numa IA: copiar ou ignorar. */
export function ImagePromptCard({ prompt }: { prompt: string }) {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  if (hidden) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="flex flex-col gap-2 rounded-md border border-dashed border-line-strong p-4" aria-labelledby="prompt-imagem">
      <div className="flex flex-wrap items-center gap-2">
        <ImageIcon className="h-4 w-4 text-fg-accent" aria-hidden="true" />
        <h3 id="prompt-imagem" className="eyebrow min-w-0 flex-1">
          Prompt para a imagem do personagem (opcional)
        </h3>
        <Button size="sm" variant="secondary" icon={copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} onClick={() => void copy()}>
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" aria-hidden="true" />} onClick={() => setHidden(true)}>
          Ignorar
        </Button>
      </div>
      <p className="text-xs text-fg-muted">Cole numa IA de imagens (ChatGPT, Gemini, Midjourney…) e depois envie a imagem como retrato na ficha.</p>
      <textarea readOnly value={prompt} rows={6} className="w-full resize-y rounded-md border border-line bg-sunken p-3 text-sm text-fg-secondary" onFocus={(event) => event.currentTarget.select()} />
    </section>
  );
}
