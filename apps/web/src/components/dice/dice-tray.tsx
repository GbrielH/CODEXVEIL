'use client';

import type { DiceRoll } from '@codexveil/database';
import type DiceBox from '@3d-dice/dice-box-threejs';
import { describeDiceRoll, naturalD20 } from '@codexveil/domain';
import { ChevronDown, ChevronUp, Dices, Lock } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import { DICE_COLORS, DiceColorPalette, DieIcon, useCampaignColors } from './campaign-colors';
import type { ShownRoll } from './dice-roller';

const subscribeNothing = () => () => undefined;

/** Limite de dados 3D por rolagem (o resto entra só no total), para não pesar no aparelho. */
export const MAX_TRAY_DICE = 6;
const SUPPORTED_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);
const DEFAULT_COLOR = DICE_COLORS[0]!.hex;
const STORAGE_KEY = 'codexveil:dice-tray-open';

export interface TrayRoll {
  key: string;
  roll: Pick<ShownRoll, 'dice' | 'total' | 'label' | 'expression' | 'mode' | 'modifier'>;
  rollerName: string;
  userId: string | null;
  /** Rolagem "Apenas eu e o mestre": só quem rolou e o mestre recebem (o servidor filtra). */
  secret: boolean;
}

/** Quanto tempo o balão com o resultado fica acima da caixinha. */
const BUBBLE_MS = 7000;

/** "2d20+1d6@3,17,4": a notação da biblioteca com o resultado já sorteado pelo servidor. */
function notation(roll: TrayRoll['roll']): string | null {
  const groups: string[] = [];
  const values: number[] = [];
  let used = 0;
  for (const group of roll.dice) {
    if (!SUPPORTED_SIDES.has(group.sides)) continue;
    const take = group.values.slice(0, Math.max(0, MAX_TRAY_DICE - used));
    if (take.length === 0) continue;
    used += take.length;
    groups.push(`${take.length}d${group.sides}`);
    values.push(...take);
  }
  return groups.length ? `${groups.join('+')}@${values.join(',')}` : null;
}

