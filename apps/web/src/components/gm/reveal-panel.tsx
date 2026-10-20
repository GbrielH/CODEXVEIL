'use client';

import { publishSession, updateSessionBlock } from '@codexveil/database';
import type { SharedVisibility } from '@codexveil/domain';
import { Eye, EyeOff, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export interface RevealBlock {
  id: string;
  label: string;
  preview: string;
  imageUrl: string | null;
  visibility: SharedVisibility;
}

interface RevealPanelProps {
  sessionId: string;
  isPublished: boolean;
  isActive: boolean;
  blocks: RevealBlock[];
}

/**
 * Lore da sessão na mesa do mestre: tudo nasce oculto e cada trecho (texto, imagem de NPC,
 * frase…) é liberado aos jogadores com um clique. Eles veem os trechos na aba Sessão.
 */
export function RevealPanel({
  sessionId,
  isPublished,
  isActive,
  blocks: initial,
}: RevealPanelProps) {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState(initial);
  const [published, setPublished] = useState(isPublished);
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (block: RevealBlock) => {
    const next: SharedVisibility = block.visibility === 'gm' ? 'members' : 'gm';
    setBusy(block.id);
    try {
      const client = getSupabaseBrowserClient();
      await updateSessionBlock(client, block.id, { visibility: next });
      // Os jogadores só enxergam sessões publicadas: o primeiro trecho liberado publica a sessão.
      if (next === 'members' && !published) {
        await publishSession(client, sessionId);
        setPublished(true);
      }
      setBlocks((current) =>
        current.map((entry) => (entry.id === block.id ? { ...entry, visibility: next } : entry)),
      );
      toast({
        tone: 'success',
        title: next === 'members' ? 'Liberado para os jogadores.' : 'Ocultado dos jogadores.',
      });
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível mudar o trecho',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(null);
    }
  };

  const released = blocks.filter((block) => block.visibility === 'members').length;

  return (
    <Card>
      <CardHeader
        icon={<Megaphone className="h-5 w-5" aria-hidden="true" />}
        title="Lore da sessão"
        description={`${released} de ${blocks.length} trechos liberados. Os jogadores veem os liberados na aba Sessão.`}
      />
      {blocks.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Escreva o roteiro da sessão no editor; cada bloco aparece aqui oculto, pronto para
          liberar.
        </p>
      ) : (
        <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
          {blocks.map((block) => {
            const open = block.visibility === 'members';
            return (
              <li
                key={block.id}
                className={cx(
                  'flex items-start gap-3 rounded-md border px-3 py-2',
                  open ? 'border-parchment-300/50 bg-wine-900/30' : 'border-line',
                )}
              >
                {block.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária.
                  <img
                    src={block.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fg-muted">{block.label}</p>
                  <p className="line-clamp-2 text-sm">{block.preview || '—'}</p>
                </div>
                <Button
                  size="sm"
                  variant={open ? 'ghost' : 'secondary'}
                  disabled={!isActive}
                  loading={busy === block.id}
                  icon={
                    open ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )
                  }
                  onClick={() => void toggle(block)}
                >
                  {open ? 'Ocultar' : 'Liberar'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
