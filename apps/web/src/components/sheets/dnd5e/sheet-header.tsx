'use client';

import type { AutosaveStatus, RealtimeStatus } from '@codexveil/database';
import { dnd5eSystem } from '@codexveil/rpg-systems/dnd5e';
import type { Route } from 'next';
import Link from 'next/link';
import { Portrait } from '@/components/characters/portrait';
import { Badge } from '@/components/ui/badge';
import { LiveBadge, SaveStatus } from '@/components/ui/save-status';
import { campaignPath } from '@/lib/routes';
import { useSheet } from './context';

export function SheetHeader({ saveStatus, liveStatus }: { saveStatus: AutosaveStatus; liveStatus: RealtimeStatus }) {
  const { character, permissions, name, setName, sheet, derived } = useSheet();
  const summary = dnd5eSystem.summarize(sheet);

  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end">
      <Portrait name={name} url={character.portraitUrl} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="parchment">D&amp;D 5e</Badge>
          {character.campaign ? (
            <Link href={campaignPath(character.campaign.id) as Route} className="text-xs text-fg-secondary underline-offset-4 hover:underline">
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
          className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1 -mx-1 font-display text-2xl leading-tight text-fg-accent hover:border-line read-only:hover:border-transparent focus-visible:border-parchment-300 focus-visible:outline-none sm:text-3xl"
        />
        <p className="text-sm text-fg-secondary">
          {summary.subtitle}
          {sheet.identity.background ? ` · ${sheet.identity.background}` : ''}
          {sheet.identity.alignment ? ` · ${sheet.identity.alignment}` : ''}
        </p>
      </div>
      <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
        <dl className="flex gap-4 text-center">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-fg-muted">Nível</dt>
            <dd className="tabular font-display text-xl text-fg-accent">{derived.level}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-fg-muted">Proficiência</dt>
            <dd className="tabular font-display text-xl text-fg-accent">+{derived.proficiencyBonus}</dd>
          </div>
        </dl>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          {permissions.canEditSheet || permissions.canEditPlay ? <SaveStatus status={saveStatus} /> : null}
          <LiveBadge status={liveStatus} />
        </div>
      </div>
    </header>
  );
}
