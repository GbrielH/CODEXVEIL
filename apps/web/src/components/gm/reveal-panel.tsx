'use client';

import { publishSession, updateSessionBlock } from '@codexveil/database';
import type { SharedVisibility } from '@codexveil/domain';
import { Dices, Eye, EyeOff, Megaphone, Search } from 'lucide-react';
import { useState } from 'react';
import { useDice } from '@/components/dice/dice-roller';
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
  /** Bloco de Teste: perícia, DT e rolagem do botão do mestre. */
  check?: { skill: string; dc: number | null; expression: string | null };
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
  const dice = useDice();
  const [rolls, setRolls] = useState<Record<string, { total: number; passed: boolean | null }>>({});

  // Rola o teste em segredo (só os mestres veem no mural) e compara com a DT.
  const rollCheck = async (block: RevealBlock) => {
    const check = block.check;
    if (!dice || !check?.expression) return;
    const label = `Teste: ${check.skill || 'sem perícia'}${check.dc !== null ? ` (DT ${check.dc})` : ''}`;
    const shown = await dice.roll({ expression: check.expression, label, mode: 'normal', secret: true });
    if (!shown) return;
    setRolls((current) => ({
      ...current,
      [block.id]: { total: shown.total, passed: check.dc === null ? null : shown.total >= check.dc },
    }));
  };

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
          Nada marcado para liberar. No editor do roteiro, marque “Para liberar na mesa” nos blocos que você
          pretende mostrar; o resto fica como roteiro só seu.
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
                  <p className="flex items-center gap-1 text-xs text-fg-muted">
                    {block.check ? <Search className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                    {block.label}
                  </p>
                  <p className="line-clamp-2 text-sm">{block.preview || '—'}</p>
                  {rolls[block.id] ? (
                    <p
                      className={cx(
                        'mt-1 text-xs font-semibold',
                        rolls[block.id]!.passed === null ? 'text-fg-secondary' : rolls[block.id]!.passed ? 'text-verdigris-300' : 'text-ember-300',
                      )}
                    >
                      Rolou {rolls[block.id]!.total}
                      {rolls[block.id]!.passed === null ? '' : rolls[block.id]!.passed ? ' · passou' : ' · não passou'}
                    </p>
                  ) : null}
                </div>
                {block.check?.expression && dice ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!isActive}
                    icon={<Dices className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => void rollCheck(block)}
                    title={`Rolar ${block.check.expression} em segredo`}
                  >
                    Rolar
                  </Button>
                ) : null}
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
                  {open ? 'Ocultar' : block.check ? 'Liberar achado' : 'Liberar'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
