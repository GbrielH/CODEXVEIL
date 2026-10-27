'use client';

import type { AutosaveStatus, RealtimeStatus } from '@codexveil/database';
import { d20Expression } from '@codexveil/domain';
import { ABILITIES, DND5E_RESOURCE_KEYS, abilityLabels, dnd5eSystem, effectiveSpeed, formatModifier, passiveWithConditions } from '@codexveil/rpg-systems/dnd5e';
import { rollModeFrom } from './condition-badges';
import { Crosshair, Footprints, Heart, Shield, Sparkles, Zap } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ArcaneScene } from '@/components/brand/arcane-scene';
import { Portrait } from '@/components/characters/portrait';
import { RollButton } from '@/components/dice/dice-roller';
import { Badge } from '@/components/ui/badge';
import { LiveBadge, SaveStatus } from '@/components/ui/save-status';
import { campaignPath } from '@/lib/routes';
import { CharacterCardModal } from './character-card';
import { useSheet } from './context';

/** Bloco de número em destaque (CA, Iniciativa…), no estilo do redesign. */
function StatTile({ icon, label, children, hint }: { icon: ReactNode; label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-charcoal-950/60 px-3 py-2.5 text-center backdrop-blur">
      <span className="flex items-center gap-1 text-[10px] tracking-wider text-fg-muted uppercase">
        <span className="text-wine-300">{icon}</span>
        {label}
      </span>
      <span className="tabular font-display text-2xl leading-none text-fg-accent">{children}</span>
      {hint ? <span className="text-[10px] text-fg-subtle">{hint}</span> : null}
    </div>
  );
}

/**
 * Cabeçalho da ficha (redesign "Grimório Arcano"): a paisagem do personagem ao fundo, retrato com
 * aro violeta, nome e origem, os números principais em blocos (PV com barra, CA, Iniciativa,
 * Deslocamento, Percepção passiva) e os seis atributos, que rolam o teste ao clicar.
 */
