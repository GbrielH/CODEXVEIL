'use client';

import { ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { prepareImage } from '@/lib/images';
import { CampaignCover } from './campaign-cover';

/**
 * Capa escolhida no formulário de criação. A imagem é reduzida no navegador e vai no campo
 * `cover` do formulário; a ação do servidor envia ao Storage depois de criar a campanha.
 */
export function CoverPicker({ name }: { name: string }) {
  const id = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const choose = async (original: File) => {
    setError(null);
    setBusy(true);
    try {
      const prepared = await prepareImage(original, 'scene');
      if (!prepared.ok) {
        setError(prepared.message);
        return;
      }
      const transfer = new DataTransfer();
      transfer.items.add(prepared.file);
      if (fieldRef.current) fieldRef.current.files = transfer.files;
      setPreview(URL.createObjectURL(prepared.file));
    } catch {
      setError('Não foi possível ler a imagem.');
    } finally {
      setBusy(false);
      if (pickerRef.current) pickerRef.current.value = '';
    }
  };

  const clear = () => {
    if (fieldRef.current) fieldRef.current.value = '';
    setPreview(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-fg">Capa da campanha</p>
      <CampaignCover url={preview} name={name} className="aspect-[16/9] w-full rounded-md border border-line" />
      <input
        ref={pickerRef}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void choose(file);
        }}
      />
      {/* Campo enviado com o formulário: recebe a imagem já reduzida. */}
      <input ref={fieldRef} type="file" name="cover" className="hidden" tabIndex={-1} aria-hidden="true" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" loading={busy} onClick={() => pickerRef.current?.click()} icon={<ImageUp className="h-4 w-4" aria-hidden="true" />}>
          {preview ? 'Trocar imagem' : 'Escolher imagem'}
        </Button>
        {preview ? (
          <Button size="sm" variant="ghost" onClick={clear} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
            Remover
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-fg-muted">Opcional. Aparece no painel e na lista de campanhas de todos os participantes. PNG, JPEG ou WebP.</p>
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
