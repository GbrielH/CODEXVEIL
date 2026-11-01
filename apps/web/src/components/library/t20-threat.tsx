'use client';

import { updateCreatureGmData } from '@codexveil/database';
import {
  T20_ATTRIBUTES,
  T20_SAVES,
  T20_SKILLS,
  T20_SKILL_IDS,
  t20ThreatSkillBonus,
  t20ThreatSkillLine,
  type T20Skill,
  formatT20Bonus,
  t20AttributeLabels,
  t20StatBlockSchema,
  type T20StatBlock,
} from '@codexveil/rpg-systems/tormenta20';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cx } from '@/lib/cx';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { TextField, TextareaField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useDraftState } from '@/lib/use-draft-state';

export interface T20BookOption {
  name: string;
  text: string;
}

const SAVE_PREFIX = /^(fortitude|reflexos|vontade|fort|ref|von)\b/i;

/**
 * Perícias e resistências como na ficha do jogador: marca as treinadas e o bônus sai sozinho
 * (metade do ND + atributo + treinamento). "Aplicar" escreve a linha no campo (que segue editável).
 */
function SkillPicker({
  stats,
  skills,
  initial,
  includeAll,
  onApply,
}: {
  stats: T20StatBlock;
  skills: readonly T20Skill[];
  initial: T20Skill[];
  /** Resistências: as três sempre entram (marcar = treinada). Perícias: só as marcadas. */
  includeAll: boolean;
  onApply: (line: string) => void;
}) {
  const [trained, setTrained] = useState<T20Skill[]>(initial);
  const shown = includeAll ? skills : skills.filter((skill) => trained.includes(skill));
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-canvas/40 p-2">
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill) => {
          const on = trained.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setTrained((current) =>
                  on ? current.filter((entry) => entry !== skill) : [...current, skill],
                )
              }
              className={cx(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                on
                  ? 'border-parchment-300 bg-wine-900/60 text-fg-accent'
                  : 'border-line text-fg-secondary hover:bg-hover',
              )}
            >
              {T20_SKILLS[skill].label}{' '}
              <span className="text-fg-muted">
                {formatT20Bonus(t20ThreatSkillBonus(stats, skill, on))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-xs text-fg-muted">
          {shown.length ? t20ThreatSkillLine(stats, shown, trained) : 'Marque as treinadas.'}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={!shown.length}
          onClick={() => onApply(t20ThreatSkillLine(stats, shown, trained))}
        >
          Aplicar
        </Button>
      </div>
    </div>
  );
}