function textColorFor(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const luminance =
    (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance > 0.6 ? '#111111' : '#ffffff';
}

/**
 * Caixinha de dados 3D no canto da tela. Mostra as rolagens da mesa em tempo real, cada uma na
 * cor escolhida por quem rolou; o resultado vem do servidor e o dado só "cai" no número certo.
 */
export function DiceTray({
  campaignId,
  pending,
}: {
  campaignId: string | null;
  pending: TrayRoll | null;
}) {
  const palette = useCampaignColors();
  const containerId = `dados-3d-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const boxRef = useRef<DiceBox | null>(null);
  const queue = useRef<TrayRoll[]>([]);
  const running = useRef(false);
  const seen = useRef(new Set<string>());
  const [open, setOpen] = useState(() => {
    try {
      return typeof window === 'undefined' || window.localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [ready, setReady] = useState(false);
  const [last, setLast] = useState<TrayRoll | null>(null);
  const [picking, setPicking] = useState(false);
  // A caixinha vai para o <body> (portal): dentro do <main>, a animação de entrada (transform) fazia o
  // "fixed" valer em relação ao conteúdo, e ela aparecia no fim da página em vez de presa à tela.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const userId = palette?.userId ?? null;
  const myColor = palette?.myColor ?? null;

  // Cria a cena 3D só quando a caixinha está aberta (a biblioteca é carregada sob demanda).
  useEffect(() => {
    if (!mounted || !open || boxRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    void import('@3d-dice/dice-box-threejs')
      .then(async ({ default: Box }) => {
        if (cancelled) return;
        const box = new Box(`#${containerId}`, {
          sounds: false,
          shadows: false,
          theme_material: 'plastic',
          gravity_multiplier: 400,
          baseScale: 80,
          strength: 1.2,
          light_intensity: 0.9,
        });
        await box.initialize();
        if (cancelled) return;
        boxRef.current = box;
        setReady(true);
      })
      .catch((error: unknown) => console.error('[codexveil] dados 3D indisponíveis', error));
    return () => {
      cancelled = true;
    };
  }, [mounted, open, containerId]);

  const play = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const next = queue.current.shift()!;
      setLast(next);
      const box = boxRef.current;
      const text = notation(next.roll);
      if (box && text) {
        const color = (next.userId ? palette?.colorOfUser(next.userId) : myColor) ?? DEFAULT_COLOR;
        try {
          await box.updateConfig({
            theme_customColorset: {
              name: `cv-${color.slice(1)}`,
              background: color,
              foreground: textColorFor(color),
              outline: '#000000',
              texture: 'none',
              material: 'plastic',
            },
          });
          await box.roll(text);
        } catch (error) {
          console.error('[codexveil] falha ao rolar os dados 3D', error);
        }
      }
    }
    running.current = false;
  }, [palette, myColor]);

  const enqueue = useCallback(
    (roll: TrayRoll) => {
      if (seen.current.has(roll.key)) return;
      seen.current.add(roll.key);
      // Fila curta: se chegarem muitas rolagens juntas, as mais antigas só aparecem no texto.
      queue.current = [...queue.current, roll].slice(-3);
      void play();
    },
    [play],
  );

  useEffect(() => {
    if (pending) enqueue(pending);
  }, [pending, enqueue]);

  // Rolagens dos outros participantes, em tempo real (as próprias já chegam por `pending`).
  useRealtimeRefresh(
    `bandeja-dados:${campaignId ?? 'nenhuma'}`,
    [{ table: 'dice_rolls', filter: `campaign_id=eq.${campaignId ?? ''}` }],
    () => {
      if (!campaignId) return;
      void getSupabaseBrowserClient()
        .from('dice_rolls')
        .select(
          'id, user_id, roller_name, label, dice, total, expression, mode, modifier, visibility',
        )
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          const row = data?.[0];
          if (!row || row.user_id === userId) return;
          enqueue({
            key: row.id,
            userId: row.user_id,
            rollerName: row.roller_name,
            secret: row.visibility === 'gm',
            roll: {
              dice: row.dice as unknown as DiceRoll['dice'],
              total: row.total,
              label: row.label,
              expression: row.expression,
              mode: row.mode as DiceRoll['mode'],
              modifier: row.modifier,
            },
          });
        });
    },
    Boolean(campaignId),
  );

  const [bubbleKey, setBubbleKey] = useState<string | null>(null);
  useEffect(() => {
    if (!last) return;
    const show = window.setTimeout(() => setBubbleKey(last.key), 0);
    const hide = window.setTimeout(
      () => setBubbleKey((current) => (current === last.key ? null : current)),
      BUBBLE_MS,
    );
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [last]);
  const natural = last ? naturalD20(last.roll) : null;

  const toggle = () => {
    setOpen((current) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(!current));
      } catch {
        // Ignora: só lembra a preferência quando há armazenamento local.
      }
      return !current;
    });
  };

  if (!mounted) return null;
  return createPortal(
    <div className="fixed right-3 bottom-20 z-50 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col items-stretch gap-2 lg:bottom-4">
      {/* Resultado da última rolagem, logo acima da caixinha. */}
      <div aria-live="polite" className="min-h-0">
        {last && bubbleKey === last.key ? (
          <div
            className={cx(
              'animate-pop rounded-lg border bg-raised/95 px-3 py-2 shadow-xl backdrop-blur',
              natural === 20
                ? 'border-emerald-400/60'
                : natural === 1
                  ? 'border-red-400/60'
                  : 'border-line-strong',
            )}
          >
            <p className="flex items-baseline gap-2">
              <span className="font-display text-2xl text-fg">{last.roll.total}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
                {last.rollerName}
                {last.roll.label ? ` · ${last.roll.label}` : ''}
              </span>
            </p>
            <p className="truncate text-xs text-fg-muted">
              {describeDiceRoll(last.roll)}
              {natural === 20 ? ' · 20 natural!' : natural === 1 ? ' · 1 natural' : ''}
            </p>
            {last.secret ? (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Apenas quem rolou e o mestre veem
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <aside
        aria-label="Dados"
        className="overflow-hidden rounded-lg border border-line-strong bg-raised/95 shadow-2xl backdrop-blur"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
          <Dices className="h-4 w-4 text-fg-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary">
            {last ? (
              <>
                {last.secret ? (
                  <Lock className="mr-1 inline h-3 w-3 text-amber-300" aria-label="Secreta" />
                ) : null}
                <strong className="text-fg">{last.roll.total}</strong> · {last.rollerName}
                {last.roll.label ? ` · ${last.roll.label}` : ''}
              </>
            ) : (
              'Dados da mesa'
            )}
          </span>
          {palette ? (
            <button
              type="button"
              onClick={() => setPicking((current) => !current)}
              aria-label="Escolher a cor dos seus dados"
              title="Cor dos seus dados"
              className="rounded p-0.5 hover:bg-hover"
            >
              {myColor ? (
                <DieIcon color={myColor} className="h-5 w-5" />
              ) : (
                <span className="block h-5 w-5 rounded border border-dashed border-line-strong" />
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? 'Recolher os dados' : 'Abrir os dados'}
            className="rounded p-0.5 text-fg-muted hover:text-fg"
          >
            {open ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {picking ? (
          <div className="border-b border-line px-3 py-2">
            <DiceColorPalette onPicked={() => setPicking(false)} />
          </div>
        ) : null}
        {/* O canvas da biblioteca fica preso ao tamanho da área (senão ele estica a caixinha). */}
        <div
          id={containerId}
          className={cx(
            'relative h-56 w-full overflow-hidden [&_canvas]:absolute [&_canvas]:inset-0 [&_canvas]:!h-full [&_canvas]:!w-full',
            !open && 'hidden',
          )}
        >
          {!ready ? (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-fg-muted">
              As rolagens aparecem aqui.
            </p>
          ) : null}
        </div>
        <p className="flex items-center gap-1 border-t border-line px-3 py-1 text-[11px] text-fg-muted">
          <Lock className="h-3 w-3" aria-hidden="true" /> = rolagem secreta (só quem rolou e o
          mestre)
        </p>
      </aside>
    </div>,
    document.body,
  );
}
