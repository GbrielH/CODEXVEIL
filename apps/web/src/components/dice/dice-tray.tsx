'use client';

import { listCampaignDiceColors, setMyDiceColor, type DiceRoll } from '@codexveil/database';
import type DiceBox from '@3d-dice/dice-box-threejs';
import { ChevronDown, ChevronUp, Dices } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import type { ShownRoll } from './dice-roller';

/** Limite de dados 3D por rolagem (o resto entra só no total), para não pesar no aparelho. */
export const MAX_TRAY_DICE = 6;
const SUPPORTED_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);
export const DICE_COLORS = ['#7a1f2b', '#b23a48', '#d98e04', '#2f7d4a', '#1f6f8b', '#3b4cb8', '#6b3fa0', '#c2c2c8', '#222226', '#c46a2a'];
const DEFAULT_COLOR = DICE_COLORS[0]!;
const STORAGE_KEY = 'codexveil:dice-tray-open';

export interface TrayRoll {
  key: string;
  roll: Pick<ShownRoll, 'dice' | 'total' | 'label'>;
  rollerName: string;
  userId: string | null;
}

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
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance > 0.6 ? '#111111' : '#ffffff';
}

/**
 * Caixinha de dados 3D no canto da tela. Mostra as rolagens da mesa em tempo real, cada uma na
 * cor escolhida por quem rolou; o resultado vem do servidor e o dado só "cai" no número certo.
 */
export function DiceTray({ campaignId, pending }: { campaignId: string | null; pending: TrayRoll | null }) {
  const { toast } = useToast();
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
  const [colors, setColors] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const myColor = (userId && colors[userId]) || DEFAULT_COLOR;

  useEffect(() => {
    void getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    listCampaignDiceColors(getSupabaseBrowserClient(), campaignId)
      .then((next) => {
        if (active) setColors(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [campaignId]);

  // Cria a cena 3D só quando a caixinha está aberta (a biblioteca é carregada sob demanda).
  useEffect(() => {
    if (!open || boxRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    void import('@3d-dice/dice-box-threejs')
      .then(async ({ default: Box }) => {
        if (cancelled) return;
        const box = new Box(`#${containerId}`, { sounds: false, shadows: false, theme_material: 'plastic', gravity_multiplier: 400, baseScale: 80, strength: 1.2, light_intensity: 0.9 });
        await box.initialize();
        if (cancelled) return;
        boxRef.current = box;
        setReady(true);
      })
      .catch((error: unknown) => console.error('[codexveil] dados 3D indisponíveis', error));
    return () => {
      cancelled = true;
    };
  }, [open, containerId]);

  const play = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const next = queue.current.shift()!;
      setLast(next);
      const box = boxRef.current;
      const text = notation(next.roll);
      if (box && text) {
        const owner = next.userId ?? userId;
        const color = (owner && colors[owner]) || DEFAULT_COLOR;
        try {
          await box.updateConfig({ theme_customColorset: { name: `cv-${color.slice(1)}`, background: color, foreground: textColorFor(color), outline: '#000000', texture: 'none', material: 'plastic' } });
          await box.roll(text);
        } catch (error) {
          console.error('[codexveil] falha ao rolar os dados 3D', error);
        }
      }
    }
    running.current = false;
  }, [colors, userId]);

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
        .select('id, user_id, roller_name, label, dice, total')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          const row = data?.[0];
          if (!row || row.user_id === userId) return;
          enqueue({ key: row.id, userId: row.user_id, rollerName: row.roller_name, roll: { dice: row.dice as unknown as DiceRoll['dice'], total: row.total, label: row.label } });
        });
    },
    Boolean(campaignId),
  );

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

  const choose = async (color: string) => {
    if (!campaignId || !userId) return;
    try {
      await setMyDiceColor(getSupabaseBrowserClient(), campaignId, color);
      setColors((current) => ({ ...current, [userId]: color }));
      setPicking(false);
    } catch (error) {
      toast({ tone: 'danger', title: 'A cor não foi salva', description: failureMessage(error, 'Tente novamente.') });
    }
  };

  return (
    <aside aria-label="Dados" className="fixed right-3 bottom-3 z-50 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-line-strong bg-raised/95 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
        <Dices className="h-4 w-4 text-fg-accent" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary">
          {last ? (
            <>
              <strong className="text-fg">{last.roll.total}</strong> · {last.rollerName}
              {last.roll.label ? ` · ${last.roll.label}` : ''}
            </>
          ) : (
            'Dados da mesa'
          )}
        </span>
        {campaignId ? (
          <button
            type="button"
            onClick={() => setPicking((current) => !current)}
            aria-label="Escolher a cor dos seus dados"
            title="Cor dos seus dados"
            className="h-5 w-5 rounded-full border border-line-strong"
            style={{ backgroundColor: myColor }}
          />
        ) : null}
        <button type="button" onClick={toggle} aria-label={open ? 'Recolher os dados' : 'Abrir os dados'} className="rounded p-0.5 text-fg-muted hover:text-fg">
          {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {picking ? (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2" role="radiogroup" aria-label="Cor dos seus dados">
          {DICE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={color === myColor}
              aria-label={`Cor ${color}`}
              onClick={() => void choose(color)}
              className={cx('h-6 w-6 rounded-full border', color === myColor ? 'border-parchment-200 ring-2 ring-parchment-300' : 'border-line-strong')}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      ) : null}
      <div id={containerId} className={cx('relative h-40 w-full', !open && 'hidden')}>
        {!ready ? <p className="absolute inset-0 flex items-center justify-center text-xs text-fg-muted">As rolagens aparecem aqui.</p> : null}
      </div>
    </aside>
  );
}