export function SheetHeader({ saveStatus, liveStatus }: { saveStatus: AutosaveStatus; liveStatus: RealtimeStatus }) {
  const { character, permissions, name, setName, sheet, derived, resources, conditionEffects: effects } = useSheet();
  // Os números já com as condições ativas (exaustão, lentidão, etc.), como na mesa.
  const penalty = effects.d20Penalty;
  const initiative = derived.initiative - penalty;
  const speed = effectiveSpeed(derived.speed, sheet.combat.speedUnit, effects);
  const passive = passiveWithConditions(derived.passivePerception, effects);
  const summary = dnd5eSystem.summarize(sheet);
  const [cardOpen, setCardOpen] = useState(false);
  const hp = resources.find((resource) => resource.key === DND5E_RESOURCE_KEYS.hitPoints);
  const hpMax = hp?.max ?? 0;
  const hpPercent = hpMax > 0 ? Math.max(0, Math.min(100, Math.round(((hp?.current ?? 0) / hpMax) * 100))) : 0;
  const hpColor = hpPercent > 50 ? 'bg-verdigris-400' : hpPercent > 25 ? 'bg-amber-400' : 'bg-ember-400';

  return (
    <header className="relative isolate overflow-hidden rounded-2xl border border-line shadow-[0_24px_60px_-36px_rgb(107_59_198/0.9)]">
      <ArcaneScene seed={name || character.id} className="absolute inset-0 -z-10 opacity-60" options={{ noMoon: true }} />
      <span className="absolute inset-0 -z-10 bg-gradient-to-r from-charcoal-950 via-charcoal-950/85 to-charcoal-950/60" aria-hidden="true" />

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setCardOpen(true)}
            aria-label="Abrir a carta do personagem"
            title="Abrir a carta do personagem"
            className="self-start rounded-t-[999px] rounded-b-md ring-2 ring-wine-400/60 ring-offset-2 ring-offset-charcoal-950 transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-parchment-300"
          >
            <Portrait name={name} url={character.portraitUrl} size="lg" zoomable />
          </button>
          <CharacterCardModal open={cardOpen} onClose={() => setCardOpen(false)} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">D&amp;D 5e · Nível {derived.level}</Badge>
              {character.campaign ? (
                <Link href={campaignPath(character.campaign.id) as Route} className="text-xs text-wine-300 hover:text-wine-200">
                  {character.campaign.name}
                </Link>
              ) : (
                <span className="text-xs text-fg-muted">Sem campanha</span>
              )}
              <span className="text-xs text-fg-muted">· Jogador: {character.ownerName}</span>
            </div>
            <label htmlFor="character-name" className="sr-only">
              Nome do personagem
            </label>
            <input
              id="character-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              readOnly={!permissions.canEditSheet}
              className="-mx-1 mt-1 w-full rounded-md border border-transparent bg-transparent px-1 font-display text-3xl leading-tight text-fg-accent [text-shadow:0_2px_16px_rgb(0_0_0/0.8)] hover:border-line read-only:hover:border-transparent focus-visible:border-parchment-300 focus-visible:outline-none sm:text-4xl"
            />
            <p className="text-sm text-fg-secondary">
              {summary.subtitle}
              {sheet.identity.background ? ` · ${sheet.identity.background}` : ''}
              {sheet.identity.alignment ? ` · ${sheet.identity.alignment}` : ''}
            </p>
          </div>
          <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
            {permissions.canEditSheet || permissions.canEditPlay ? <SaveStatus status={saveStatus} /> : null}
            <LiveBadge status={liveStatus} />
          </div>
        </div>

        {/* Números principais */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 flex flex-col justify-center gap-1.5 rounded-xl border border-line bg-charcoal-950/60 px-4 py-2.5 backdrop-blur sm:col-span-3 lg:col-span-2">
            <span className="flex items-center justify-between text-[10px] tracking-wider text-fg-muted uppercase">
              <span className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 text-ember-400" aria-hidden="true" />
                Pontos de vida
              </span>
              {hp?.temp ? <span className="text-arcane-300">+{hp.temp} temporários</span> : null}
            </span>
            <span className="tabular font-display text-2xl leading-none text-fg-accent">
              {hp?.current ?? '—'}
              <span className="text-base text-fg-muted"> / {hpMax || '—'}</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-charcoal-700" aria-hidden="true">
              <span className={`block h-full rounded-full transition-[width] ${hpColor}`} style={{ width: `${hpPercent}%` }} />
            </span>
          </div>
          <StatTile icon={<Shield className="h-3.5 w-3.5" aria-hidden="true" />} label="CA">
            {derived.armorClass}
          </StatTile>
          <StatTile icon={<Zap className="h-3.5 w-3.5" aria-hidden="true" />} label="Iniciativa">
            <RollButton expression={d20Expression(initiative)} label="Iniciativa" mode={rollModeFrom(effects.initiative)} className="px-1">
              <span className={penalty > 0 ? 'text-amber-300' : undefined}>{formatModifier(initiative)}</span>
            </RollButton>
          </StatTile>
          <StatTile icon={<Footprints className="h-3.5 w-3.5" aria-hidden="true" />} label="Deslocamento">
            <span className={speed !== derived.speed ? 'text-amber-300' : undefined}>{speed.toLocaleString('pt-BR')}</span>
            <span className="text-sm text-fg-muted"> {sheet.combat.speedUnit}</span>
          </StatTile>
          <StatTile icon={<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />} label="Percepção" hint="passiva">
            <span className={passive !== derived.passivePerception ? 'text-amber-300' : undefined}>{passive}</span>
          </StatTile>
        </div>

        {/* Os seis atributos: clicar rola o teste */}
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Atributos">
          {ABILITIES.map((ability) => {
            const modifier = derived.abilityModifiers[ability];
            return (
              <li key={ability}>
                <RollButton expression={d20Expression(modifier)} label={`Teste de ${abilityLabels[ability].name}`} className="w-full">
                  <span className="flex w-full flex-col items-center rounded-xl border border-wine-400/25 bg-wine-950/70 px-2 py-2 backdrop-blur transition-colors hover:border-wine-400/60">
                    <span className="text-[10px] tracking-[0.2em] text-wine-300 uppercase">{abilityLabels[ability].abbreviation}</span>
                    <span className="tabular font-display text-2xl leading-tight text-fg-accent">{formatModifier(modifier)}</span>
                    <span className="tabular text-xs text-fg-muted">{derived.abilities[ability]}</span>
                  </span>
                </RollButton>
              </li>
            );
          })}
        </ul>
        <p className="flex items-center gap-1 text-[11px] text-fg-subtle">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Proficiência +{derived.proficiencyBonus} · clique num número para rolar
        </p>
      </div>
    </header>
  );
}
