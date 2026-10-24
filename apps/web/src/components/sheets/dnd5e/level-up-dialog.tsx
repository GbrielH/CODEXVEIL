'use client';

import {
  addCharacterEvent,
  adjustCharacterResource,
  createCharacterAbility,
  createCharacterResource,
  grantCharacterLevel,
  updateCharacterResource,
  type CharacterAbility,
} from '@codexveil/database';
import { rollDiceLocally } from '@codexveil/domain';
import {
  ABILITIES,
  DND5E_RESOURCE_KEYS,
  abilityLabels,
  applyDnd5eLevelUp,
  MAGIC_INITIATE_LISTS,
  dnd5eMulticlassOptions,
  featAbilityIncrease,
  featCategoryLabels,
  magicInitiateListLabels,
  magicInitiateOptions,
  planDnd5eLevelUp,
  skillDefinitions,
  skilledFeatOptions,
  spellNamePt,
  type Ability,
  type AbilityImprovement,
  type BookSpell,
  type Dnd5eLevelUpChoices,
  type MagicInitiateChoice,
  type MagicInitiateList,
  type Skill,
} from '@codexveil/rpg-systems/dnd5e';
import { Dices, Sparkles, TrendingUp } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useSheet } from './context';

type ImprovementMode = 'plus_two' | 'plus_one_each' | 'feat';

/**
 * Subida de nível: pede confirmação e abre o painel com o que muda pelas regras do SRD 5.2.1
 * (vida, habilidades novas, subclasse, atributos ou talento, magias e opções da classe). A
 * classe que sobe é escolhida numa lista, que também traz as classes novas (multiclasse).
 */
