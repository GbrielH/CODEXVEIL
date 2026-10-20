'use client';

import { addCharacterEvent, adjustCharacterResource, createCharacterAbility, grantCharacterLevel, saveCharacterSheet, type CharacterAbility, type CharacterResource } from '@codexveil/database';
import {
  T20_ATTRIBUTES,
  T20_RESOURCE_KEYS,
  T20_SKILLS,
  T20_SKILL_IDS,
  applyT20LevelUp,
  isT20AttributeIncrease,
  planT20LevelUp,
  t20AttributeLabels,
  t20PowerSkillPick,
  type T20Attribute,
  type T20Content,
  type T20Sheet,
  type T20Skill,
} from '@codexveil/rpg-systems/tormenta20';
import { TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckboxField, SelectField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface Props {
  characterId: string;
  characterName: string;
  inCampaign: boolean;
  /** Nível liberado pelo mestre (campanha). */
  grantedLevel: number;
  permissions: { canEditSheet: boolean; isGm: boolean; isOwner: boolean };
  content: T20Content;
  sheet: T20Sheet;
  version: number;
  resources: CharacterResource[];
  onDone: (result: { sheet: T20Sheet; version: number; resources: CharacterResource[]; abilities: CharacterAbility[] }) => void;
}

/** Botão e painel de subida de nível do Tormenta20. */
export function T20LevelUpButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [granted, setGranted] = useState(props.grantedLevel);
  const [granting, setGranting] = useState(false);
  const { toast } = useToast();
  const level = props.sheet.identity.classes.reduce((sum, entry) => sum + entry.level, 0);
  if (level >= 20 || props.sheet.identity.classes.length === 0) return null;

  // Na campanha, o mestre libera o nível e o jogador escolhe as melhorias.
  if (props.inCampaign) {
    const pending = granted > level;
    if (props.permissions.isGm) {
      const grant = async () => {
        setGranting(true);
        try {
          setGranted(await grantCharacterLevel(getSupabaseBrowserClient(), props.characterId));
          toast({ tone: 'success', title: `Nível ${level + 1} liberado para ${props.characterName}.`, description: 'O jogador escolhe as melhorias na aba Evolução.' });
        } catch (error) {
          toast({ tone: 'danger', title: 'O nível não foi liberado', description: failureMessage(error, 'Tente novamente.') });
        } finally {
          setGranting(false);
        }
      };
      return pending ? (
        <p className="text-sm text-amber-300">Nível {granted} liberado: aguardando o jogador escolher as melhorias.</p>
      ) : (
        <Button icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />} loading={granting} onClick={() => void grant()}>
          Liberar nível {level + 1}
        </Button>
      );
    }
    if (!props.permissions.isOwner) return null;
    if (!pending) return <p className="text-sm text-fg-muted">O mestre libera o próximo nível.</p>;
  } else if (!props.permissions.canEditSheet) {
    return null;
  }
  return (
    <>
      <Button icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />} onClick={() => setOpen(true)}>
        Subir de nível
      </Button>
      {open ? <Panel {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Panel({ characterId, content, sheet, version, resources, onDone, onClose }: Props & { onClose: () => void }) {
  const { toast } = useToast();
  const [classIndex, setClassIndex] = useState(0);
  const [powerId, setPowerId] = useState('');
  const [spellIds, setSpellIds] = useState<string[]>([]);
  const [attribute, setAttribute] = useState<T20Attribute | ''>('');
  const [featureChoices, setFeatureChoices] = useState<Record<string, string>>({});
  const [skills, setSkills] = useState<T20Skill[]>([]);
  const [busy, setBusy] = useState(false);
  const plan = useMemo(() => planT20LevelUp(content, sheet, classIndex), [content, sheet, classIndex]);
  const result = applyT20LevelUp(sheet, plan, { powerId, spellIds, attribute, featureChoices, skills });
  const chosenPower = plan.powerOptions.find((power) => power.id === powerId);
  const skillPick = chosenPower ? t20PowerSkillPick(chosenPower) : null;
  // PV ganhos de verdade (inclui o +1 PV por nível quando a Constituição aumenta).
  const hitPointsGained = result.sheet.hitPoints.max - sheet.hitPoints.max;

  const apply = async () => {
    if (result.issues.length) return;
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const updated: CharacterResource[] = [];
      for (const [key, gain] of [
        [T20_RESOURCE_KEYS.hitPoints, hitPointsGained],
        [T20_RESOURCE_KEYS.manaPoints, plan.manaPointsGained],
      ] as const) {
        const track = resources.find((entry) => entry.key === key);
        if (!track || gain <= 0) continue;
        await adjustCharacterResource(client, track.id, 'set_max', (track.max ?? 0) + gain);
        updated.push(await adjustCharacterResource(client, track.id, 'heal', gain));
      }
      const created: CharacterAbility[] = [];
      for (const entry of result.abilities) {
        created.push(
          await createCharacterAbility(client, characterId, { kind: entry.kind, name: entry.name, source: entry.source, description: entry.description, data: entry.data as CharacterAbility['data'], resourceId: null }),
        );
      }
      // A ficha é salva por último: numa campanha com edição bloqueada, o nível liberado é o que permite criar as habilidades.
      const saved = await saveCharacterSheet(client, characterId, version, { sheet: result.sheet });
      await addCharacterEvent(client, characterId, { kind: 'level_up', summary: result.summary, data: { level: plan.newTotalLevel } });
      toast({ tone: 'success', title: `Nível ${plan.newTotalLevel}!` });
      onDone({
        sheet: result.sheet,
        version: saved.version,
        resources: resources.map((entry) => updated.find((item) => item.id === entry.id) ?? entry),
        abilities: created,
      });
      onClose();
    } catch (error) {
      toast({ tone: 'danger', title: 'A subida de nível não foi concluída', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} busy={busy} size="lg" title={`Nível ${plan.newTotalLevel}: ${plan.classDef?.name ?? 'classe'} ${plan.newClassLevel}`} description="Regras do Tormenta20 e dos livros liberados.">
      {sheet.identity.classes.length > 1 ? (
        <SelectField id="t20-lu-class" label="Classe que sobe" value={String(classIndex)} onChange={(event) => setClassIndex(Number(event.target.value))}>
          {sheet.identity.classes.map((entry, index) => (
            <option key={`${entry.name}-${index}`} value={index}>
              {entry.name} {entry.level} → {entry.level + 1}
            </option>
          ))}
        </SelectField>
      ) : null}
      {!plan.classDef ? <Alert tone="warning">A classe não está nos livros liberados: só PV e PM sobem.</Alert> : null}
      <p className="text-sm text-fg-secondary">
        +{hitPointsGained} PV e +{plan.manaPointsGained} PM.
      </p>
      {plan.tableText ? <p className="text-sm text-fg-secondary">Neste nível (tabela da classe): {plan.tableText}.</p> : null}
      {plan.abilities.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold tracking-wider text-fg-muted uppercase">Habilidades novas</h3>
          {plan.abilities.map((ability) => (
            <details key={ability.name} className="rounded-md border border-line px-3 py-2 text-sm">
              <summary className="cursor-pointer text-fg">{ability.name}</summary>
              <p className="mt-2 whitespace-pre-line text-fg-secondary">{ability.text}</p>
            </details>
          ))}
        </div>
      ) : null}
      {plan.featureChoices.map((choice) => (
        <div key={choice.ability} className="flex flex-col gap-1">
          <SelectField
            id={`t20-lu-feature-${choice.ability}`}
            label={`${choice.ability}: escolha`}
            value={featureChoices[choice.ability] ?? ''}
            onChange={(event) => setFeatureChoices((current) => ({ ...current, [choice.ability]: event.target.value }))}
          >
            <option value="">Escolha</option>
            {choice.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </SelectField>
          {featureChoices[choice.ability] ? (
            <p className="text-xs whitespace-pre-line text-fg-muted">{choice.options.find((option) => option.id === featureChoices[choice.ability])?.text}</p>
          ) : null}
        </div>
      ))}
      {plan.powerChoice ? (
        <div className="flex flex-col gap-1">
          <SelectField id="t20-lu-power" label="Poder do nível" value={powerId} onChange={(event) => {
              setPowerId(event.target.value);
              setSkills([]);
            }}>
            <option value="">Escolha</option>
            {plan.powerOptions.map((power) => (
              <option key={power.id} value={power.id} disabled={power.problems.length > 0}>
                {power.name}
                {power.owners.length ? '' : ` (${power.group})`}
                {power.problems.length ? ` — falta ${power.problems.join(', ')}` : ''}
              </option>
            ))}
          </SelectField>
          {powerId ? <p className="text-xs whitespace-pre-line text-fg-muted">{chosenPower?.text}</p> : null}
          {skillPick ? (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium">
                Perícias ({skills.length}/{skillPick.count})
              </legend>
              <div className="grid max-h-60 gap-1 overflow-y-auto sm:grid-cols-2">
                {T20_SKILL_IDS.map((skill) => {
                  const trained = sheet.skills.trained.includes(skill);
                  const blocked = skillPick.trains && trained;
                  return (
                    <CheckboxField
                      key={skill}
                      id={`t20-lu-skill-${skill}`}
                      label={`${T20_SKILLS[skill].label}${blocked ? ' (já treinada)' : ''}`}
                      checked={skills.includes(skill)}
                      disabled={blocked || (!skills.includes(skill) && skills.length >= skillPick.count)}
                      onChange={() => setSkills((current) => (current.includes(skill) ? current.filter((entry) => entry !== skill) : [...current, skill]))}
                    />
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          {chosenPower && isT20AttributeIncrease(chosenPower.name) ? (
            <SelectField id="t20-lu-attribute" label="Atributo que aumenta (+1)" value={attribute} onChange={(event) => setAttribute(event.target.value as T20Attribute | '')}>
              <option value="">Escolha</option>
              {T20_ATTRIBUTES.map((key) => (
                <option key={key} value={key} disabled={plan.blockedAttributes.includes(key)}>
                  {t20AttributeLabels[key].name} ({sheet.attributes[key] >= 0 ? '+' : ''}
                  {sheet.attributes[key]} → {sheet.attributes[key] + 1 >= 0 ? '+' : ''}
                  {sheet.attributes[key] + 1}){plan.blockedAttributes.includes(key) ? ' — já aumentado neste patamar' : ''}
                </option>
              ))}
            </SelectField>
          ) : null}
        </div>
      ) : null}
      {plan.newSpells > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">
            Magias novas ({spellIds.length}/{plan.newSpells})
          </legend>
          <div className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
            {plan.spellOptions.map((spell) => (
              <CheckboxField
                key={spell.id}
                id={`t20-lu-spell-${spell.id}`}
                label={`${spell.name} · ${spell.circle}º`}
                checked={spellIds.includes(spell.id)}
                disabled={!spellIds.includes(spell.id) && spellIds.length >= plan.newSpells}
                onChange={() => setSpellIds((current) => (current.includes(spell.id) ? current.filter((id) => id !== spell.id) : [...current, spell.id]))}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
      {result.issues.length ? <Alert tone="warning">{result.issues.join(' ')}</Alert> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button loading={busy} disabled={result.issues.length > 0} onClick={() => void apply()}>
          Aplicar nível {plan.newTotalLevel}
        </Button>
      </div>
    </Modal>
  );
}
