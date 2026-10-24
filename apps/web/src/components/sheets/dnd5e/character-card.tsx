'use client';

import {
  ABILITIES,
  abilityLabels,
  formatModifier,
  formatSpeciesName,
} from '@codexveil/rpg-systems/dnd5e';
import { Footprints, Shield, Zap } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { initialsOf } from '@/components/ui/avatar';
import { useSheet } from './context';

/**
 * Carta do personagem (estilo carta colecionável): retrato grande, nome, espécie e classe, e os
 * números base. Abre ao clicar no retrato do cabeçalho da ficha.
 */
export function CharacterCardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { character, name, sheet, derived } = useSheet();
  const classes = sheet.identity.classes
    .filter((entry) => entry.name)
    .map((entry) => `${entry.name} ${entry.level}`)
    .join(' / ');
  const species = formatSpeciesName(sheet.identity.species);
  return (
    <Modal open={open} onClose={onClose} title={name || 'Personagem'}>
      <div className="mx-auto w-full max-w-sm rounded-2xl bg-gradient-to-b from-parchment-300 via-amber-500 to-parchment-400 p-1.5 shadow-2xl">
        <div className="flex flex-col gap-3 rounded-xl bg-gradient-to-b from-wine-950 via-canvas to-wine-950 p-3">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <span className="truncate font-display text-xl text-fg-accent">
              {name || 'Sem nome'}
            </span>
            <span className="shrink-0 text-xs text-fg-muted">
              Nível{' '}
              <strong className="font-display text-lg text-parchment-200">{derived.level}</strong>
            </span>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border-2 border-parchment-400/60 bg-wine-900">
            {character.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={character.portraitUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center font-display text-6xl text-parchment-300"
                aria-hidden="true"
              >
                {initialsOf(name)}
              </span>
            )}
          </div>
          <p className="rounded-md border border-parchment-400/30 bg-raised px-3 py-1.5 text-center text-sm text-fg-secondary">
            {[species, classes].filter(Boolean).join(' · ') || 'Aventureiro'}
          </p>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              {
                icon: <Shield className="h-4 w-4" aria-hidden="true" />,
                label: 'CA',
                value: String(derived.armorClass),
              },
              {
                icon: <Zap className="h-4 w-4" aria-hidden="true" />,
                label: 'Iniciativa',
                value: formatModifier(derived.initiative),
              },
              {
                icon: <Footprints className="h-4 w-4" aria-hidden="true" />,
                label: 'Desloc.',
                value: `${derived.speed.toLocaleString('pt-BR')} ${sheet.combat.speedUnit}`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center rounded-md border border-line bg-card py-2"
              >
                <span className="text-fg-brand">{stat.icon}</span>
                <dd className="tabular font-display text-lg text-fg-accent">{stat.value}</dd>
                <dt className="text-[10px] uppercase tracking-wider text-fg-muted">{stat.label}</dt>
              </div>
            ))}
          </dl>
          <dl className="grid grid-cols-6 gap-1 text-center">
            {ABILITIES.map((ability) => (
              <div
                key={ability}
                className="flex flex-col items-center rounded-md border border-line bg-card py-1.5"
              >
                <dt className="font-display text-[10px] tracking-widest text-fg-secondary">
                  {abilityLabels[ability].abbreviation}
                </dt>
                <dd className="tabular font-display text-base text-fg-accent">
                  {formatModifier(derived.abilityModifiers[ability])}
                </dd>
                <dd className="tabular text-[10px] text-fg-muted">{derived.abilities[ability]}</dd>
              </div>
            ))}
          </dl>
          <p className="px-1 text-center text-xs text-fg-muted">
            {[
              sheet.identity.background,
              sheet.identity.alignment,
              `Proficiência +${derived.proficiencyBonus}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>
    </Modal>
  );
}
