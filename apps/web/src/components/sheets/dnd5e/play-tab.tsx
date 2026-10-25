'use client';

import { d20Expression, type DiceRollMode } from '@codexveil/domain';
import {
  canRage,
  critRangeLabel,
  rageDamageBonus,
  dnd5eAttackDataSchema,
  effectiveSpeed,
  formatModifier,
  passiveWithConditions,
  type Dnd5eAttackData,
  isAttackAvailable,
} from '@codexveil/rpg-systems/dnd5e';
import { Crosshair, Footprints, Shield, Swords, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { HoverCard } from '@/components/ui/hover-card';
import { RollButton } from '@/components/dice/dice-roller';
import { AttackDetails } from './ability-details';
import { PenaltyBadge, RollEffectBadge, rollModeFrom } from './condition-badges';
import { useSheet } from './context';
import { ConditionsPanel } from './conditions-panel';
import { HpTracker } from './hp-tracker';
import { ResourceTracks } from './resource-tracks';
import { TemporaryBonuses } from './temporary-bonuses';
import { TurnPlay } from './turn-play';

interface StatRoll {
  expression: string;
  label: string;
  mode: DiceRollMode;
}

function Stat({
  icon,
  label,
  value,
  hint,
  badge,
  changed = false,
  roll,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string | undefined;
  badge?: ReactNode;
  changed?: boolean;
  /** Clicar no valor rola o teste (quando a ficha permite rolar). */
  roll?: StatRoll;
}) {
  const number = (
    <span
      className={`tabular font-display text-2xl leading-none ${changed ? 'text-amber-300' : 'text-fg-accent'}`}
    >
      {value}
    </span>
  );
  const cardClass = `flex w-full flex-col items-center gap-1 rounded-md border bg-raised px-2 py-3 text-center ${changed ? 'border-amber-400/40' : 'border-line'}`;
  const content = (
    <>
      <span className="text-fg-brand">{icon}</span>
      <span className="flex items-center gap-1">
        {number}
        {badge}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-fg-muted">{label}</span>
      {hint ? <span className="text-[11px] text-fg-subtle">{hint}</span> : null}
    </>
  );
  // Com rolagem, o cartão inteiro é o botão (mais fácil de acertar).
  if (roll) {
    return (
      <RollButton expression={roll.expression} label={roll.label} mode={roll.mode} className={cardClass}>
        {content}
      </RollButton>
    );
  }
  return <div className={cardClass}>{content}</div>;
}

export function parseAttack(data: unknown): Dnd5eAttackData {
  const parsed = dnd5eAttackDataSchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : dnd5eAttackDataSchema.parse({});
}

/** Tudo o que se consulta e altera com frequência durante uma partida, numa só tela. */
export function PlayTab() {
  const { sheet, derived, abilities, items, conditionEffects: effects, resolveAttack, activeEffects, setActiveEffects, permissions } = useSheet();
  // Armas do inventário só aparecem equipadas; ataques sem arma (desarmado, garras) sempre.
  const attacks = abilities.filter(
    (entry) => entry.kind === 'attack' && isAttackAvailable(entry.name, items),
  );
  const speedValue = effectiveSpeed(derived.speed, sheet.combat.speedUnit, effects);
  const speed = `${speedValue.toLocaleString('pt-BR')} ${sheet.combat.speedUnit}`;
  const speedHint =
    effects.speedZero.length > 0
      ? effects.speedZero.join(', ')
      : effects.speedReductionFeet > 0
        ? `Exaustão ${effects.exhaustionLevel}`
        : undefined;
  const penalty = effects.d20Penalty;
  const penaltySource = `Exaustão ${effects.exhaustionLevel}`;
  const passive = passiveWithConditions(derived.passivePerception, effects);
  const temporary = activeEffects.temporary ?? {};
  const incapacitated =
    effects.incapacitated.length > 0
      ? effects.conditions.find((condition) => condition.key === 'incapacitated')
      : undefined;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <TurnPlay />
        {effects.dead ? (
          <Alert tone="danger" title="Exaustão 6">
            O personagem morre ao chegar ao nível 6 de Exaustão.
          </Alert>
        ) : incapacitated ? (
          <Alert
            tone="warning"
            title={
              incapacitated.impliedBy
                ? `Incapacitado (por ${incapacitated.impliedBy})`
                : 'Incapacitado'
            }
          >
            Sem ações, ações bônus ou reações; a concentração é interrompida e o personagem não
            fala.
          </Alert>
        ) : null}
        <HpTracker />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            icon={<Shield className="h-5 w-5" aria-hidden="true" />}
            label="Classe de armadura"
            value={String(derived.armorClass)}
            changed={Boolean(temporary.armorClass)}
          />
          <Stat
            icon={<Zap className="h-5 w-5" aria-hidden="true" />}
            label="Iniciativa"
            value={formatModifier(derived.initiative - penalty)}
            changed={penalty > 0 || Boolean(temporary.initiative)}
            roll={{
              expression: d20Expression(derived.initiative - penalty),
              label: 'Iniciativa',
              mode: rollModeFrom(effects.initiative),
            }}
            badge={
              <>
                <RollEffectBadge sources={effects.initiative} />
                <PenaltyBadge penalty={penalty} source={penaltySource} />
              </>
            }
          />
          <Stat
            icon={<Footprints className="h-5 w-5" aria-hidden="true" />}
            label="Deslocamento"
            value={speed}
            hint={speedHint}
            changed={speedValue !== derived.speed || Boolean(temporary.speed)}
          />
          <Stat
            icon={<Crosshair className="h-5 w-5" aria-hidden="true" />}
            label="Percepção passiva"
            value={String(passive)}
            changed={passive !== derived.passivePerception || Boolean(temporary.passivePerception)}
            hint={
              passive !== derived.passivePerception
                ? `Base ${derived.passivePerception}`
                : undefined
            }
          />
        </div>
        <TemporaryBonuses />
        {derived.spellcasting ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={<Zap className="h-5 w-5" aria-hidden="true" />}
              label="CD de magia"
              value={String(derived.spellcasting.saveDc)}
            />
            <Stat
              icon={<Crosshair className="h-5 w-5" aria-hidden="true" />}
              label="Ataque mágico"
              value={formatModifier(derived.spellcasting.attackBonus - penalty)}
              changed={penalty > 0}
              badge={
                <>
                  <RollEffectBadge sources={effects.attackRolls} />
                  <PenaltyBadge penalty={penalty} source={penaltySource} />
                </>
              }
            />
          </div>
        ) : null}
        {canRage(sheet) ? (
          <button
            type="button"
            disabled={!permissions.canEditPlay}
            aria-pressed={activeEffects.rage}
            onClick={() => setActiveEffects({ ...activeEffects, rage: !activeEffects.rage })}
            className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-left ${activeEffects.rage ? 'ability-rage border-red-400/60 bg-red-500/15 text-red-200' : 'border-line bg-raised text-fg hover:bg-hover'}`}
          >
            <span>
              <span className="block font-display text-lg">{activeEffects.rage ? 'Em Fúria!' : 'Entrar em Fúria'}</span>
              <span className="block text-xs text-fg-muted">
                +{rageDamageBonus(sheet.identity.classes.filter((entry) => /b[aá]rbaro|barbarian/i.test(entry.name)).reduce((total, entry) => total + entry.level, 0))} no dano com Força
                corpo a corpo, vantagem em testes e salvaguardas de Força, resistência a dano contundente, cortante e perfurante.
              </span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${activeEffects.rage ? 'bg-red-500/30' : 'bg-hover'}`}>{activeEffects.rage ? 'Ligada' : 'Desligada'}</span>
          </button>
        ) : null}
        <Card>
          <CardHeader icon={<Swords className="h-5 w-5" aria-hidden="true" />} title="Ataques" />
          {attacks.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Nenhuma arma equipada. Equipe uma arma no Inventário para atacar com ela.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {attacks.map((attack) => {
                const data = parseAttack(attack.data);
                const resolved = resolveAttack(attack.name, data);
                const bonus = resolved.toHit - penalty;
                const damage = resolved.damage;
                const critical = resolved.critical;
                return (
                  <li key={attack.id} className="flex flex-col gap-2 py-3">
                    <HoverCard
                      className="block"
                      content={() => (
                        <AttackDetails attack={attack} data={data} bonus={formatModifier(bonus)} />
                      )}
                    >
                      <span className="block min-w-0">
                        <span className="block truncate text-sm font-medium text-fg">{attack.name}</span>
                        <span className="block truncate text-xs text-fg-muted">
                          {[
                            data.damage && `${data.damage} ${data.damageType}`.trim(),
                            data.extraDamage && `+${data.extraDamage} ${data.extraDamageType}`.trim(),
                            data.range,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </HoverCard>
                    {/* As três rolagens, na ordem do jogo: acerto, dano e dano crítico. */}
                    <div className="grid grid-cols-3 gap-2">
                      <RollButton
                        expression={d20Expression(bonus)}
                        label={`Ataque: ${attack.name}`}
                        mode={rollModeFrom(effects.attackRolls)}
                        critRange={resolved.critRange}
                        className="w-full"
                      >
                        <span className="flex w-full flex-col items-center rounded-md border border-line-strong bg-raised px-2 py-1.5">
                          <span className="text-[11px] tracking-wider text-fg-muted uppercase">Acerto</span>
                          <span className={`tabular font-display text-lg ${penalty > 0 ? 'text-amber-300' : 'text-fg-accent'}`}>{formatModifier(bonus)}</span>
                        </span>
                      </RollButton>
                      <RollButton expression={damage} label={`Dano: ${attack.name}`} className="w-full">
                        <span className="flex w-full flex-col items-center rounded-md border border-line-strong bg-raised px-2 py-1.5">
                          <span className="text-[11px] tracking-wider text-fg-muted uppercase">Dano</span>
                          <span className="tabular font-display text-lg text-ember-300">{damage ?? '—'}</span>
                        </span>
                      </RollButton>
                      <RollButton
                        expression={critical}
                        label={`Dano crítico: ${attack.name}`}
                        className="w-full"
                        title={`Crítico com ${critRangeLabel(resolved.critRange)} no d20: dados dobrados${data.critExtra ? ` e +${data.critExtra}` : ''}`}
                      >
                        <span className="flex w-full flex-col items-center rounded-md border border-amber-400/30 bg-raised px-2 py-1.5">
                          <span className="text-[11px] tracking-wider text-fg-muted uppercase">Crítico ({critRangeLabel(resolved.critRange)})</span>
                          <span className="tabular font-display text-lg text-amber-300">{critical ?? '—'}</span>
                        </span>
                      </RollButton>
                    </div>
                    {resolved.notes.length ? <p className="text-[11px] text-fg-subtle">Automático: {resolved.notes.join(' · ')}</p> : null}
                    {effects.attackRolls.length || penalty > 0 ? (
                      <span className="flex items-center gap-1">
                        <RollEffectBadge sources={effects.attackRolls} />
                        <PenaltyBadge penalty={penalty} source={penaltySource} />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <div className="flex flex-col gap-5">
        <ConditionsPanel />
        <ResourceTracks />
      </div>
    </div>
  );
}
