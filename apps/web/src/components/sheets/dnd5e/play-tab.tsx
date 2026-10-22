'use client';

import { d20Expression, type DiceRollMode } from '@codexveil/domain';
import {
  attackRollBonus,
  attackDamageFormula,
  critRangeLabel,
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
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-md border bg-raised px-2 py-3 text-center ${changed ? 'border-amber-400/40' : 'border-line'}`}
    >
      <span className="text-fg-brand">{icon}</span>
      <span className="flex items-center gap-1">
        {roll ? (
          <RollButton
            expression={roll.expression}
            label={roll.label}
            mode={roll.mode}
            className="px-1.5 py-0.5"
          >
            {number}
          </RollButton>
        ) : (
          number
        )}
        {badge}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-fg-muted">{label}</span>
      {hint ? <span className="text-[11px] text-fg-subtle">{hint}</span> : null}
    </div>
  );
}

export function parseAttack(data: unknown): Dnd5eAttackData {
  const parsed = dnd5eAttackDataSchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : dnd5eAttackDataSchema.parse({});
}

/** Tudo o que se consulta e altera com frequência durante uma partida, numa só tela. */
export function PlayTab() {
  const { sheet, derived, abilities, items, conditionEffects: effects } = useSheet();
  // Armas do inventário só aparecem equipadas; ataques sem arma (desarmado, garras) sempre.
  const attacks = abilities.filter(
    (entry) => entry.kind === 'attack' && isAttackAvailable(entry.name, items),
  );
  const speedValue = effectiveSpeed(sheet.combat.speed, sheet.combat.speedUnit, effects);
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
            value={String(sheet.combat.armorClass)}
          />
          <Stat
            icon={<Zap className="h-5 w-5" aria-hidden="true" />}
            label="Iniciativa"
            value={formatModifier(derived.initiative - penalty)}
            changed={penalty > 0}
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
            changed={speedValue !== sheet.combat.speed}
          />
          <Stat
            icon={<Crosshair className="h-5 w-5" aria-hidden="true" />}
            label="Percepção passiva"
            value={String(passive)}
            changed={passive !== derived.passivePerception}
            hint={
              passive !== derived.passivePerception
                ? `Base ${derived.passivePerception}`
                : undefined
            }
          />
        </div>
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
                const bonus = attackRollBonus(data, derived) - penalty;
                const damage = attackDamageFormula(data, sheet.abilities);
                const critical = attackDamageFormula(data, sheet.abilities, true);
                return (
                  <li key={attack.id} className="flex items-center gap-3 py-2">
                    <HoverCard
                      className="block flex-1"
                      content={() => (
                        <AttackDetails attack={attack} data={data} bonus={formatModifier(bonus)} />
                      )}
                    >
                      <span className="block min-w-0">
                        <span className="block truncate text-sm font-medium text-fg">
                          {attack.name}
                        </span>
                        <span className="block truncate text-xs text-fg-muted">
                          {[
                            data.damage && `${data.damage} ${data.damageType}`.trim(),
                            data.extraDamage && `+${data.extraDamage} ${data.extraDamageType}`.trim(),
                            data.range,
                            `crítico ${critRangeLabel(data.critRange)}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {damage ? (
                          <RollButton
                            expression={damage}
                            label={`Dano: ${attack.name}`}
                            className="mt-1 inline-flex px-1.5 py-0.5 text-xs text-ember-300"
                          >
                            Rolar dano ({damage})
                          </RollButton>
                        ) : null}
                        {critical ? (
                          <RollButton
                            expression={critical}
                            label={`Dano crítico: ${attack.name}`}
                            className="mt-1 ml-1 inline-flex px-1.5 py-0.5 text-xs text-amber-300"
                            title={`Crítico com ${critRangeLabel(data.critRange)} no d20: dados dobrados${data.critExtra ? ` e +${data.critExtra}` : ''}`}
                          >
                            Crítico ({critical})
                          </RollButton>
                        ) : null}
                      </span>
                    </HoverCard>
                    <RollEffectBadge sources={effects.attackRolls} />
                    <PenaltyBadge penalty={penalty} source={penaltySource} />
                    <RollButton
                      expression={d20Expression(bonus)}
                      label={`Ataque: ${attack.name}`}
                      mode={rollModeFrom(effects.attackRolls)}
                    >
                      <span
                        className={`tabular block rounded-md border border-line-strong bg-raised px-2 py-1 font-display text-lg ${penalty > 0 ? 'text-amber-300' : 'text-fg-accent'}`}
                        aria-label={`Bônus de ataque ${formatModifier(bonus)}`}
                      >
                        {formatModifier(bonus)}
                      </span>
                    </RollButton>
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