/** Busca no livro (magias, poderes ou itens): tocar adiciona; o campo manual continua valendo. */
function BookPicker({
  label,
  options,
  onPick,
}: {
  label: string;
  options: T20BookOption[];
  onPick: (option: T20BookOption) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return options.filter((option) => option.name.toLowerCase().includes(term)).slice(0, 8);
  }, [options, query]);
  if (!options.length) return null;
  return (
    <div className="relative">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={label}
        aria-label={label}
        className="h-9 w-full rounded-md border border-line bg-sunken px-3 text-sm text-fg placeholder:text-fg-muted focus:border-fg-brand focus:outline-none"
      />
      {matches.length ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-raised shadow-xl">
          {matches.map((option) => (
            <li key={option.name}>
              <button
                type="button"
                onClick={() => {
                  onPick(option);
                  setQuery('');
                }}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-hover"
              >
                <span className="text-fg">{option.name}</span>
                {option.text ? (
                  <span className="line-clamp-1 text-xs text-fg-muted">{option.text}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Ficha de ameaça do Tormenta20 (leitura). Com `only`, só as partes que o mestre liberou. */
export function T20ThreatView({
  name,
  stats,
  only,
}: {
  name: string;
  stats: T20StatBlock;
  only?: ReadonlySet<string>;
}) {
  const show = (key: string) => !only || only.has(key);
  const rows = (
    [
      ['Iniciativa e sentidos', stats.senses, 'senses'],
      [
        'Defesa',
        `${stats.defense}${stats.defenseNotes ? ` · ${stats.defenseNotes}` : ''}`,
        'defense',
      ],
      [
        'Pontos de vida',
        `${stats.hitPoints}${stats.manaPoints !== null ? ` · PM ${stats.manaPoints}` : ''}`,
        'hitPoints',
      ],
      ['Deslocamento', stats.speed, 'speed'],
      ['Corpo a corpo', stats.melee, 'melee'],
      ['À distância', stats.ranged, 'ranged'],
      ['Perícias', stats.skills, 'skills'],
      ['Equipamento', stats.equipment, 'equipment'],
      ['Tesouro', stats.treasure, 'treasure'],
    ] as const
  )
    .filter(([, , key]) => show(key))
    .map(([label, value]) => [label, value] as [string, string]);
  return (
    <Card ornate>
      <CardHeader
        title={name}
        description={[
          show('type') ? stats.type : '',
          show('challenge') && stats.challenge ? `ND ${stats.challenge}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      />
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
      {show('attributes') ? (
        <div className="my-3 grid grid-cols-6 gap-1 text-center">
          {T20_ATTRIBUTES.map((key) => (
            <div key={key} className="rounded border border-line py-1">
              <p className="text-[10px] tracking-wider text-fg-subtle uppercase">
                {t20AttributeLabels[key].abbreviation}
              </p>
              <p className="tabular text-fg">
                {stats.attributes[key] === null ? '—' : formatT20Bonus(stats.attributes[key])}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {(show('abilities') ? stats.abilities : []).map((ability) => (
        <p key={ability.name} className="mt-2 text-sm text-fg-secondary">
          <strong className="text-fg">{ability.name}.</strong> {ability.text}
        </p>
      ))}
      {stats.description && show('description') ? (
        <p className="mt-3 text-sm whitespace-pre-line text-fg-muted">{stats.description}</p>
      ) : null}
    </Card>
  );
}

/** Editor das estatísticas T20 (mestres): os campos usados no combate e o texto da ficha. */
export function T20ThreatEditor({
  creatureId,
  stats,
  gm,
  book = { spells: [], powers: [], equipment: [] },
}: {
  creatureId: string;
  stats: T20StatBlock;
  gm: { notes: string; secrets: string };
  /** Conteúdo dos livros liberados: escolher primeiro do livro, digitar só se faltar. */
  book?: { spells: T20BookOption[]; powers: T20BookOption[]; equipment: T20BookOption[] };
}) {
  const router = useRouter();
  const { toast } = useToast();
  // Rascunho guardado na aba até salvar (o celular pode recarregar a página no meio).
  const [draft, setDraft, clearDraft, draftRestored] = useDraftState(`criatura:${creatureId}:t20`, {
    form: stats,
    abilitiesText: stats.abilities
      .map((ability) => `${ability.name}. ${ability.text}`)
      .join('\n\n'),
  });
  const form = draft.form;
  const abilitiesText = draft.abilitiesText;
  const setForm = (next: T20StatBlock | ((current: T20StatBlock) => T20StatBlock)) =>
    setDraft((current) => ({
      ...current,
      form: typeof next === 'function' ? next(current.form) : next,
    }));
  const setAbilitiesText = (next: string) =>
    setDraft((current) => ({ ...current, abilitiesText: next }));
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<T20StatBlock>) => setForm((current) => ({ ...current, ...patch }));
  const number = (value: string) =>
    Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;

  const save = async () => {
    setBusy(true);
    const abilities = abilitiesText
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const match = /^([^.]{1,120})\.\s*([\s\S]*)$/.exec(block);
        return match
          ? { name: match[1]!.trim(), text: match[2]!.trim() }
          : { name: block.slice(0, 60), text: '' };
      });
    const parsed = t20StatBlockSchema.safeParse({ ...form, abilities });
    if (!parsed.success) {
      toast({
        tone: 'danger',
        title: 'Valores inválidos',
        description: parsed.error.issues[0]?.message,
      });
      setBusy(false);
      return;
    }
    try {
      await updateCreatureGmData(getSupabaseBrowserClient(), creatureId, {
        stats: parsed.data,
        notes: gm.notes,
        secrets: gm.secrets,
      });
      clearDraft();
      toast({ tone: 'success', title: 'Estatísticas salvas.' });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível salvar',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card ornate>
      <CardHeader
        title="Ficha da ameaça · Tormenta20"
        description="Defesa, PV e iniciativa entram na cena e no combate."
      />
      {draftRestored ? (
        <p className="mb-3 rounded-md border border-arcane-400/40 bg-arcane-900/30 px-3 py-2 text-sm text-fg-secondary">
          Recuperamos o que você tinha preenchido e ainda não salvou. Confira e salve.
        </p>
      ) : null}
      <div className="grid gap-3 rounded-2xl border border-line bg-gradient-to-b from-wine-950/40 to-charcoal-900 p-4 sm:grid-cols-2">
        <TextField
          id="t20-type"
          label="Tipo e tamanho"
          value={form.type}
          onChange={(event) => set({ type: event.target.value })}
        />
        <TextField
          id="t20-nd"
          label="ND"
          value={form.challenge}
          onChange={(event) => set({ challenge: event.target.value })}
        />
        <TextField
          id="t20-def"
          label="Defesa"
          inputMode="numeric"
          value={String(form.defense)}
          onChange={(event) => set({ defense: number(event.target.value) })}
        />
        <TextField
          id="t20-pv"
          label="Pontos de vida"
          inputMode="numeric"
          value={String(form.hitPoints)}
          onChange={(event) => set({ hitPoints: number(event.target.value) })}
        />
        <TextField
          id="t20-ini"
          label="Iniciativa"
          inputMode="numeric"
          value={String(form.initiative)}
          onChange={(event) => set({ initiative: number(event.target.value) })}
        />
        <TextField
          id="t20-speed"
          label="Deslocamento"
          value={form.speed}
          onChange={(event) => set({ speed: event.target.value })}
        />
      </div>
      <p className="mt-4 font-display text-xs tracking-[0.2em] text-fg-muted uppercase">
        Atributos
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {T20_ATTRIBUTES.map((key) => (
          <div
            key={key}
            className="flex flex-col items-center gap-1 rounded-xl border border-parchment-400/30 bg-canvas/60 p-2 text-center"
          >
            <span className="font-display text-2xl leading-none text-fg-accent">
              {form.attributes[key] === null
                ? '—'
                : `${(form.attributes[key] ?? 0) >= 0 ? '+' : ''}${form.attributes[key]}`}
            </span>
            <TextField
              id={`t20-attr-${key}`}
              label={t20AttributeLabels[key].abbreviation}
              inputMode="numeric"
              value={form.attributes[key] === null ? '' : String(form.attributes[key])}
              onChange={(event) =>
                set({
                  attributes: {
                    ...form.attributes,
                    [key]: event.target.value === '' ? null : number(event.target.value),
                  },
                })
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <TextField
          id="t20-senses"
          label="Sentidos"
          value={form.senses}
          onChange={(event) => set({ senses: event.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <TextField
            id="t20-defnotes"
            label="Resistências"
            value={form.defenseNotes}
            onChange={(event) => set({ defenseNotes: event.target.value })}
            hint="Marque as resistências em que a ameaça é treinada; o bônus é calculado como na ficha do jogador."
          />
          <SkillPicker
            stats={form}
            skills={T20_SAVES}
            initial={[]}
            includeAll
            onApply={(line) => {
              // Mantém o resto (redução de dano, imunidades…).
              const extras = form.defenseNotes
                .split(',')
                .map((part) => part.trim())
                .filter((part) => part && !SAVE_PREFIX.test(part));
              set({ defenseNotes: [line, ...extras].join(', ') });
            }}
          />
        </div>
        <TextareaField
          id="t20-melee"
          label="Corpo a corpo"
          rows={2}
          value={form.melee}
          onChange={(event) => set({ melee: event.target.value })}
        />
        <TextareaField
          id="t20-ranged"
          label="À distância"
          rows={2}
          value={form.ranged}
          onChange={(event) => set({ ranged: event.target.value })}
        />
        <BookPicker
          label="Adicionar magia ou poder do livro (busque pelo nome)"
          options={[...book.powers, ...book.spells]}
          onPick={(option) =>
            setAbilitiesText(
              `${abilitiesText.trim() ? `${abilitiesText.trim()}\n\n` : ''}${option.name}. ${option.text}`,
            )
          }
        />
        <TextareaField
          id="t20-abilities"
          label="Habilidades (uma por parágrafo: “Nome. Texto”)"
          rows={6}
          value={abilitiesText}
          onChange={(event) => setAbilitiesText(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <TextField
            id="t20-skills"
            label="Perícias"
            value={form.skills}
            onChange={(event) => set({ skills: event.target.value })}
          />
          <SkillPicker
            stats={form}
            skills={T20_SKILL_IDS.filter(
              (skill) => !(T20_SAVES as readonly T20Skill[]).includes(skill),
            )}
            initial={[]}
            includeAll={false}
            onApply={(line) => set({ skills: line })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <TextField
            id="t20-equipment"
            label="Equipamento"
            value={form.equipment}
            onChange={(event) => set({ equipment: event.target.value })}
          />
          <BookPicker
            label="Adicionar item do livro (busque pelo nome)"
            options={book.equipment}
            onPick={(option) =>
              set({
                equipment: form.equipment.trim()
                  ? `${form.equipment.trim()}, ${option.name}`
                  : option.name,
              })
            }
          />
        </div>
        <TextField
          id="t20-treasure"
          label="Tesouro"
          value={form.treasure}
          onChange={(event) => set({ treasure: event.target.value })}
        />
      </div>
      <div className="mt-4">
        <Button loading={busy} onClick={() => void save()}>
          Salvar estatísticas
        </Button>
      </div>
    </Card>
  );
}
