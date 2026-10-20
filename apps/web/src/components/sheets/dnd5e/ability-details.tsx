'use client';

import type { CharacterAbility, CharacterResource } from '@codexveil/database';
import {
  abilityLabels,
  loadSrdSpellTexts,
  spellSchoolLabels,
  summarizeSrdSpell,
  type Dnd5eAttackData,
  type Dnd5eSpellData,
  type SrdSpellTexts,
} from '@codexveil/rpg-systems/dnd5e';
import { abilityEntryKindLabels } from '@codexveil/validation';
import { useEffect, useState } from 'react';

/** Textos das magias do SRD, carregados uma vez (arquivo separado, só quando necessário). */
export function useSrdSpellTexts(): SrdSpellTexts | null {
  const [texts, setTexts] = useState<SrdSpellTexts | null>(null);
  useEffect(() => {
    let active = true;
    loadSrdSpellTexts()
      .then((loaded) => {
        if (active) setTexts(loaded);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return texts;
}

function circleLabel(data: Dnd5eSpellData): string {
  const school = data.school ? spellSchoolLabels[data.school] : null;
  if (data.circle === 0) return school ? `Truque de ${school}` : 'Truque';
  return [`${data.circle}º círculo`, school].filter(Boolean).join(' · ');
}

function DetailGrid({ rows }: { rows: [string, string][] }) {
  const visible = rows.filter(([, value]) => value);
  if (visible.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {visible.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-fg-muted">{label}</dt>
          <dd className="text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface SpellDetailsProps {
  name: string;
  data: Dnd5eSpellData;
  description: string;
  /** Mostra o texto do SRD inteiro (conteúdo expandido) ou só o começo (cartão). */
  full?: boolean;
}

/** Especificações da magia: ficha + o que o SRD diz (dano, resistência, área, círculo maior). */
export function SpellDetails({ name, data, description, full = false }: SpellDetailsProps) {
  const texts = useSrdSpellTexts();
  const srd = texts?.[name] ?? null;
  const summary = srd ? summarizeSrdSpell(srd) : [];
  const flags = [data.concentration ? 'Concentração' : null, data.ritual ? 'Ritual' : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-2">
      {full ? null : (
        <div>
          <p className="font-display text-base text-fg-accent">{name}</p>
          <p className="text-xs text-fg-muted">{circleLabel(data)}</p>
        </div>
      )}
      <DetailGrid
        rows={[
          ...(full
            ? ([['Escola', data.school ? spellSchoolLabels[data.school] : '']] as [
                string,
                string,
              ][])
            : []),
          ['Conjuração', data.castingTime],
          ['Alcance', data.range],
          ['Componentes', data.components],
          ['Duração', data.duration],
          ['Especial', flags],
          ...summary.map((line): [string, string] => [line.label, line.value]),
        ]}
      />
      {description ? (
        <p
          className={
            full
              ? 'whitespace-pre-line font-serif leading-relaxed text-fg-secondary'
              : 'line-clamp-6 whitespace-pre-line text-xs text-fg-secondary'
          }
        >
          {description}
        </p>
      ) : null}
      {srd && !description ? (
        full ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-fg-muted hover:text-fg-secondary">
              Texto completo do SRD 5.2.1 (em inglês)
            </summary>
            <div className="mt-1.5 flex flex-col gap-1.5 border-l border-line-strong pl-3 text-fg-secondary">
              {srd.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </details>
        ) : (
          <p className="line-clamp-5 text-xs text-fg-secondary">
            <span className="text-fg-muted">SRD (inglês): </span>
            {srd[0]}
          </p>
        )
      ) : null}
      {full ? null : <p className="text-[11px] text-fg-subtle">Clique na magia para ver tudo.</p>}
    </div>
  );
}

/** Habilidade, talento ou traço: origem, usos e descrição. */
export function FeatureDetails({
  feature,
  resource,
}: {
  feature: CharacterAbility;
  resource: CharacterResource | undefined;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="font-display text-base text-fg-accent">{feature.name}</p>
        <p className="text-xs text-fg-muted">{abilityEntryKindLabels[feature.kind]}</p>
      </div>
      <DetailGrid
        rows={[
          ['Origem', feature.source],
          [
            'Usos',
            resource
              ? `${resource.current}${resource.max === null ? '' : ` de ${resource.max}`}`
              : '',
          ],
        ]}
      />
      {feature.description ? (
        <p className="line-clamp-[10] whitespace-pre-line text-xs text-fg-secondary">
          {feature.description}
        </p>
      ) : (
        <p className="text-xs text-fg-muted">Sem descrição.</p>
      )}
    </div>
  );
}

/** Ataque: bônus, dano, alcance e atributo. */
export function AttackDetails({
  attack,
  data,
  bonus,
}: {
  attack: CharacterAbility;
  data: Dnd5eAttackData;
  bonus: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-display text-base text-fg-accent">{attack.name}</p>
      <DetailGrid
        rows={[
          ['Ataque', bonus],
          ['Dano', [data.damage, data.damageType].filter(Boolean).join(' ')],
          ['Alcance', data.range],
          ['Atributo', data.ability ? abilityLabels[data.ability].name : 'Bônus fixo'],
          ['Proficiente', data.proficient ? 'Sim' : 'Não'],
        ]}
      />
      {attack.description ? (
        <p className="line-clamp-6 whitespace-pre-line text-xs text-fg-secondary">
          {attack.description}
        </p>
      ) : null}
    </div>
  );
}
