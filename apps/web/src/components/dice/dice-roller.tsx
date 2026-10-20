'use client';

import { getSessionState, rollDice, type DiceRoll } from '@codexveil/database';
import {
  COMMON_DICE,
  DICE_ROLL_MODES,
  describeDiceRoll,
  diceRollModeLabels,
  naturalD20,
  parseDiceExpression,
  rollDiceLocally,
  type DiceRollMode,
  type DiceRollResult,
} from '@codexveil/domain';
import { Dices, EyeOff } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/control-classes';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import { DiceTray, type TrayRoll } from './dice-tray';

export interface RollRequest {
  expression: string;
  label?: string;
  mode?: DiceRollMode;
  /** Rolagem secreta: só o mestre (e quem rolou) vê. */
  secret?: boolean;
}

export type ShownRoll = Pick<DiceRollResult, 'expression' | 'mode' | 'dice' | 'modifier' | 'total'> & {
  label: string;
  secret: boolean;
};

interface DiceContextValue {
  /** Rola e mostra o resultado (no mural da campanha, quando houver). */
  roll: (request: RollRequest) => Promise<ShownRoll | null>;
  campaignId: string | null;
  /** Sessão presencial com dados físicos: os dados virtuais somem e a ficha só indica o que rolar. */
  physical: boolean;
}

const DiceContext = createContext<DiceContextValue | null>(null);

function fromServer(roll: DiceRoll): ShownRoll {
  return { ...roll, secret: roll.visibility === 'gm' };
}

/**
 * Rolagens da ficha e da campanha. Em campanha, o dado é rolado no servidor e vai para o
 * mural do mestre; sem campanha, rola no próprio navegador.
 */
