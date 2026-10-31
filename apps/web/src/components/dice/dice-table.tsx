'use client';

import type { DiceRoll } from '@codexveil/database';
import type DiceBox from '@3d-dice/dice-box-threejs';
import { describeDiceRoll } from '@codexveil/domain';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import { DICE_COLORS, useCampaignColors } from './campaign-colors';
import { TABLE_SETTLED_EVENT, throwDice } from './dice-scene';
import { applyDiceLook } from './dice-look';
import { diceNotation, textColorFor, type TrayRoll } from './dice-tray';

const DEFAULT_COLOR = DICE_COLORS[0]!.hex;
/** Quanto tempo uma rolagem fica visível na mesa para todos (inclusive quem chega depois). */
const VISIBLE_MS = 10_000;

/**
 * Mesa de dados grande da aba Dados: todos os participantes veem, ao vivo, os dados de cada
 * rolagem aberta caindo (as ocultas, "só para o mestre", não aparecem aqui).
 */
export function DiceTable({ campaignId }: { campaignId: string }) {
  const containerId = `mesa-dados-${useId().replace(/:/g, '')}`;
  const colors = useCampaignColors();
  const boxRef = useRef<DiceBox | null>(null);
  const queue = useRef<(TrayRoll & { expiresAt: number })[]>([]);
  const running = useRef(false);
  const seen = useRef(new Set<string>());
  const [current, setCurrent] = useState<TrayRoll | null>(null);
  const [last, setLast] = useState<TrayRoll | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  // Marca a página: a caixinha de dados espera esta mesa antes de mostrar o resultado.
  useEffect(() => {
    document.documentElement.dataset.diceTable = 'on';
    return () => {
      delete document.documentElement.dataset.diceTable;
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const off = window.setTimeout(() => setUnavailable(true), 0);
      return () => window.clearTimeout(off);
    }
    let cancelled = false;
    void import('@3d-dice/dice-box-threejs')
      .then(async ({ default: Box }) => {
        if (cancelled) return;
        const box = new Box(`#${containerId}`, {
          sounds: false,
          shadows: true,
          theme_material: 'plastic',
          gravity_multiplier: 400,
          baseScale: 90,
          strength: 1.4,
          light_intensity: 0.9,
        });
        await box.initialize();
        if (!cancelled) boxRef.current = box;
      })
      .catch((error: unknown) => {
        console.error('[codexveil] mesa de dados 3D indisponível', error);
        setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [containerId]);

  const play = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const next = queue.current.shift()!;
      // Ao abrir a aba, a cena 3D ainda está carregando: espera até 3 s por ela.
      for (let waited = 0; !boxRef.current && waited < 3000; waited += 200)
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      const box = boxRef.current;
      const text = diceNotation(next.roll);
      // Fila atrasada (muita gente rolando junto): a que já passou do tempo na mesa vai direto
      // para o resultado, sem animação, para as seguintes não ficarem cada vez mais para trás.
      const late = Date.now() > next.expiresAt;
      setCurrent(late ? null : next);
      if (box && text && !late) {
        const color = colors?.colorOfUser(next.userId) ?? DEFAULT_COLOR;
        const look = colors?.lookOfUser(next.userId) ?? null;
        try {
          await applyDiceLook(box, 'mesa', color, textColorFor(color), look);
          // Fica na mesa até completar os 10 s desde a rolagem (mínimo de 4 s para dar para ver).
          await throwDice(box, text, Math.max(4000, next.expiresAt - Date.now()));
        } catch (error) {
          console.error('[codexveil] falha ao rolar na mesa', error);
        }
      }
      setCurrent(null);
      setLast(next);
      document.dispatchEvent(new CustomEvent(TABLE_SETTLED_EVENT, { detail: next.key }));
    }
    running.current = false;
  }, [colors]);

  useRealtimeRefresh(
    `mesa-dados:${campaignId}`,
    [{ table: 'dice_rolls', filter: `campaign_id=eq.${campaignId}` }],
    () => {
      void getSupabaseBrowserClient()
        .from('dice_rolls')
        .select(
          'id, user_id, roller_name, label, dice, total, expression, mode, modifier, visibility, created_at',
        )
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data }) => {
          // Rolagens abertas dos últimos 10 s: quem abre a aba logo depois ainda vê os dados.
          const now = Date.now();
          const fresh = (data ?? [])
            .filter((row) => row.visibility !== 'gm' && !seen.current.has(row.id))
            .filter((row) => now - new Date(row.created_at).getTime() < VISIBLE_MS)
            .reverse();
          for (const row of data ?? []) seen.current.add(row.id);
          if (fresh.length === 0) return;
          queue.current = [
            ...queue.current,
            ...fresh.map((row) => ({
              key: row.id,
              userId: row.user_id,
              rollerName: row.roller_name,
              secret: false,
              expiresAt: new Date(row.created_at).getTime() + VISIBLE_MS,
              roll: {
                dice: row.dice as unknown as DiceRoll['dice'],
                total: row.total,
                label: row.label,
                expression: row.expression,
                mode: row.mode as DiceRoll['mode'],
                modifier: row.modifier,
              },
            })),
          ].slice(-8);
          void play();
        });
    },
  );

  const shown = current ?? last;
  return (
    <div className="relative h-[28rem] overflow-hidden rounded-xl border border-parchment-400/25 bg-[radial-gradient(ellipse_at_center,rgb(60_30_90/0.55),rgb(11_11_15/0.95))] shadow-inner">
      <div
        id={containerId}
        aria-hidden="true"
        className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full"
      />
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-4 text-center"
      >
        {shown ? (
          <>
            <p className="text-sm text-fg-secondary">
              {shown.rollerName}
              {shown.roll.label ? ` · ${shown.roll.label}` : ''}
            </p>
            {current ? (
              <p className="font-display text-xl text-fg-muted">Rolando…</p>
            ) : (
              <>
                <p className="font-display text-4xl text-fg-accent">{shown.roll.total}</p>
                <p className="text-xs text-fg-muted">{describeDiceRoll(shown.roll)}</p>
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-fg-muted">
            {unavailable
              ? 'Animação dos dados desligada neste aparelho; os resultados aparecem aqui.'
              : 'As rolagens abertas da mesa caem aqui, ao vivo, para todos.'}
          </p>
        )}
      </div>
    </div>
  );
}
