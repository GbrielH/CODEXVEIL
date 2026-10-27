'use client';

import {
  createCharacterAbility,
  createCharacterItem,
  saveCharacterSheet,
  updateCharacterAbility,
  type CharacterAbility,
  type CharacterItem,
} from '@codexveil/database';
import {
  applyT20Grant,
  applyT20ItemGrant,
  applyT20LabelGrant,
  t20PriceValue,
  type T20Grant,
  type T20ItemGrant,
  type T20LabelGrant,
  type T20Sheet,
} from '@codexveil/rpg-systems/tormenta20';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface Props {
  characterId: string;
  sheet: T20Sheet;
  version: number;
  grants: T20Grant[];
  itemGrants: T20ItemGrant[];
  labelGrants: T20LabelGrant[];
  /** Linhas da lista de habilidades (para renomear a que recebe a escolha). */
  abilities: CharacterAbility[];
  onAbilityUpdated: (updated: CharacterAbility) => void;
  onSheet: (sheet: T20Sheet, version: number) => void;
  onAbilities: (created: CharacterAbility[]) => void;
  onItems: (created: CharacterItem[]) => void;
}

/**
 * Escolhas que a raça, os poderes ou as habilidades concedem e a ficha ainda não tem ("escolha uma
 * magia de 1º círculo", "um poder geral", os itens do Protótipo…): o seletor aparece aqui, no topo.
 */
export function T20GrantsCard(props: Props) {
  if (props.grants.length === 0 && props.itemGrants.length === 0 && props.labelGrants.length === 0)
    return null;
  return (
    <Card ornate>
      <CardHeader
        icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
        title="Escolhas pendentes"
        description="Habilidades e poderes da ficha que pedem uma escolha. Escolha e confirme para entrarem na ficha."
      />
      <div className="flex flex-col gap-5">
        {props.grants.map((grant) => (
          <ListGrant key={grant.source} grant={grant} {...props} />
        ))}
        {props.itemGrants.map((grant) => (
          <ItemGrant key={grant.source} grant={grant} {...props} />
        ))}
        {props.labelGrants.map((grant) => (
          <LabelGrant key={grant.abilityId} grant={grant} {...props} />
        ))}
      </div>
    </Card>
  );
}

