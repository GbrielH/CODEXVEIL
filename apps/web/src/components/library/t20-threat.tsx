'use client';

import { updateCreatureGmData } from '@codexveil/database';
import { T20_ATTRIBUTES, formatT20Bonus, t20AttributeLabels, t20StatBlockSchema, type T20StatBlock } from '@codexveil/rpg-systems/tormenta20';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { TextField, TextareaField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Ficha de ameaça do Tormenta20 (leitura). */
export function T20ThreatView({ name, stats }: { name: string; stats: T20StatBlock }) {
  const rows: [string, string][] = [
    ['Iniciativa e sentidos', stats.senses],
    ['Defesa', `${stats.defense}${stats.defenseNotes ? ` · ${stats.defenseNotes}` : ''}`],
    ['Pontos de vida', `${stats.hitPoints}${stats.manaPoints !== null ? ` · PM ${stats.manaPoints}` : ''}`],
    ['Deslocamento', stats.speed],
    ['Corpo a corpo', stats.melee],
    ['À distância', stats.ranged],
    ['Perícias', stats.skills],
    ['Equipamento', stats.equipment],
    ['Tesouro', stats.treasure],
  ];
  return (
    <Card ornate>
      <CardHeader title={name} description={[stats.type, stats.challenge ? `ND ${stats.challenge}` : ''].filter(Boolean).join(' · ')} />
      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-fg-muted">{label}</dt>
              <dd className="whitespace-pre-line text-fg">{value}</dd>
            </div>
          ))}
      </dl>
      <div className="my-3 grid grid-cols-6 gap-1 text-center">
        {T20_ATTRIBUTES.map((key) => (
          <div key={key} className="rounded border border-line py-1">
            <p className="text-[10px] tracking-wider text-fg-subtle uppercase">{t20AttributeLabels[key].abbreviation}</p>
            <p className="tabular text-fg">{stats.attributes[key] === null ? '—' : formatT20Bonus(stats.attributes[key])}</p>
          </div>
        ))}
      </div>
      {stats.abilities.map((ability) => (
        <p key={ability.name} className="mt-2 text-sm text-fg-secondary">
          <strong className="text-fg">{ability.name}.</strong> {ability.text}
        </p>
      ))}
      {stats.description ? <p className="mt-3 text-sm whitespace-pre-line text-fg-muted">{stats.description}</p> : null}
    </Card>
  );
}

/** Editor das estatísticas T20 (mestres): os campos usados no combate e o texto da ficha. */
export function T20ThreatEditor({ creatureId, stats, gm }: { creatureId: string; stats: T20StatBlock; gm: { notes: string; secrets: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState(stats);
  const [abilitiesText, setAbilitiesText] = useState(stats.abilities.map((ability) => `${ability.name}. ${ability.text}`).join('\n\n'));
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<T20StatBlock>) => setForm((current) => ({ ...current, ...patch }));
  const number = (value: string) => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0);

  const save = async () => {
    setBusy(true);
    const abilities = abilitiesText
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const match = /^([^.]{1,120})\.\s*([\s\S]*)$/.exec(block);
        return match ? { name: match[1]!.trim(), text: match[2]!.trim() } : { name: block.slice(0, 60), text: '' };
      });
    const parsed = t20StatBlockSchema.safeParse({ ...form, abilities });
    if (!parsed.success) {
      toast({ tone: 'danger', title: 'Valores inválidos', description: parsed.error.issues[0]?.message });
      setBusy(false);
      return;
    }
    try {
      await updateCreatureGmData(getSupabaseBrowserClient(), creatureId, { stats: parsed.data, notes: gm.notes, secrets: gm.secrets });
      toast({ tone: 'success', title: 'Estatísticas salvas.' });
      router.refresh();
    } catch (error) {
      toast({ tone: 'danger', title: 'Não foi possível salvar', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Estatísticas (Tormenta20)" description="Defesa, PV e iniciativa entram na cena e no combate." />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="t20-type" label="Tipo e tamanho" value={form.type} onChange={(event) => set({ type: event.target.value })} />
        <TextField id="t20-nd" label="ND" value={form.challenge} onChange={(event) => set({ challenge: event.target.value })} />
        <TextField id="t20-def" label="Defesa" inputMode="numeric" value={String(form.defense)} onChange={(event) => set({ defense: number(event.target.value) })} />
        <TextField id="t20-pv" label="Pontos de vida" inputMode="numeric" value={String(form.hitPoints)} onChange={(event) => set({ hitPoints: number(event.target.value) })} />
        <TextField id="t20-ini" label="Iniciativa" inputMode="numeric" value={String(form.initiative)} onChange={(event) => set({ initiative: number(event.target.value) })} />
        <TextField id="t20-speed" label="Deslocamento" value={form.speed} onChange={(event) => set({ speed: event.target.value })} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {T20_ATTRIBUTES.map((key) => (
          <TextField
            key={key}
            id={`t20-attr-${key}`}
            label={t20AttributeLabels[key].abbreviation}
            inputMode="numeric"
            value={form.attributes[key] === null ? '' : String(form.attributes[key])}
            onChange={(event) => set({ attributes: { ...form.attributes, [key]: event.target.value === '' ? null : number(event.target.value) } })}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <TextField id="t20-senses" label="Sentidos" value={form.senses} onChange={(event) => set({ senses: event.target.value })} />
        <TextField id="t20-defnotes" label="Resistências" value={form.defenseNotes} onChange={(event) => set({ defenseNotes: event.target.value })} />
        <TextareaField id="t20-melee" label="Corpo a corpo" rows={2} value={form.melee} onChange={(event) => set({ melee: event.target.value })} />
        <TextareaField id="t20-ranged" label="À distância" rows={2} value={form.ranged} onChange={(event) => set({ ranged: event.target.value })} />
        <TextareaField id="t20-abilities" label="Habilidades (uma por parágrafo: “Nome. Texto”)" rows={6} value={abilitiesText} onChange={(event) => setAbilitiesText(event.target.value)} />
        <TextField id="t20-skills" label="Perícias" value={form.skills} onChange={(event) => set({ skills: event.target.value })} />
        <TextField id="t20-equipment" label="Equipamento" value={form.equipment} onChange={(event) => set({ equipment: event.target.value })} />
        <TextField id="t20-treasure" label="Tesouro" value={form.treasure} onChange={(event) => set({ treasure: event.target.value })} />
      </div>
      <div className="mt-4">
        <Button loading={busy} onClick={() => void save()}>
          Salvar estatísticas
        </Button>
      </div>
    </Card>
  );
}