export function LevelUpButton() {
  const { derived, permissions, sheet, character } = useSheet();
  const [open, setOpen] = useState(false);
  const [granted, setGranted] = useState(character.grantedLevel);
  const [granting, setGranting] = useState(false);
  const { toast } = useToast();
  if (derived.level >= 20 || sheet.identity.classes.length === 0) return null;

  // Na campanha, o mestre libera o nível e o jogador escolhe as melhorias na aba Evolução.
  if (character.campaign) {
    const pending = granted > derived.level;
    if (permissions.isGm) {
      const grant = async () => {
        setGranting(true);
        try {
          setGranted(await grantCharacterLevel(getSupabaseBrowserClient(), character.id));
          toast({
            tone: 'success',
            title: `Nível ${derived.level + 1} liberado para ${character.name}.`,
            description: 'O jogador escolhe as melhorias na aba Evolução.',
          });
        } catch (error) {
          toast({
            tone: 'danger',
            title: 'O nível não foi liberado',
            description: failureMessage(error, 'Tente novamente.'),
          });
        } finally {
          setGranting(false);
        }
      };
      return pending ? (
        <span className="text-sm text-amber-300">
          Nível {granted} liberado: aguardando o jogador escolher as melhorias.
        </span>
      ) : (
        <Button
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
          loading={granting}
          onClick={() => void grant()}
        >
          Liberar nível {derived.level + 1}
        </Button>
      );
    }
    if (!permissions.isOwner) return null;
    if (!pending)
      return <span className="text-sm text-fg-muted">O mestre libera o próximo nível.</span>;
  } else if (!permissions.canEditSheet) {
    return null;
  }
  return (
    <>
      <ConfirmDialog
        trigger={(show) => (
          <Button icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />} onClick={show}>
            Subir de nível
          </Button>
        )}
        title={`Subir para o nível ${derived.level + 1}?`}
        description="Em seguida você escolhe a vida, as habilidades novas e as demais opções do nível, conforme as regras. Nada muda na ficha até aplicar."
        confirmLabel="Continuar"
        tone="primary"
        onConfirm={() => {
          setOpen(true);
          return Promise.resolve();
        }}
      />
      {open ? <LevelUpPanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LevelUpPanel({ onClose }: { onClose: () => void }) {
  const {
    character,
    sheet,
    resources,
    abilities,
    updateSheet,
    setAbilities,
    reloadResources,
    run,
  } = useSheet();
  const id = useId();
  // Classe que sobe: a posição de uma classe da ficha ou "nova:<classe>" (multiclasse).
  const [target, setTarget] = useState('0');
  const newClassId = target.startsWith('nova:') ? target.slice(5) : undefined;
  const classIndex = newClassId ? 0 : Number(target);
  const knownNames = useMemo(() => abilities.map((entry) => entry.name), [abilities]);
  const multiclassOptions = useMemo(() => dnd5eMulticlassOptions(sheet), [sheet]);
  const plan = useMemo(
    () => planDnd5eLevelUp(sheet, classIndex, knownNames, newClassId),
    [sheet, classIndex, knownNames, newClassId],
  );

  const [hpMethod, setHpMethod] = useState<'average' | 'roll'>('average');
  const [rolled, setRolled] = useState<number | null>(null);
  const [mode, setMode] = useState<ImprovementMode>('plus_two');
  const [first, setFirst] = useState<Ability>('str');
  const [second, setSecond] = useState<Ability>('dex');
  const [featId, setFeatId] = useState('');
  const [featAbility, setFeatAbility] = useState<Ability | ''>('');
  const [featSkills, setFeatSkills] = useState<(Skill | '')[]>(['', '', '']);
  const [initiate, setInitiate] = useState<MagicInitiateChoice>({
    list: '',
    cantrips: [],
    spell: '',
    ability: '',
  });
  const [cantrips, setCantrips] = useState<string[]>([]);
  const [spells, setSpells] = useState<string[]>([]);
  const [invocations, setInvocations] = useState<string[]>([]);
  const [metamagic, setMetamagic] = useState<string[]>([]);
  const [multiclassSkill, setMulticlassSkill] = useState<Skill | ''>('');
  const [multiclassInstrument, setMulticlassInstrument] = useState('');
  const [subclassId, setSubclassId] = useState('');
  const [landId, setLandId] = useState('');
  const [optionalIds, setOptionalIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const featOptions = plan.feats.filter((feat) => feat.id !== 'ability_score_improvement');
  const featIncrease = featId ? featAbilityIncrease(featId) : null;
  let improvement: AbilityImprovement | null = null;
  if (plan.abilityScoreImprovement) {
    if (mode === 'plus_two') improvement = { kind: 'plus_two', ability: first };
    else if (mode === 'plus_one_each')
      improvement = { kind: 'plus_one_each', abilities: [first, second] };
    else if (featId)
      improvement = { kind: 'feat', featId, ...(featAbility ? { ability: featAbility } : {}) };
  }
  const choices: Dnd5eLevelUpChoices = {
    // A rolagem vale uma vez só: depois de rolar, não dá para trocar pela média nem rolar de novo.
    hitPoints:
      hpMethod === 'roll'
        ? { method: 'roll', die: Math.min(rolled ?? 0, plan.hitDieSides) }
        : { method: 'average' },
    improvement,
    cantrips,
    spells,
    invocations,
    metamagic,
    ...(multiclassSkill ? { multiclassSkill } : {}),
    ...(multiclassInstrument ? { multiclassInstrument } : {}),
    featSkills: featSkills.filter((skill): skill is Skill => Boolean(skill)),
    magicInitiate: initiate,
    ...(subclassId ? { subclassId } : {}),
    ...(landId ? { landId } : {}),
    optionalFeatures: optionalIds,
  };
  const result = applyDnd5eLevelUp(sheet, plan, choices);
  const blockedOptions = multiclassOptions.filter((option) => option.blocked.length > 0);
  const chosenSubclass = plan.subclassOptions.find((option) => option.id === subclassId);

  const resetChoices = (value: string) => {
    setTarget(value);
    setCantrips([]);
    setSpells([]);
    setInvocations([]);
    setMetamagic([]);
    setMulticlassSkill('');
    setMulticlassInstrument('');
    setSubclassId('');
  };

  const apply = async () => {
    if (result.issues.length) return;
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const created = await run(
      async () => {
        const byKey = new Map(resources.map((resource) => [resource.key, resource]));
        const resourceIds = new Map(resources.map((resource) => [resource.key, resource.id]));
        for (const template of result.resources) {
          const existing = byKey.get(template.key);
          if (!existing) {
            const saved = await createCharacterResource(supabase, character.id, template);
            resourceIds.set(saved.key, saved.id);
          } else if (existing.max !== template.max) {
            // O máximo novo entra como usos disponíveis a mais (ou a menos), sem restaurar os gastos.
            const difference = (template.max ?? 0) - (existing.max ?? 0);
            await updateCharacterResource(supabase, existing.id, {
              label: template.key.startsWith('pact_slots') ? template.label : existing.label,
              current: Math.max(0, existing.current + difference),
              max: template.max,
              recovery: existing.recovery,
            });
          }
        }
        const hp = byKey.get(DND5E_RESOURCE_KEYS.hitPoints);
        if (hp && hp.max !== null) {
          await adjustCharacterResource(
            supabase,
            hp.id,
            'set_max',
            hp.max + result.hitPointsGained,
          );
          await adjustCharacterResource(supabase, hp.id, 'heal', result.hitPointsGained);
        }
        const existingNames = new Set(abilities.map((entry) => `${entry.kind}:${entry.name}`));
        const saved: CharacterAbility[] = [];
        for (const entry of result.abilities) {
          if (existingNames.has(`${entry.kind}:${entry.name}`)) continue;
          saved.push(
            await createCharacterAbility(supabase, character.id, {
              kind: entry.kind,
              name: entry.name,
              source: entry.source,
              description: entry.description,
              data: entry.data as CharacterAbility['data'],
              resourceId: entry.resourceKey ? (resourceIds.get(entry.resourceKey) ?? null) : null,
            }),
          );
        }
        await addCharacterEvent(supabase, character.id, {
          kind: 'level_up',
          summary: result.summary,
          data: { classIndex: plan.classIndex, level: plan.newTotalLevel },
        });
        return saved;
      },
      {
        success: `${character.name} subiu para o nível ${plan.newTotalLevel}.`,
        failure: 'A subida de nível não foi concluída',
      },
    );
    setBusy(false);
    if (!created) return;
    updateSheet(() => result.sheet);
    setAbilities((current) => [...current, ...created]);
    await reloadResources();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title={`Nível ${plan.newTotalLevel}: ${plan.className || 'classe'} ${plan.newClassLevel}`}
      description={
        plan.classDef
          ? 'Regras do SRD 5.2.1 e dos livros liberados. Escolha o que o nível oferece e aplique.'
          : 'Esta classe não está no SRD nem nos livros liberados: o nível sobe e a vida é calculada, mas habilidades e magias ficam por sua conta.'
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-class`} className="text-sm font-medium">
          Classe que sobe de nível
        </label>
        <Select
          id={`${id}-class`}
          value={target}
          onChange={(event) => resetChoices(event.target.value)}
        >
          <optgroup label="Suas classes">
            {sheet.identity.classes.map((entry, index) => (
              <option
                key={`${entry.name}-${index}`}
                value={String(index)}
                disabled={entry.level >= 20}
              >
                {entry.name || 'Sem nome'} {entry.level} → {entry.level + 1}
              </option>
            ))}
          </optgroup>
          <optgroup label="Nova classe (multiclasse)">
            {multiclassOptions.map((option) => (
              <option
                key={option.classDef.id}
                value={`nova:${option.classDef.id}`}
                disabled={option.blocked.length > 0}
              >
                {option.classDef.name} 1
                {option.blocked.length > 0 ? ' · requisito não atendido' : ''}
              </option>
            ))}
          </optgroup>
        </Select>
        <p className="text-xs text-fg-muted">
          Multiclasse (SRD 5.2.1): 13 ou mais no atributo principal da classe nova e das que você já
          tem.
        </p>
        {blockedOptions.length > 0 ? (
          <details className="text-xs text-fg-muted">
            <summary className="cursor-pointer">Por que algumas classes estão bloqueadas</summary>
            <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
              {blockedOptions.map((option) => (
                <li key={option.classDef.id}>
                  {option.classDef.name}: {option.blocked.join(' ')}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {plan.multiclass ? (
        <Section title="Nova classe">
          <p className="text-sm text-fg-secondary">
            {plan.className} entra no 1º nível, com dado de vida {plan.classDef?.hitDie}. Os testes
            de resistência continuam os da primeira classe.
            {[
              plan.multiclass.training.armor,
              plan.multiclass.training.weapons,
              plan.multiclass.training.tools,
            ].some(Boolean)
              ? ` Treinamento novo: ${[plan.multiclass.training.armor, plan.multiclass.training.weapons, plan.multiclass.training.tools].filter(Boolean).join('; ')}.`
              : ''}
          </p>
          {plan.multiclass.skillOptions.length > 0 ||
          plan.multiclass.instrumentOptions.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {plan.multiclass.skillOptions.length > 0 ? (
                <Select
                  aria-label="Perícia da nova classe"
                  value={multiclassSkill}
                  placeholder="Perícia"
                  onChange={(event) => setMulticlassSkill(event.target.value as Skill)}
                >
                  <option value="">Perícia</option>
                  {plan.multiclass.skillOptions.map((skill) => (
                    <option key={skill} value={skill}>
                      {skillDefinitions[skill].label}
                    </option>
                  ))}
                </Select>
              ) : null}
              {plan.multiclass.instrumentOptions.length > 0 ? (
                <Select
                  aria-label="Instrumento musical"
                  value={multiclassInstrument}
                  placeholder="Instrumento musical"
                  onChange={(event) => setMulticlassInstrument(event.target.value)}
                >
                  <option value="">Instrumento musical</option>
                  {plan.multiclass.instrumentOptions.map((instrument) => (
                    <option key={instrument.id} value={instrument.id}>
                      {instrument.name}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
          ) : null}
        </Section>
      ) : null}

      {plan.subclass ? (
        <Alert tone="info" title={`Subclasse: ${plan.subclass.name}`}>
          {plan.subclass.description} Outras subclasses aparecem aqui quando o mestre libera livros
          na campanha.
        </Alert>
      ) : null}
      {plan.optionalFeatures.length > 0 ? (
        <Section title="Características opcionais (Caldeirão de Tasha)">
          <p className="text-xs text-fg-muted">
            Opcionais: marque as que quiser. Se substituir outra característica, apague a original
            da ficha depois.
          </p>
          <ul className="flex flex-col gap-2">
            {plan.optionalFeatures.map((option) => (
              <li key={option.id}>
                <label className="flex cursor-pointer gap-2 rounded-md border border-line p-2 text-sm has-[:checked]:border-wine-400">
                  <input
                    type="checkbox"
                    checked={optionalIds.includes(option.id)}
                    onChange={(event) =>
                      setOptionalIds((current) =>
                        event.target.checked
                          ? [...current, option.id]
                          : current.filter((id) => id !== option.id),
                      )
                    }
                  />
                  <span>
                    <span className="font-medium text-fg">{option.name}</span>
                    {option.replaces ? (
                      <span className="text-fg-muted"> — no lugar de {option.replaces}</span>
                    ) : null}
                    <span className="block text-xs text-fg-muted">
                      {option.description.slice(0, 300)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {plan.subclassOptions.length > 0 ? (
        <Section title="Subclasse">
          <Select
            aria-label="Subclasse"
            value={subclassId}
            placeholder="Escolha a subclasse"
            onChange={(event) => setSubclassId(event.target.value)}
          >
            <option value="">Escolha a subclasse</option>
            {plan.subclassOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.book ? ` (${option.book})` : ' (SRD)'}
              </option>
            ))}
          </Select>
          {chosenSubclass &&
          chosenSubclass.id !== 'land' &&
          (chosenSubclass.landOptions ?? []).length > 0 ? (
            <Select
              aria-label="Terreno do círculo"
              value={landId}
              onChange={(event) => setLandId(event.target.value)}
            >
              <option value="">Escolha o terreno (magias de círculo)</option>
              {(chosenSubclass.landOptions ?? []).map((land) => (
                <option key={land.id} value={land.id}>
                  {land.name}:{' '}
                  {land.spells
                    .map((group) => `${group.level}º ${group.spells.join(', ')}`)
                    .join(' · ')}
                </option>
              ))}
            </Select>
          ) : null}
          {chosenSubclass ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs whitespace-pre-line text-fg-muted">
                {chosenSubclass.description}
              </p>
              <ul className="flex flex-col gap-2">
                {chosenSubclass.features
                  .filter((feature) => feature.level <= plan.newClassLevel)
                  .map((feature) => (
                    <li key={feature.name} className="rounded-md border border-line bg-sunken p-3">
                      <p className="text-sm font-medium text-fg">{feature.name}</p>
                      <p className="mt-0.5 text-xs whitespace-pre-line text-fg-muted">
                        {feature.description}
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section title="Habilidades novas">
        {plan.features.length === 0 ? (
          <p className="text-sm text-fg-muted">Nenhuma habilidade nova neste nível.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {plan.features.map((feature) => (
              <li key={feature.name} className="rounded-md border border-line bg-sunken p-3">
                <p className="text-sm font-medium text-fg">{feature.name}</p>
                <p className="mt-0.5 text-xs text-fg-muted">{feature.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Pontos de vida">
        <div className="flex flex-wrap items-center gap-2">
          <Choice
            name={`${id}-hp`}
            checked={hpMethod === 'average'}
            onChange={() => setHpMethod('average')}
            disabled={rolled !== null}
            label={`Média: ${Math.floor(plan.hitDieSides / 2) + 1}`}
          />
          <Choice
            name={`${id}-hp`}
            checked={hpMethod === 'roll'}
            onChange={() => setHpMethod('roll')}
            label={`Rolar 1d${plan.hitDieSides}`}
          />
          {hpMethod === 'roll' ? (
            rolled === null ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<Dices className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setRolled(rollDiceLocally(`1d${plan.hitDieSides}`)?.total ?? null)}
              >
                Rolar (uma vez)
              </Button>
            ) : (
              <span className="text-sm text-fg">
                Rolou <strong>{Math.min(rolled, plan.hitDieSides)}</strong> · resultado final
              </span>
            )
          ) : null}
        </div>
        <p className="mt-2 text-sm text-fg-secondary">
          Máximo de PV <strong className="text-fg">+{result.hitPointsGained}</strong> (inclui o
          modificador de Constituição
          {plan.conModifier !== 0
            ? ` de ${plan.conModifier > 0 ? '+' : ''}${plan.conModifier}`
            : ''}
          ).
        </p>
      </Section>

      {plan.abilityScoreImprovement ? (
        <Section
          title={
            plan.epicBoon ? 'Dádiva épica ou talento' : 'Aumento no Valor de Atributo ou talento'
          }
        >
          <div className="flex flex-wrap gap-2">
            <Choice
              name={`${id}-asi`}
              checked={mode === 'plus_two'}
              onChange={() => setMode('plus_two')}
              label="+2 em um atributo"
            />
            <Choice
              name={`${id}-asi`}
              checked={mode === 'plus_one_each'}
              onChange={() => setMode('plus_one_each')}
              label="+1 em dois"
            />
            <Choice
              name={`${id}-asi`}
              checked={mode === 'feat'}
              onChange={() => setMode('feat')}
              label="Talento"
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {mode !== 'feat' ? (
              <AbilitySelect
                label="Atributo"
                value={first}
                onChange={setFirst}
                scores={sheet.abilities}
              />
            ) : null}
            {mode === 'plus_one_each' ? (
              <AbilitySelect
                label="Segundo atributo"
                value={second}
                onChange={setSecond}
                scores={sheet.abilities}
              />
            ) : null}
            {mode === 'feat' ? (
              <Select
                aria-label="Talento"
                value={featId}
                placeholder="Escolha o talento"
                onChange={(event) => {
                  setFeatId(event.target.value);
                  setFeatAbility('');
                  setFeatSkills(['', '', '']);
                  setInitiate({ list: '', cantrips: [], spell: '', ability: '' });
                }}
              >
                <option value="">Escolha o talento</option>
                {(['general', 'origin', 'fighting_style', 'epic'] as const).map((category) =>
                  featOptions.some((feat) => feat.category === category) ? (
                    <optgroup key={category} label={featCategoryLabels[category]}>
                      {featOptions
                        .filter((feat) => feat.category === category)
                        .map((feat) => (
                          <option key={feat.id} value={feat.id}>
                            {feat.name}
                          </option>
                        ))}
                    </optgroup>
                  ) : null,
                )}
              </Select>
            ) : null}
            {mode === 'feat' && featIncrease ? (
              <Select
                aria-label="Atributo do talento"
                value={featAbility}
                placeholder="Atributo +1"
                onChange={(event) => setFeatAbility(event.target.value as Ability)}
              >
                <option value="">Atributo +1</option>
                {featIncrease.abilities.map((ability) => (
                  <option key={ability} value={ability}>
                    {abilityLabels[ability].name} ({sheet.abilities[ability]})
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          {mode === 'feat' && featId ? (
            <p className="mt-2 text-xs text-fg-muted">
              {featOptions.find((feat) => feat.id === featId)?.description}
            </p>
          ) : null}
          {mode === 'feat' && featOptions.length === 0 ? (
            <p className="mt-2 text-sm text-fg-muted">
              Nenhum talento disponível para este personagem.
            </p>
          ) : null}
          {mode === 'feat' && featId === 'skilled' ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {featSkills.map((value, position) => (
                <Select
                  key={position}
                  aria-label={`Perícia ${position + 1} do talento Habilidoso`}
                  value={value}
                  placeholder={`Perícia ${position + 1}`}
                  onChange={(event) =>
                    setFeatSkills((current) =>
                      current.map((entry, index) =>
                        index === position ? (event.target.value as Skill) : entry,
                      ),
                    )
                  }
                >
                  <option value="">{`Perícia ${position + 1}`}</option>
                  {skilledFeatOptions(sheet)
                    .filter((skill) => skill === value || !featSkills.includes(skill))
                    .map((skill) => (
                      <option key={skill} value={skill}>
                        {skillDefinitions[skill].label}
                      </option>
                    ))}
                </Select>
              ))}
            </div>
          ) : null}
          {mode === 'feat' && featId === 'magic_initiate' ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  aria-label="Lista do Iniciado em Magia"
                  value={initiate.list}
                  placeholder="Lista de magias"
                  onChange={(event) =>
                    setInitiate((current) => ({
                      ...current,
                      list: event.target.value as MagicInitiateList,
                      cantrips: [],
                      spell: '',
                    }))
                  }
                >
                  <option value="">Lista de magias</option>
                  {MAGIC_INITIATE_LISTS.map((list) => (
                    <option key={list} value={list}>
                      {magicInitiateListLabels[list]}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Atributo de conjuração"
                  value={initiate.ability}
                  placeholder="Atributo de conjuração"
                  onChange={(event) =>
                    setInitiate((current) => ({
                      ...current,
                      ability: event.target.value as MagicInitiateChoice['ability'],
                    }))
                  }
                >
                  <option value="">Atributo de conjuração</option>
                  {(['int', 'wis', 'cha'] as const).map((ability) => (
                    <option key={ability} value={ability}>
                      {abilityLabels[ability].name}
                    </option>
                  ))}
                </Select>
              </div>
              {initiate.list ? (
                <>
                  <SpellPicker
                    title="Truques do Iniciado em Magia"
                    count={2}
                    options={magicInitiateOptions(initiate.list, knownNames).cantrips}
                    value={[...initiate.cantrips]}
                    onChange={(cantripsChosen) =>
                      setInitiate((current) => ({ ...current, cantrips: cantripsChosen }))
                    }
                  />
                  <SpellPicker
                    title="Magia de 1º círculo do Iniciado em Magia"
                    count={1}
                    options={magicInitiateOptions(initiate.list, knownNames).spells}
                    value={initiate.spell ? [initiate.spell] : []}
                    onChange={(chosen) =>
                      setInitiate((current) => ({ ...current, spell: chosen[0] ?? '' }))
                    }
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </Section>
      ) : null}

      {plan.newCantrips > 0 ? (
        <SpellPicker
          title="Truques novos"
          count={plan.newCantrips}
          options={plan.cantripOptions}
          value={cantrips}
          onChange={setCantrips}
        />
      ) : null}
      {plan.newSpells > 0 ? (
        <SpellPicker
          title={
            plan.classDef?.spellcasting?.spellbook
              ? 'Magias para o grimório'
              : 'Magias preparadas a mais'
          }
          hint={`Até o ${plan.maxSpellCircle}º círculo.`}
          count={plan.newSpells}
          options={plan.spellOptions}
          value={spells}
          onChange={setSpells}
        />
      ) : null}
      {plan.newInvocations > 0 ? (
        <OptionPicker
          title="Invocações Místicas"
          count={plan.newInvocations}
          options={plan.invocationOptions.map((option) => ({
            id: option.id,
            name: option.name,
            description: option.description,
          }))}
          value={invocations}
          onChange={setInvocations}
        />
      ) : null}
      {plan.newMetamagic > 0 ? (
        <OptionPicker
          title="Metamagia"
          count={plan.newMetamagic}
          options={plan.metamagicOptions.map((option) => ({
            id: option.id,
            name: option.name,
            description: option.description,
          }))}
          value={metamagic}
          onChange={setMetamagic}
        />
      ) : null}
      {plan.newWeaponMasteries > 0 ? (
        <Alert
          tone="info"
          title={`Maestria em mais ${plan.newWeaponMasteries} arma${plan.newWeaponMasteries > 1 ? 's' : ''}`}
        >
          Registre a arma escolhida no ataque correspondente da aba Habilidades.
        </Alert>
      ) : null}

      {plan.resources.length ? (
        <Section title="Recursos no novo nível">
          <ul className="flex flex-wrap gap-1.5">
            {plan.resources.map((resource) => (
              <li key={resource.key}>
                <Badge tone="parchment">
                  {resource.label}: {resource.max}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {result.issues.length ? (
        <Alert tone="warning" title="Falta escolher">
          <ul className="list-disc pl-4">
            {result.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          loading={busy}
          disabled={result.issues.length > 0}
          onClick={() => void apply()}
        >
          Aplicar nível {plan.newTotalLevel}
        </Button>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">{title}</h3>
      {children}
    </section>
  );
}

function Choice({
  name,
  checked,
  onChange,
  label,
  disabled,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-sunken px-3 py-1.5 text-sm has-[:checked]:border-wine-500 has-[:checked]:text-fg has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="accent-wine-500"
      />
      {label}
    </label>
  );
}

function AbilitySelect({
  label,
  value,
  onChange,
  scores,
}: {
  label: string;
  value: Ability;
  onChange: (ability: Ability) => void;
  scores: Record<Ability, number>;
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as Ability)}
    >
      {ABILITIES.map((ability) => (
        <option key={ability} value={ability} disabled={scores[ability] >= 20}>
          {abilityLabels[ability].name} ({scores[ability]})
        </option>
      ))}
    </Select>
  );
}

function toggle(list: string[], value: string, limit: number): string[] {
  if (list.includes(value)) return list.filter((entry) => entry !== value);
  return list.length >= limit ? list : [...list, value];
}

function SpellPicker({
  title,
  hint,
  count,
  options,
  value,
  onChange,
}: {
  title: string;
  hint?: string;
  count: number;
  options: readonly BookSpell[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const filtered = term
    ? options.filter((spell) =>
        `${spellNamePt(spell.name)} ${spell.name}`.toLowerCase().includes(term),
      )
    : options;
  return (
    <Section title={`${title} (${value.length}/${count})`}>
      {hint ? <p className="text-xs text-fg-muted">{hint}</p> : null}
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar magia…"
        aria-label={`Buscar em ${title}`}
        className="h-9 rounded-md border border-line bg-sunken px-3 text-sm text-fg placeholder:text-fg-muted"
      />
      <ul className="max-h-56 overflow-y-auto rounded-md border border-line">
        {filtered.map((spell) => {
          const checked = value.includes(spell.name);
          return (
            <li key={spell.name} className="border-b border-line last:border-b-0">
              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && value.length >= count}
                  onChange={() => onChange(toggle(value, spell.name, count))}
                  className="accent-wine-500"
                />
                <span className="flex-1">{spellNamePt(spell.name)}</span>
                <span className="text-xs text-fg-muted">
                  {spell.level === 0 ? 'Truque' : `${spell.level}º`} · {spell.castingTime}
                  {spell.book ? ` · ${spell.book.name}` : ''}
                </span>
              </label>
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-fg-muted">Nenhuma magia encontrada.</li>
        ) : null}
      </ul>
    </Section>
  );
}

function OptionPicker({
  title,
  count,
  options,
  value,
  onChange,
}: {
  title: string;
  count: number;
  options: { id: string; name: string; description: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <Section title={`${title} (${value.length}/${count})`}>
      <ul className="max-h-56 overflow-y-auto rounded-md border border-line">
        {options.map((option) => {
          const checked = value.includes(option.id);
          return (
            <li key={option.id} className="border-b border-line last:border-b-0">
              <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && value.length >= count}
                  onChange={() => onChange(toggle(value, option.id, count))}
                  className="mt-1 accent-wine-500"
                />
                <span>
                  <span className="font-medium text-fg">{option.name}</span>
                  <span className="block text-xs text-fg-muted">{option.description}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