export function DiceProvider({
  campaignId,
  characterId = null,
  enabled = true,
  sessionGate = false,
  children,
}: {
  campaignId: string | null;
  characterId?: string | null;
  /** Desligado: os botões de rolar somem (ex.: ficha de outro jogador). */
  enabled?: boolean;
  /**
   * Ficha dentro da campanha ("Meu personagem"): os botões continuam, mas só rolam com a sessão
   * em andamento (e sem dados presenciais); fora dela, o clique avisa que está indisponível.
   */
  sessionGate?: boolean;
  children: ReactNode;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState<TrayRoll | null>(null);
  const [physical, setPhysical] = useState(false);
  const gated = Boolean(campaignId && sessionGate);
  useEffect(() => {
    if (!gated || !campaignId) return;
    let active = true;
    getSessionState(getSupabaseBrowserClient(), campaignId)
      .then((state) => {
        if (active) setPhysical(state.playing && state.physicalDice);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [gated, campaignId]);
  useRealtimeRefresh(
    `dados-fisicos:${campaignId ?? 'nenhuma'}`,
    [{ table: 'sessions', filter: `campaign_id=eq.${campaignId ?? ''}` }],
    () => {
      if (!campaignId) return;
      void getSessionState(getSupabaseBrowserClient(), campaignId)
        .then((state) => setPhysical(state.playing && state.physicalDice))
        .catch(() => undefined);
    },
    gated,
  );

  const roll = useCallback(
    async (request: RollRequest): Promise<ShownRoll | null> => {
      const mode = request.mode ?? 'normal';
      let shown: ShownRoll | null = null;
      try {
        if (campaignId && sessionGate) {
          const session = await getSessionState(getSupabaseBrowserClient(), campaignId);
          if (!session.playing || session.physicalDice) {
            toast({
              tone: 'warning',
              title: 'Rolagem indisponível',
              description: session.playing
                ? 'Esta sessão usa dados presenciais: role na mesa.'
                : 'A sessão ainda não começou. Para testar, role na página da ficha (Personagens).',
            });
            return null;
          }
        }
        if (campaignId) {
          shown = fromServer(
            await rollDice(getSupabaseBrowserClient(), {
              campaignId,
              expression: request.expression,
              label: request.label ?? '',
              mode,
              visibility: request.secret ? 'gm' : 'members',
              characterId,
            }),
          );
        } else {
          const local = rollDiceLocally(request.expression, mode);
          if (!local) throw new Error('Expressão de dados inválida.');
          shown = { ...local, label: request.label ?? '', secret: false };
        }
      } catch (error) {
        toast({ tone: 'danger', title: 'Os dados não foram rolados', description: failureMessage(error, 'Confira a expressão e tente de novo.') });
        return null;
      }
      // Vai para a caixinha de dados 3D no canto (com fila curta se chegarem várias).
      setPending({ key: `local-${Date.now()}`, roll: shown, rollerName: 'Você', userId: null });
      const natural = naturalD20(shown);
      toast({
        tone: natural === 20 ? 'success' : natural === 1 ? 'danger' : 'info',
        title: `${shown.label ? `${shown.label}: ` : ''}${shown.total}${natural === 20 ? ' (20 natural!)' : natural === 1 ? ' (1 natural)' : ''}`,
        description: `${describeDiceRoll(shown)}${shown.mode !== 'normal' ? ` · ${diceRollModeLabels[shown.mode]}` : ''}${shown.secret ? ' · secreta' : ''}`,
      });
      return shown;
    },
    [campaignId, characterId, sessionGate, toast],
  );

  const value = useMemo(() => (enabled ? { roll, campaignId, physical } : null), [roll, campaignId, enabled, physical]);
  return (
    <DiceContext.Provider value={value}>
      {children}
      {enabled ? <DiceTray campaignId={campaignId} pending={pending} /> : null}
    </DiceContext.Provider>
  );
}

/** Rolador da ficha/campanha; `null` fora de um DiceProvider. */
export function useDice(): DiceContextValue | null {
  return useContext(DiceContext);
}

/** Botão compacto que rola uma expressão pronta (ex.: ataque "1d20+5"). */
export function RollButton({
  expression,
  label,
  mode = 'normal',
  children,
  className,
  title,
}: {
  expression: string | null;
  label: string;
  /** Vantagem/desvantagem já decidida pelas condições ativas. */
  mode?: DiceRollMode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const dice = useDice();
  const [busy, setBusy] = useState(false);
  if (!dice || !expression) return <>{children}</>;
  // Dados físicos: sem botão de rolar; só a indicação do dado a rolar na mesa.
  if (dice.physical) {
    return (
      <span className={cx('inline-flex items-center gap-1', className)} title={`Role na mesa: ${expression}`}>
        {children}
        <span className="rounded border border-amber-400/40 px-1 text-[11px] text-amber-300">🎲 {expression}{mode !== 'normal' ? ` (${diceRollModeLabels[mode].toLowerCase()})` : ''}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      title={title ?? `Rolar ${expression}${mode !== 'normal' ? ` com ${diceRollModeLabels[mode].toLowerCase()}` : ''}`}
      aria-label={`Rolar ${label} (${expression}${mode !== 'normal' ? `, ${diceRollModeLabels[mode].toLowerCase()}` : ''})`}
      onClick={async () => {
        setBusy(true);
        await dice.roll({ expression, label, mode });
        setBusy(false);
      }}
      className={cx(
        'rounded-md transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-parchment-300 disabled:opacity-60',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Painel de rolagem livre: dados rápidos, expressão, vantagem e rolagem secreta. */
export function DicePanel({ isGm, characterName }: { isGm: boolean; characterName?: string | null }) {
  const dice = useDice();
  const id = useId();
  const [expression, setExpression] = useState('1d20');
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<DiceRollMode>('normal');
  const [secret, setSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ShownRoll | null>(null);
  const valid = parseDiceExpression(expression) !== null;
  const inCampaign = Boolean(dice?.campaignId);

  const go = async (text: string) => {
    if (!dice) return;
    setBusy(true);
    const shown = await dice.roll({ expression: text, label: label.trim(), mode, secret });
    if (shown) setLast(shown);
    setBusy(false);
  };

  const natural = last ? naturalD20(last) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Dados rápidos">
        {COMMON_DICE.map((sides) => (
          <Button key={sides} variant="secondary" size="sm" disabled={busy} onClick={() => void go(`1d${sides}`)} className="min-w-14">
            d{sides}
          </Button>
        ))}
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) void go(expression);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-expression`} className="text-sm font-medium">
              Expressão
            </label>
            <input
              id={`${id}-expression`}
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              placeholder="Ex.: 2d6+3"
              autoComplete="off"
              aria-invalid={valid ? undefined : true}
              aria-describedby={`${id}-expression-hint`}
              className={controlClasses(!valid, 'h-11 font-mono text-sm')}
            />
            <p id={`${id}-expression-hint`} className="text-xs text-fg-muted">
              {valid ? 'Some dados e bônus: 1d20+5, 2d6+1d4+3, d100.' : 'Use dados como 1d20+5 (até 100 dados).'}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-label`} className="text-sm font-medium">
              Para quê <span className="font-normal text-fg-muted">(opcional)</span>
            </label>
            <input
              id={`${id}-label`}
              value={label}
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ex.: Percepção, Ataque com espada"
              className={controlClasses(false, 'h-11 text-sm')}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Vantagem">
          {DICE_ROLL_MODES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={mode === option}
              onClick={() => setMode(option)}
              className={cx(
                'h-9 rounded-full border px-3 text-sm transition-colors',
                mode === option ? 'border-parchment-300/70 bg-parchment-200/10 text-fg-accent' : 'border-line text-fg-secondary hover:bg-hover',
              )}
            >
              {diceRollModeLabels[option]}
            </button>
          ))}
          {inCampaign ? (
            <label className="ml-auto flex items-center gap-2 text-sm text-fg-secondary">
              <input type="checkbox" checked={secret} onChange={(event) => setSecret(event.target.checked)} className="h-4 w-4 accent-wine-500" />
              <EyeOff className="h-4 w-4" aria-hidden="true" />
              {isGm ? 'Secreta (só mestres)' : 'Só para o mestre'}
            </label>
          ) : null}
        </div>
        <div>
          <Button type="submit" loading={busy} disabled={!valid} icon={<Dices className="h-4 w-4" aria-hidden="true" />}>
            Rolar{characterName ? ` como ${characterName}` : ''}
          </Button>
        </div>
      </form>
      {last ? (
        <output
          aria-live="polite"
          className={cx(
            'flex items-center gap-4 rounded-lg border px-4 py-3',
            natural === 20 ? 'border-verdigris-400/60 bg-success-bg' : natural === 1 ? 'border-ember-400/60 bg-danger-bg' : 'border-line-strong bg-raised',
          )}
        >
          <span key={`${last.total}-${last.expression}-${describeDiceRoll(last)}`} className={cx('tabular animate-pop font-display text-4xl', natural === 20 ? 'text-verdigris-300' : natural === 1 ? 'text-ember-300' : 'text-fg-accent')}>
            {last.total}
          </span>
          <span className="min-w-0 text-sm">
            <span className="block font-medium text-fg">{last.label || last.expression}</span>
            <span className="block text-fg-secondary">{describeDiceRoll(last)}</span>
            <span className="block text-xs text-fg-muted">
              {last.mode !== 'normal' ? `${diceRollModeLabels[last.mode]} · ` : ''}
              {natural === 20 ? '20 natural · ' : natural === 1 ? '1 natural · ' : ''}
              {inCampaign ? (last.secret ? 'Rolagem secreta' : 'Visível para a mesa') : 'Rolagem local (sem campanha)'}
            </span>
          </span>
        </output>
      ) : null}
    </div>
  );
}