function ListGrant({
  grant,
  characterId,
  sheet,
  version,
  onSheet,
  onAbilities,
}: Props & { grant: T20Grant }) {
  const { toast } = useToast();
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const options = grant.options.filter((option) =>
    option.name.toLowerCase().includes(filter.toLowerCase()),
  );

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : grant.missing === 1
          ? [id]
          : current.length < grant.missing
            ? [...current, id]
            : current,
    );

  const confirm = async () => {
    const result = applyT20Grant(sheet, grant, picked);
    if ('error' in result) return toast({ tone: 'danger', title: result.error });
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      const created: CharacterAbility[] = [];
      for (const entry of result.abilities)
        created.push(
          await createCharacterAbility(client, characterId, {
            kind: entry.kind,
            name: entry.name,
            source: entry.source,
            description: entry.description,
            data: entry.data as CharacterAbility['data'],
            resourceId: null,
          }),
        );
      const saved = await saveCharacterSheet(client, characterId, version, { sheet: result.sheet });
      onSheet(result.sheet, saved.version);
      onAbilities(created);
      toast({ tone: 'success', title: 'Escolha gravada na ficha.' });
    } catch (cause) {
      toast({ tone: 'danger', title: failureMessage(cause, 'A escolha não foi salva.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-2 rounded-md border border-line p-3">
      <h3 className="text-sm font-semibold text-fg">{grant.title}</h3>
      {grant.options.length > 8 ? (
        <input
          aria-label="Filtrar"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filtrar pelo nome…"
          className="h-9 rounded-md border border-line bg-sunken px-3 text-sm text-fg"
        />
      ) : null}
      {grant.options.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhuma opção disponível nos livros desta ficha.</p>
      ) : (
        <ul className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
          {options.map((option) => (
            <li key={option.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-fg hover:bg-hover">
                <input
                  type={grant.missing === 1 ? 'radio' : 'checkbox'}
                  checked={picked.includes(option.id)}
                  onChange={() => toggle(option.id)}
                />
                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                {'circle' in option ? (
                  <span className="text-xs text-fg-muted">{option.circle}º</span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          loading={busy}
          disabled={picked.length !== grant.missing}
          onClick={() => void confirm()}
        >
          Confirmar
        </Button>
        <span className="text-xs text-fg-muted">
          {picked.length} de {grant.missing}
        </span>
      </div>
    </section>
  );
}

function ItemGrant({ grant, characterId, onItems }: Props & { grant: T20ItemGrant }) {
  const { toast } = useToast();
  const [baseId, setBaseId] = useState('');
  const [upgradeId, setUpgradeId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const count = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const price = grant.options.reduce(
    (sum, item) => sum + t20PriceValue(item.price) * (quantities[item.id] ?? 0),
    0,
  );

  const confirm = async () => {
    const result = applyT20ItemGrant(grant, { baseId, upgradeId, quantities });
    if ('error' in result) return toast({ tone: 'danger', title: result.error });
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      const created: CharacterItem[] = [];
      for (const item of result.items)
        created.push(
          await createCharacterItem(client, characterId, {
            ...item,
            weight: null,
            isEquipped: false,
          }),
        );
      onItems(created);
      toast({ tone: 'success', title: 'Itens do Protótipo no inventário.' });
    } catch (cause) {
      toast({ tone: 'danger', title: failureMessage(cause, 'Os itens não foram salvos.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-2 rounded-md border border-line p-3">
      <h3 className="text-sm font-semibold text-fg">{grant.title}</h3>
      {grant.mode === 'superior' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            size="sm"
            aria-label="Item"
            value={baseId}
            onChange={(event) => setBaseId(event.target.value)}
          >
            <option value="">Item…</option>
            {grant.options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.price})
              </option>
            ))}
          </Select>
          <Select
            size="sm"
            aria-label="Melhoria"
            value={upgradeId}
            onChange={(event) => setUpgradeId(event.target.value)}
          >
            <option value="">Melhoria…</option>
            {grant.upgrades.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <ul className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
          {grant.options.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-2 py-1 text-sm text-fg">
              <span className="min-w-0 flex-1 truncate">
                {item.name} <span className="text-xs text-fg-muted">{item.price}</span>
              </span>
              <input
                type="number"
                min={0}
                max={10}
                aria-label={`Quantidade de ${item.name}`}
                value={quantities[item.id] ?? 0}
                onChange={(event) =>
                  setQuantities({
                    ...quantities,
                    [item.id]: Math.max(0, Math.min(10, Number(event.target.value) || 0)),
                  })
                }
                className="h-8 w-16 rounded border border-line bg-sunken px-2 text-right text-sm"
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button size="sm" loading={busy} onClick={() => void confirm()}>
          Confirmar
        </Button>
        {grant.mode === 'alquimicos' ? (
          <span
            className={`text-xs ${count === 10 && (grant.budget === null || price <= grant.budget) ? 'text-fg-muted' : 'text-warning'}`}
          >
            {count} de 10 itens · T$ {price} de T$ {grant.budget}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function LabelGrant({
  grant,
  characterId,
  sheet,
  version,
  abilities,
  onSheet,
  onAbilities,
  onAbilityUpdated,
}: Props & { grant: T20LabelGrant }) {
  const { toast } = useToast();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : grant.count === 1
          ? [id]
          : current.length < grant.count
            ? [...current, id]
            : current,
    );

  const confirm = async () => {
    const ability = abilities.find((entry) => entry.id === grant.abilityId);
    if (!ability) return;
    const result = applyT20LabelGrant(sheet, grant, picked, ability.name);
    if ('error' in result) return toast({ tone: 'danger', title: result.error });
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      const updated = await updateCharacterAbility(client, ability.id, {
        name: result.name,
        source: ability.source,
        description: ability.description,
        data: ability.data,
        resourceId: ability.resourceId,
      });
      onAbilityUpdated(updated);
      // Osteon que trocou a perícia por um poder: o poder entra na lista de habilidades.
      const created: CharacterAbility[] = [];
      for (const entry of result.abilities)
        created.push(
          await createCharacterAbility(client, characterId, {
            kind: entry.kind,
            name: entry.name,
            source: entry.source,
            description: entry.description,
            data: entry.data as CharacterAbility['data'],
            resourceId: null,
          }),
        );
      if (created.length) onAbilities(created);
      if (JSON.stringify(result.sheet) !== JSON.stringify(sheet)) {
        const saved = await saveCharacterSheet(client, characterId, version, {
          sheet: result.sheet,
        });
        onSheet(result.sheet, saved.version);
      }
      toast({ tone: 'success', title: 'Escolha gravada na ficha.' });
    } catch (cause) {
      toast({ tone: 'danger', title: failureMessage(cause, 'A escolha não foi salva.') });
    } finally {
      setBusy(false);
    }
  };

  const many = grant.options.length > 12;
  return (
    <section className="flex flex-col gap-2 rounded-md border border-line p-3">
      <h3 className="text-sm font-semibold text-fg">{grant.title}</h3>
      {grant.effect ? (
        <p className="text-xs text-fg-muted">
          {grant.effect === 'train'
            ? 'As perícias escolhidas ficam treinadas.'
            : 'As perícias escolhidas recebem +2.'}
        </p>
      ) : null}
      {many && grant.count === 1 ? (
        <Select
          size="sm"
          aria-label={grant.title}
          value={picked[0] ?? ''}
          onChange={(event) => setPicked(event.target.value ? [event.target.value] : [])}
          className="min-w-40"
        >
          <option value="">Escolha…</option>
          {grant.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      ) : (
        <ul className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-3">
          {grant.options.map((option) => (
            <li key={option.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-fg hover:bg-hover">
                <input
                  type={grant.count === 1 ? 'radio' : 'checkbox'}
                  checked={picked.includes(option.id)}
                  onChange={() => toggle(option.id)}
                />
                {option.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          loading={busy}
          disabled={picked.length !== grant.count}
          onClick={() => void confirm()}
        >
          Confirmar
        </Button>
        <span className="text-xs text-fg-muted">
          {picked.length} de {grant.count}
        </span>
      </div>
    </section>
  );
}
