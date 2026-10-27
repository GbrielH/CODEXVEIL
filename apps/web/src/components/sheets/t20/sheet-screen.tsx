'use client';

import { PendingUpdatesModal } from '../pending-updates-modal';
import {
  adjustCharacterResource,
  applyCharacterCondition,
  removeCharacterCondition,
  tickCharacterConditions,
  getCampaignTurn,
  performTurnAction,
  saveCharacterSheet,
  updateCharacterAbility,
  type CharacterAbility,
  type CharacterCondition,
  type CharacterItem,
  type CharacterResource,
} from '@codexveil/database';
import { characterImagePrompt, characterTokenPrompt, rollDiceLocally, type DiceRollMode, type TrackOperation } from '@codexveil/domain';
import {
  T20_ATTRIBUTES,
  T20_RESOURCE_KEYS,
  T20_REST_QUALITY,
  buildT20Content,
  listT20PendingUpdates,
  computeT20Derived,
  t20DefenseFromItems,
  findT20Condition,
  formatT20Bonus,
  t20AttributeLabels,
  t20Conditions,
  t20RestRecovery,
  t20SizeLabels,
  t20TierLabels,
  type T20ContentSource,
  type T20RestQuality,
  type T20Sheet,
  t20AbilityCost,
  t20AbilityChoiceNames,
  t20CampaignIssues,
  parseT20CampaignRules,
} from '@codexveil/rpg-systems/tormenta20';
import { Heart, Minus, Moon, Pencil, Plus, Shield, Sparkles, X, Zap } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArcaneScene } from '@/components/brand/arcane-scene';
import { CampaignLinkCard, type LinkCampaignOption } from '@/components/characters/campaign-link-card';
import { ImagePromptCard } from '@/components/characters/image-prompt-card';
import { PortraitCard } from '@/components/characters/portrait-card';
import { TokenImageCard } from '@/components/characters/token-image-card';
import { T20AbilityEditor, type T20AbilityEditing } from './ability-editor';
import { T20AttacksCard } from './attacks-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { TextareaField, TextField } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { DiceProvider, useDice } from '@/components/dice/dice-roller';
import { DeleteCharacterCard } from '@/components/characters/delete-character';
import { T20Inventory } from './inventory';
import { T20TurnCard } from './turn-card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { T20LevelUpButton } from './level-up';

interface T20SheetScreenProps {
  /** Compartilhar com amigos: só na aba Personagem (o dono). */
  shareCard?: ReactNode;
  /** Campanhas de Tormenta20 em que o dono joga (vincular na aba Personagem). */
  campaigns?: LinkCampaignOption[];
  character: {
    id: string;
    name: string;
    ownerName: string;
    version: number;
    portraitUrl: string | null;
    campaign: { id: string; name: string } | null;
    grantedLevel: number;
    portraitPath: string | null;
  };
  sheet: T20Sheet;
  resources: CharacterResource[];
  conditions: CharacterCondition[];
  items: CharacterItem[];
  abilities: CharacterAbility[];
  permissions: { canEditSheet: boolean; canEditPlay: boolean; isGm: boolean; isOwner: boolean };
  /** Livros T20 da campanha (ou do dono), para a subida de nível. */
  sources?: T20ContentSource[];
  /** Na campanha, as rolagens vão para o mural e só valem com a sessão em andamento. */
  variant?: 'full' | 'campaign';
}

const ABILITY_GROUPS: { kind: CharacterAbility['kind']; title: string }[] = [
  { kind: 'class_feature', title: 'Habilidades de classe' },
  { kind: 'species_trait', title: 'Habilidades de raça' },
  { kind: 'background_feature', title: 'Origem' },
  { kind: 'feat', title: 'Poderes' },
];

/** Ficha do Tormenta20: vida e mana, testes, poderes, magias, inventário, condições e história. */
export function T20SheetScreen(props: T20SheetScreenProps) {
  // Mesmo rolador do D&D: dado animado na tela e, na campanha, rolagem no mural da mesa.
  return (
    <DiceProvider
      campaignId={props.variant === 'campaign' ? (props.character.campaign?.id ?? null) : null}
      characterId={props.character.id}
      enabled={props.permissions.canEditPlay}
      sessionGate={props.variant === 'campaign'}
    >
      <T20SheetBody {...props} />
    </DiceProvider>
  );
}

/** Registra o uso nas ações do turno, quando é a vez do personagem (silencioso fora dela). */
async function logTurnUse(campaignId: string, characterId: string, label: string) {
  try {
    const client = getSupabaseBrowserClient();
    const turn = await getCampaignTurn(client, campaignId);
    const me = turn?.order.find((entry) => entry.characterId === characterId);
    if (!turn || !me || turn.status !== 'active' || turn.activeCharacterId !== characterId) return;
    await performTurnAction(client, {
      combatantId: me.id,
      kind: 'free',
      label,
      targetCombatantId: null,
      grantsAction: false,
      rollExpression: null,
      manualTotal: null,
    });
  } catch {
    // Fora da vez ou sem sessão: o uso fica só na ficha.
  }
}

function T20SheetBody(props: T20SheetScreenProps) {
  const dice = useDice();
  const diceRoller = dice;
  const { character, permissions } = props;
  const { toast } = useToast();
  // Vindo do "Vincular" da campanha (?vincular=…): abre na aba Personagem, com a campanha escolhida.
  const linkTo = useSearchParams().get('vincular');
  const [tab, setTab] = useState(linkTo ? 'personagem' : 'jogo');
  // Seletor de três estados para as rolagens de d20: desvantagem, normal ou vantagem.
  const [rollMode, setRollMode] = useState<DiceRollMode>('normal');
  const [sheet, setSheet] = useState(props.sheet);
  const [version, setVersion] = useState(character.version);
  const [resources, setResources] = useState(props.resources);
  const [conditions, setConditions] = useState(props.conditions);
  const [items, setItems] = useState(props.items);
  const [abilities, setAbilities] = useState(props.abilities);
  // Cadastro manual de habilidades, poderes e magias (aba Poderes e magias).
  const [editing, setEditing] = useState<T20AbilityEditing>(null);
  const content = useMemo(() => buildT20Content(props.sources ?? []), [props.sources]);
  // Habilidades do nível que faltam na ficha (livro corrigido depois da criação…).
  const pendingUpdates = useMemo(
    () =>
      listT20PendingUpdates(
        content,
        sheet,
        abilities.map((ability) => ability.name),
      ),
    [content, sheet, abilities],
  );

  // Defesa automática: armadura e escudo equipados no inventário (grava na ficha ao mudar).
  const gearDefense = useMemo(() => t20DefenseFromItems(items), [items]);
  const effectiveSheet = useMemo(
    () =>
      gearDefense ? { ...sheet, defense: { ...gearDefense, other: sheet.defense.other } } : sheet,
    [sheet, gearDefense],
  );
  const defenseKey = gearDefense
    ? JSON.stringify({ ...gearDefense, other: sheet.defense.other })
    : null;
  useEffect(() => {
    if (!defenseKey || !permissions.canEditSheet || JSON.stringify(sheet.defense) === defenseKey)
      return;
    const next = { ...sheet, defense: JSON.parse(defenseKey) as typeof sheet.defense };
    saveCharacterSheet(getSupabaseBrowserClient(), character.id, version, { sheet: next })
      .then((saved) => {
        setSheet(next);
        setVersion(saved.version);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- grava só quando o equipamento muda a Defesa.
  }, [defenseKey]);
  const derived = useMemo(
    () =>
      computeT20Derived(
        effectiveSheet,
        conditions.map((condition) => condition.key),
      ),
    [effectiveSheet, conditions],
  );
  const resource = (key: string) => resources.find((entry) => entry.key === key);

  const run = async <T,>(action: () => Promise<T>, failure: string): Promise<T | null> => {
    try {
      return await action();
    } catch (error) {
      toast({
        tone: 'danger',
        title: failure,
        description: failureMessage(error, 'Tente novamente.'),
      });
      return null;
    }
  };

  const adjust = async (key: string, operation: TrackOperation, amount: number) => {
    const track = resource(key);
    // `set_temp` aceita 0 (tira os temporários); as demais operações precisam de valor positivo.
    if (!track || !permissions.canEditPlay || amount < 0 || (amount === 0 && operation !== 'set_temp')) return;
    const saved = await run(
      () => adjustCharacterResource(getSupabaseBrowserClient(), track.id, operation, amount),
      'Não foi possível atualizar',
    );
    if (saved)
      setResources((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
  };

  const roll = (label: string, bonus: number) => {
    const expression = `1d20${bonus >= 0 ? '+' : ''}${bonus}`;
    // Dados físicos: o jogador rola na mesa; a ficha só diz que dado rolar.
    if (dice?.physical) {
      toast({
        tone: 'info',
        title: `${label}: role ${rollMode === 'normal' ? '1d20' : '2d20 (' + (rollMode === 'advantage' ? 'maior' : 'menor') + ')'} ${formatT20Bonus(bonus)} na mesa`,
      });
      return;
    }
    if (dice) {
      void dice.roll({ expression, label, mode: rollMode });
      return;
    }
    const result = rollDiceLocally(expression, rollMode);
    if (result)
      toast({
        tone: 'info',
        title: `${label}: ${result.total}`,
        description: `1d20 (${result.total - bonus}) ${formatT20Bonus(bonus)}`,
      });
  };

  /** Usar um poder ou lançar uma magia na jogada: gasta os PM (se houver custo) e avisa a mesa. */
  // Habilidade de classe com escolha que entrou sem ela (fichas antigas, ex.: Protótipo do
  // Inventor): as opções do livro aparecem na ficha; escolher grava "Protótipo (item superior)".
  const plain = (text: string) =>
    text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const pendingChoices = (ability: CharacterAbility): string[] => {
    if (ability.name.includes('(')) return [];
    for (const klass of content.classes) {
      const source = klass.abilities.find((entry) => plain(entry.name) === plain(ability.name));
      const options = source ? t20AbilityChoiceNames(source) : [];
      if (options.length > 1) return options.map((option) => option.charAt(0).toUpperCase() + option.slice(1));
    }
    return [];
  };
  const chooseOption = (ability: CharacterAbility, option: string) => {
    void (async () => {
      const saved = await run(
        () =>
          updateCharacterAbility(getSupabaseBrowserClient(), ability.id, {
            name: `${ability.name} (${option})`.slice(0, 120),
            source: ability.source,
            description: ability.description,
            data: ability.data,
            resourceId: ability.resourceId,
          }),
        'A escolha não foi salva',
      );
      if (saved) setAbilities((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    })();
  };

  const activateAbility = (ability: CharacterAbility) => {
    const cost = t20AbilityCost(ability);
    const pmTrack = resource(T20_RESOURCE_KEYS.manaPoints);
    if (cost > 0 && pmTrack && pmTrack.current < cost) {
      toast({ tone: 'warning', title: `PM insuficientes para ${ability.name} (${cost} PM).` });
      return;
    }
    if (cost > 0) void adjust(T20_RESOURCE_KEYS.manaPoints, 'spend', cost);
    const label = `${ability.kind === 'spell' ? 'Lançou' : 'Usou'}: ${ability.name}`;
    // Mural da mesa: com dado no texto (ex.: "2d8"), a rolagem vai para o mural; na vez do
    // personagem, o uso também entra nas ações do turno.
    const dice = /\b\d{0,2}d\d{1,3}(?:\s*[+-]\s*\d+)?\b/i
      .exec(ability.description ?? '')?.[0]
      ?.replace(/\s+/g, '');
    if (dice && diceRoller) void diceRoller.roll({ expression: dice, label });
    else
      toast({ tone: 'success', title: label, description: cost > 0 ? `−${cost} PM` : undefined });
    if (character.campaign) void logTurnUse(character.campaign.id, character.id, label);
  };

  const hp = resource(T20_RESOURCE_KEYS.hitPoints);
  const pm = resource(T20_RESOURCE_KEYS.manaPoints);
  const money = resource(T20_RESOURCE_KEYS.money);
  const klass = sheet.identity.classes.map((entry) => `${entry.name} ${entry.level}`).join(' / ');

  // Dados da ficha para os prompts de imagem (retrato e token).
  const imageInput = {
    system: 'Tormenta20',
    name: character.name,
    species: [sheet.identity.race, sheet.identity.raceVariant].filter(Boolean).join(' '),
    className: sheet.identity.classes.map((entry) => entry.name).join(' / '),
    level: sheet.identity.classes.reduce((total, entry) => total + entry.level, 0),
    background: [sheet.identity.origin, sheet.identity.deity ? `devoto de ${sheet.identity.deity}` : ''].filter(Boolean).join(', '),
    age: sheet.identity.age,
    appearance: sheet.identity.appearance,
    personality: sheet.identity.personality,
    backstory: sheet.identity.history,
  };

  return (
    <div className="flex flex-col gap-6">
      <PendingUpdatesModal
        characterId={character.id}
        enabled={permissions.isOwner && permissions.canEditSheet && content.classes.length > 0}
        updates={pendingUpdates}
        onCreated={(created) => setAbilities((current) => [...current, ...created])}
      />
      {/* Cabeçalho (redesign "Grimório Arcano"): paisagem do personagem, retrato, PV/PM e atributos. */}
      <header className="relative isolate overflow-hidden rounded-2xl border border-line p-5 shadow-[0_24px_60px_-36px_rgb(107_59_198/0.9)] sm:p-6">
        <ArcaneScene seed={character.name || character.id} className="absolute inset-0 -z-10 opacity-60" options={{ noMoon: true }} />
        <span className="absolute inset-0 -z-10 bg-gradient-to-r from-charcoal-950 via-charcoal-950/85 to-charcoal-950/60" aria-hidden="true" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {character.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage
            <img
              src={character.portraitUrl}
              alt=""
              className="h-28 w-28 rounded-t-[999px] rounded-b-md object-cover ring-2 ring-wine-400/60 ring-offset-2 ring-offset-charcoal-950"
            />
          ) : null}
          <div className="flex flex-1 flex-col gap-1">
            <p className="eyebrow text-wine-300">Tormenta20 · Nível {derived.level} · {t20TierLabels[derived.tier]}</p>
            <h1 className="text-3xl leading-tight [text-shadow:0_2px_16px_rgb(0_0_0/0.8)] sm:text-4xl">{character.name}</h1>
            <p className="text-fg-secondary">
              {[
                sheet.identity.race,
                klass,
                sheet.identity.origin,
                sheet.identity.deity ? `devoto de ${sheet.identity.deity}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="text-xs text-fg-muted">
              Jogador: {character.ownerName}
              {character.campaign ? ` · Campanha: ${character.campaign.name}` : ' · Ficha pessoal'}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <Stat
            icon={<Shield className="h-4 w-4" aria-hidden="true" />}
            label="Defesa"
            value={String(derived.defense)}
          />
          <Stat
            label="Iniciativa"
            value={formatT20Bonus(derived.initiative)}
            onClick={() => roll('Iniciativa', derived.initiative)}
          />
          <Stat label="Deslocamento" value={`${String(derived.speed).replace('.', ',')} m`} />
          <Stat label="Tamanho" value={t20SizeLabels[sheet.identity.size]} />
          <Stat
            label="CD de magias"
            value={derived.spellDc === null ? '—' : String(derived.spellDc)}
          />
          <Stat label="Limite de PM" value={String(derived.manaLimit)} />
        </div>
        {/* PV e PM em barras */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { label: 'Pontos de vida', track: hp, color: 'bg-emerald-400', low: 'bg-red-500' },
            { label: 'Pontos de mana', track: pm, color: 'bg-sky-400', low: 'bg-sky-700' },
          ].map(({ label, track, color, low }) => {
            const max = track?.max ?? 0;
            const percent = max > 0 ? Math.max(0, Math.min(100, Math.round(((track?.current ?? 0) / max) * 100))) : 0;
            return (
              <div key={label} className="flex flex-col gap-1.5 rounded-xl border border-line bg-charcoal-950/60 px-4 py-2.5 backdrop-blur">
                <span className="flex justify-between text-[10px] tracking-wider text-fg-muted uppercase">
                  {label}
                  {track?.temp ? <span className="text-sky-300">+{track.temp} temporários</span> : null}
                </span>
                <span className="tabular font-display text-2xl leading-none text-fg-accent">
                  {track?.current ?? '—'}
                  <span className="text-base text-fg-muted"> / {max || '—'}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-charcoal-700" aria-hidden="true">
                  <span className={`block h-full rounded-full ${percent > 25 ? color : low}`} style={{ width: `${percent}%` }} />
                </span>
              </div>
            );
          })}
        </div>
        {/* Atributos: clicar rola o teste */}
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Atributos">
          {T20_ATTRIBUTES.map((key) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => roll(t20AttributeLabels[key].name, derived.attributes[key])}
                title={`Rolar ${t20AttributeLabels[key].name}`}
                className="flex w-full flex-col items-center rounded-xl border border-wine-400/25 bg-wine-950/70 px-2 py-2 backdrop-blur transition-colors hover:border-wine-400/60"
              >
                <span className="text-[10px] tracking-[0.2em] text-wine-300 uppercase">{t20AttributeLabels[key].abbreviation}</span>
                <span className="tabular font-display text-2xl leading-tight text-fg-accent">{formatT20Bonus(derived.attributes[key])}</span>
              </button>
            </li>
          ))}
        </ul>
      </header>

      <Tabs
        label="Seções da ficha"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'jogo', label: 'Jogo', content: null },
          { value: 'pericias', label: 'Atributos e perícias', content: null },
          { value: 'poderes', label: 'Poderes e magias', content: null },
          { value: 'inventario', label: 'Inventário', content: null },
          { value: 'personagem', label: 'Personagem', content: null },
          { value: 'evolucao', label: 'Evolução', content: null },
        ]}
      />

      {tab === 'jogo' && character.campaign ? (
        <T20TurnCard
          campaignId={character.campaign.id}
          characterId={character.id}
          canAct={permissions.canEditPlay}
          onConditionsEnded={(ended) =>
            setConditions((current) =>
              current
                .filter((entry) => !ended.includes(entry.key))
                .map((entry) =>
                  entry.roundsRemaining !== null
                    ? { ...entry, roundsRemaining: Math.max(0, entry.roundsRemaining - 1) }
                    : entry,
                ),
            )
          }
        />
      ) : null}

      {tab === 'jogo' ? (
        <T20AttacksCard
          characterId={character.id}
          sheet={effectiveSheet}
          derived={derived}
          items={items}
          content={content}
          mode={rollMode}
          canAct={permissions.canEditPlay}
        />
      ) : null}

      {tab === 'jogo' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <TrackCard
            title="Pontos de Vida"
            icon={<Heart className="h-5 w-5" aria-hidden="true" />}
            track={hp}
            canEdit={permissions.canEditPlay}
            minus="Dano"
            plus="Cura"
            onMinus={(n) => adjust(T20_RESOURCE_KEYS.hitPoints, 'damage', n)}
            onPlus={(n) => adjust(T20_RESOURCE_KEYS.hitPoints, 'heal', n)}
            onSetTemp={(n) => adjust(T20_RESOURCE_KEYS.hitPoints, 'set_temp', n)}
            barClass="bg-emerald-500"
            lowBarClass="bg-red-500"
          />
          <TrackCard
            title="Pontos de Mana"
            icon={<Zap className="h-5 w-5" aria-hidden="true" />}
            track={pm}
            canEdit={permissions.canEditPlay}
            minus="Gastar"
            plus="Recuperar"
            onMinus={(n) => adjust(T20_RESOURCE_KEYS.manaPoints, 'spend', n)}
            onPlus={(n) => adjust(T20_RESOURCE_KEYS.manaPoints, 'heal', n)}
            barClass="bg-sky-500"
          />
          <RestCard
            level={derived.level}
            canEdit={permissions.canEditPlay}
            onRest={async (amount) => {
              await adjust(T20_RESOURCE_KEYS.hitPoints, 'heal', amount);
              await adjust(T20_RESOURCE_KEYS.manaPoints, 'heal', amount);
              toast({ tone: 'success', title: `Descanso: +${amount} PV e +${amount} PM.` });
            }}
          />
          <ConditionsCard
            conditions={conditions}
            canEdit={permissions.canEditPlay}
            onApply={async (key, rounds) => {
              const ok = await run(
                () =>
                  applyCharacterCondition(
                    getSupabaseBrowserClient(),
                    character.id,
                    key,
                    null,
                    rounds,
                  ),
                'Não foi possível aplicar a condição',
              );
              if (ok !== null)
                setConditions((current) =>
                  current.some((entry) => entry.key === key)
                    ? current
                    : [
                        ...current,
                        { id: `local-${key}`, key, level: null, note: '', roundsRemaining: rounds },
                      ],
                );
            }}
            onTick={async () => {
              const ended = await run(
                () => tickCharacterConditions(getSupabaseBrowserClient(), character.id),
                'Não foi possível passar a rodada',
              );
              if (ended === null) return;
              setConditions((current) =>
                current
                  .filter((entry) => !ended.includes(entry.key))
                  .map((entry) =>
                    entry.roundsRemaining !== null
                      ? { ...entry, roundsRemaining: Math.max(0, entry.roundsRemaining - 1) }
                      : entry,
                  ),
              );
              if (ended.length)
                toast({
                  tone: 'info',
                  title: `Terminou: ${ended.map((key) => findT20Condition(key)?.label ?? key).join(', ')}.`,
                });
            }}
            onRemove={async (condition) => {
              const ok = await run(
                () => removeCharacterCondition(getSupabaseBrowserClient(), condition.id),
                'Não foi possível remover a condição',
              );
              if (ok !== null)
                setConditions((current) => current.filter((entry) => entry.id !== condition.id));
            }}
          />
          <TrackCard
            title="Tibares"
            track={money}
            prefix="T$ "
            showBar={false}
            canEdit={permissions.canEditPlay}
            minus="Gastar"
            plus="Receber"
            onMinus={(n) => adjust(T20_RESOURCE_KEYS.money, 'spend', n)}
            onPlus={(n) => adjust(T20_RESOURCE_KEYS.money, 'set_current', (money?.current ?? 0) + n)}
          />
        </div>
      ) : null}

      {tab === 'pericias' ? (
        <div
          className="flex flex-wrap items-center gap-2"
          role="radiogroup"
          aria-label="Modo da rolagem"
        >
          <span className="text-sm text-fg-muted">Rolagem:</span>
          {(
            [
              ['disadvantage', 'Desvantagem'],
              ['normal', 'Normal'],
              ['advantage', 'Vantagem'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={rollMode === mode}
              onClick={() => setRollMode(mode)}
              className={
                rollMode === mode
                  ? mode === 'advantage'
                    ? 'rounded-full border border-verdigris-300/70 bg-verdigris-900/60 px-3 py-1 text-sm text-verdigris-300'
                    : mode === 'disadvantage'
                      ? 'rounded-full border border-ember-300/70 bg-ember-900/60 px-3 py-1 text-sm text-ember-300'
                      : 'rounded-full border border-parchment-300/70 bg-parchment-200/10 px-3 py-1 text-sm text-fg-accent'
                  : 'rounded-full border border-line px-3 py-1 text-sm text-fg-secondary hover:bg-hover'
              }
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-fg-subtle">
            Rola 2d20 e fica com o maior (vantagem) ou o menor (desvantagem).
          </span>
        </div>
      ) : null}

      {tab === 'pericias' ? (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <Card>
            <CardHeader title="Atributos" />
            <ul className="grid grid-cols-2 gap-2">
              {T20_ATTRIBUTES.map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => roll(t20AttributeLabels[key].name, derived.attributes[key])}
                    className="flex w-full flex-col items-center rounded-md border border-line py-2 hover:bg-hover"
                  >
                    <span className="text-xs tracking-wider text-fg-subtle uppercase">
                      {t20AttributeLabels[key].abbreviation}
                    </span>
                    <span className="font-display text-2xl text-fg">
                      {formatT20Bonus(derived.attributes[key])}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-fg-muted">
              Clique para rolar 1d20 + atributo. Treinamento +{derived.trainingBonus}; metade do
              nível +{derived.halfLevel}.
            </p>
          </Card>
          <Card>
            <CardHeader
              title="Perícias"
              description="Clique para rolar. Perícias marcadas com * só podem ser usadas por quem é treinado."
            />
            <ul className="grid gap-1 sm:grid-cols-2">
              {Object.values(derived.skills).map((skill) => (
                <li key={skill.skill}>
                  <button
                    type="button"
                    disabled={!skill.usable}
                    onClick={() => roll(skill.label, skill.total)}
                    className={cx(
                      'flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm hover:bg-hover disabled:opacity-50',
                      skill.trained && 'text-fg-accent',
                    )}
                  >
                    <span>
                      {skill.trained ? '● ' : '○ '}
                      {skill.label}
                      {skill.usable ? '' : ' *'}{' '}
                      <span className="text-xs text-fg-subtle">
                        ({t20AttributeLabels[skill.attribute].abbreviation})
                      </span>
                    </span>
                    <span className="tabular">{formatT20Bonus(skill.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === 'poderes' ? (
        <div className="flex flex-col gap-6">
          {permissions.canEditSheet ? (
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setEditing({ entry: null, kind: 'feat' })}>
                Adicionar habilidade, poder ou magia
              </Button>
            </div>
          ) : null}
          <T20AbilityEditor
            characterId={character.id}
            state={editing}
            onClose={() => setEditing(null)}
            onSaved={(saved, isNew) => setAbilities((current) => (isNew ? [...current, saved] : current.map((entry) => (entry.id === saved.id ? saved : entry))))}
            onDeleted={(abilityId) => setAbilities((current) => current.filter((entry) => entry.id !== abilityId))}
          />
          {ABILITY_GROUPS.map((group) => {
            const list = abilities.filter((ability) => ability.kind === group.kind);
            return list.length ? (
              <AbilityList
                key={group.kind}
                title={group.title}
                abilities={list}
                useLabel="Usar"
                onUse={permissions.canEditPlay ? activateAbility : undefined}
                onEdit={permissions.canEditSheet ? (ability) => setEditing({ entry: ability, kind: ability.kind }) : undefined}
                choicesFor={group.kind === 'class_feature' ? pendingChoices : undefined}
                onChoose={permissions.canEditSheet ? chooseOption : undefined}
              />
            ) : null;
          })}
          {abilities.some((ability) => ability.kind === 'spell') ? (
            <AbilityList
              title={`Magias${derived.spellDc === null ? '' : ` (CD ${derived.spellDc})`}`}
              abilities={abilities.filter((ability) => ability.kind === 'spell')}
              onEdit={permissions.canEditSheet ? (ability) => setEditing({ entry: ability, kind: 'spell' }) : undefined}
              extra={(ability) => {
                const data = ability.data as { circle?: number; cost?: number };
                return data.circle ? `${data.circle}º círculo · ${data.cost ?? 1} PM` : '';
              }}
              useLabel="Lançar"
              onUse={permissions.canEditPlay ? activateAbility : undefined}
            />
          ) : null}
        </div>
      ) : null}

      {tab === 'inventario' ? (
        <T20Inventory
          characterId={character.id}
          items={items}
          setItems={setItems}
          canEdit={permissions.canEditPlay}
          capacity={derived.carryCapacity}
          money={resource(T20_RESOURCE_KEYS.money)?.current ?? null}
        />
      ) : null}

      {tab === 'evolucao' ? (
        <Card>
          <CardHeader
            title="Evolução"
            description={
              character.campaign
                ? 'Na campanha, o mestre libera o próximo nível e o jogador escolhe as melhorias aqui.'
                : 'Suba de nível escolhendo as melhorias do nível novo.'
            }
          />
          <p className="mb-3 text-sm text-fg-secondary">
            Nível atual:{' '}
            <strong>{sheet.identity.classes.reduce((sum, entry) => sum + entry.level, 0)}</strong> (
            {sheet.identity.classes.map((entry) => `${entry.name} ${entry.level}`).join(' / ')})
          </p>
          <T20LevelUpButton
            characterId={character.id}
            characterName={character.name}
            inCampaign={Boolean(character.campaign)}
            grantedLevel={character.grantedLevel}
            permissions={permissions}
            content={content}
            sheet={sheet}
            version={version}
            resources={resources}
            onDone={(result) => {
              setSheet(result.sheet);
              setVersion(result.version);
              setResources(result.resources);
              setAbilities((current) => [...current, ...result.abilities]);
            }}
          />
        </Card>
      ) : null}

      {tab === 'personagem' && permissions.canEditSheet ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <PortraitCard
              characterId={character.id}
              name={character.name}
              portraitPath={character.portraitPath}
              portraitUrl={character.portraitUrl}
              onVersion={setVersion}
            />
            <ImagePromptCard prompt={characterImagePrompt(imageInput)} />
          </div>
          <div className="flex flex-col gap-3">
            <TokenImageCard characterId={character.id} portraitUrl={character.portraitUrl} />
            <ImagePromptCard variant="token" prompt={characterTokenPrompt(imageInput)} />
          </div>
        </div>
      ) : null}

      {tab === 'personagem' ? props.shareCard : null}

      {tab === 'personagem' && permissions.isOwner && props.campaigns ? (
        <CampaignLinkCard
          characterId={character.id}
          currentCampaign={character.campaign}
          campaigns={props.campaigns}
          initialCampaignId={linkTo}
          issuesFor={(campaign) =>
            t20CampaignIssues({ name: character.name, sheet }, parseT20CampaignRules(campaign.characterRules))
          }
        />
      ) : null}
      {tab === 'personagem' && permissions.isOwner ? (
        <DeleteCharacterCard
          characterId={character.id}
          name={character.name}
          portraitPath={character.portraitPath}
        />
      ) : null}

      {tab === 'personagem' ? (
        <StoryCard
          sheet={sheet}
          canEdit={permissions.canEditSheet}
          onSave={async (identity) => {
            const next = { ...sheet, identity: { ...sheet.identity, ...identity } };
            const saved = await run(
              () =>
                saveCharacterSheet(getSupabaseBrowserClient(), character.id, version, {
                  sheet: next,
                }),
              'Não foi possível salvar',
            );
            if (saved) {
              setSheet(next);
              setVersion(saved.version);
              toast({ tone: 'success', title: 'Ficha salva.' });
            }
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex items-center gap-1 text-[10px] tracking-wider text-fg-muted uppercase">
        <span className="text-wine-300">{icon}</span>
        {label}
      </span>
      <span className="tabular font-display text-2xl leading-none text-fg-accent">{value}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 rounded-xl border border-line bg-charcoal-950/60 py-2.5 backdrop-blur hover:border-wine-400/50"
      title="Rolar"
    >
      {content}
    </button>
  ) : (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-line bg-charcoal-950/60 py-2.5 backdrop-blur">
      {content}
    </div>
  );
}

function TrackCard({
  title,
  icon,
  track,
  canEdit,
  minus,
  plus,
  onMinus,
  onPlus,
  onSetTemp,
  barClass = 'bg-wine-500',
  lowBarClass,
  showBar = true,
  prefix = '',
}: {
  title: string;
  icon?: ReactNode;
  track: CharacterResource | undefined;
  canEdit: boolean;
  minus: string;
  plus: string;
  onMinus: (amount: number) => Promise<void>;
  onPlus: (amount: number) => Promise<void>;
  /** PV temporários: define o valor (0 tira). */
  onSetTemp?: (amount: number) => Promise<void>;
  barClass?: string;
  /** Cor da barra com 25% ou menos. */
  lowBarClass?: string;
  showBar?: boolean;
  /** Antes do valor (ex.: `T$ `). */
  prefix?: string;
}) {
  const [amount, setAmount] = useState('1');
  const [temp, setTemp] = useState('');
  if (!track) return null;
  const value = Math.max(1, Math.min(9999, Number(amount) || 1));
  const percent = track.max
    ? Math.max(0, Math.min(100, Math.round((track.current / track.max) * 100)))
    : 0;
  return (
    <Card>
      <CardHeader icon={icon} title={title} />
      <p className="font-display text-3xl text-fg">
        {prefix}
        {track.current}
        {track.max !== null ? <span className="text-lg text-fg-muted"> / {track.max}</span> : null}
        {track.temp ? (
          <span className="ml-2 text-sm text-fg-accent">+{track.temp} temp.</span>
        ) : null}
      </p>
      {showBar ? (
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sunken ring-1 ring-line">
          <div
            className={cx('h-full transition-[width]', lowBarClass && percent <= 25 ? lowBarClass : barClass)}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={9999}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label={`Quantidade (${title})`}
            className="h-9 w-20 rounded-md border border-line bg-sunken px-2 text-sm text-fg"
          />
          <Button
            size="sm"
            variant="secondary"
            icon={<Minus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void onMinus(value)}
          >
            {minus}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void onPlus(value)}
          >
            {plus}
          </Button>
        </div>
      ) : null}
      {canEdit && onSetTemp ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-fg-muted">Temporários</span>
          <input
            type="number"
            min={0}
            max={999}
            value={temp}
            placeholder={String(track.temp ?? 0)}
            onChange={(event) => setTemp(event.target.value)}
            aria-label={`${title} temporários`}
            className="h-8 w-20 rounded-md border border-line bg-sunken px-2 text-sm text-fg"
          />
          <Button size="sm" variant="ghost" onClick={() => { void onSetTemp(Math.max(0, Math.min(999, Number(temp) || 0))); setTemp(''); }}>
            Definir
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function RestCard({
  level,
  canEdit,
  onRest,
}: {
  level: number;
  canEdit: boolean;
  onRest: (amount: number) => Promise<void>;
}) {
  const [quality, setQuality] = useState<T20RestQuality>('normal');
  if (!canEdit) return null;
  return (
    <Card>
      <CardHeader
        icon={<Moon className="h-5 w-5" aria-hidden="true" />}
        title="Descanso"
        description="Uma noite de descanso recupera PV e PM conforme a qualidade do lugar."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Qualidade do descanso"
          value={quality}
          onChange={(event) => setQuality(event.target.value as T20RestQuality)}
        >
          {(Object.keys(T20_REST_QUALITY) as T20RestQuality[]).map((key) => (
            <option key={key} value={key}>
              {T20_REST_QUALITY[key].label} (+{t20RestRecovery(level, key)})
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={() => void onRest(t20RestRecovery(level, quality))}>
          Descansar
        </Button>
      </div>
    </Card>
  );
}

function ConditionsCard({
  conditions,
  canEdit,
  onApply,
  onRemove,
  onTick,
}: {
  conditions: CharacterCondition[];
  canEdit: boolean;
  onApply: (key: string, rounds: number | null) => Promise<void>;
  onRemove: (condition: CharacterCondition) => Promise<void>;
  onTick: () => Promise<void>;
}) {
  const [choice, setChoice] = useState('');
  const [rounds, setRounds] = useState('');
  const timed = conditions.some((condition) => condition.roundsRemaining !== null);
  return (
    <Card>
      <CardHeader
        title="Condições"
        description="Os efeitos numéricos (Defesa, perícias, deslocamento) já entram na ficha."
      />
      {conditions.length === 0 ? <p className="text-sm text-fg-muted">Nenhuma condição.</p> : null}
      <ul className="flex flex-col gap-2">
        {conditions.map((condition) => {
          const definition = findT20Condition(condition.key);
          return (
            <li
              key={condition.id}
              className="flex items-start justify-between gap-2 rounded-md border border-amber-400/30 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-fg">
                  {definition?.label ?? condition.key}
                  {condition.roundsRemaining !== null ? (
                    <span className="ml-2 text-xs text-amber-300">
                      {condition.roundsRemaining === 1
                        ? '1 rodada'
                        : `${condition.roundsRemaining} rodadas`}
                    </span>
                  ) : null}
                </p>
                {definition ? <p className="text-xs text-fg-muted">{definition.summary}</p> : null}
              </div>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remover ${definition?.label ?? condition.key}`}
                  icon={<X className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => void onRemove(condition)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Select
            aria-label="Condição"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
          >
            <option value="">Aplicar condição…</option>
            {t20Conditions
              .filter(
                (definition) => !conditions.some((condition) => condition.key === definition.key),
              )
              .map((definition) => (
                <option key={definition.key} value={definition.key}>
                  {definition.label}
                </option>
              ))}
          </Select>
          <input
            aria-label="Duração em rodadas (vazio = até remover)"
            inputMode="numeric"
            value={rounds}
            onChange={(event) => setRounds(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            placeholder="Rodadas"
            className="h-9 w-24 rounded-md border border-line bg-sunken px-2 text-sm text-fg placeholder:text-fg-muted"
          />
          <Button
            size="sm"
            disabled={!choice}
            onClick={() =>
              choice &&
              void onApply(choice, rounds && Number(rounds) > 0 ? Number(rounds) : null).then(
                () => {
                  setChoice('');
                  setRounds('');
                },
              )
            }
          >
            Aplicar
          </Button>
          {timed ? (
            <Button size="sm" variant="secondary" onClick={() => void onTick()}>
              Passar rodada
            </Button>
          ) : null}
        </div>
      ) : null}
      {canEdit ? (
        <p className="mt-2 text-xs text-fg-muted">
          Rodadas: deixe vazio para durar até remover. &quot;Passar rodada&quot; tira 1 de cada
          condição e remove as que acabam.
        </p>
      ) : null}
    </Card>
  );
}

function AbilityList({
  title,
  abilities,
  extra,
  onUse,
  useLabel = 'Usar',
  choicesFor,
  onChoose,
  onEdit,
}: {
  title: string;
  abilities: CharacterAbility[];
  extra?: (ability: CharacterAbility) => string;
  onUse?: (ability: CharacterAbility) => void;
  useLabel?: string;
  /** Opções de uma habilidade com escolha ainda não feita (vazio = nada a escolher). */
  choicesFor?: (ability: CharacterAbility) => string[];
  onChoose?: (ability: CharacterAbility, option: string) => void;
  /** Abre o cadastro manual da habilidade (editar ou excluir). */
  onEdit?: (ability: CharacterAbility) => void;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <ul className="flex flex-col gap-1">
        {abilities.map((ability) => (
          <li key={ability.id} className="flex items-start gap-2">
            <details className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm open:bg-raised/40">
              <summary className="cursor-pointer">
                <span className="text-fg">{ability.name}</span>
                <span className="ml-2 text-xs text-fg-muted">
                  {[extra?.(ability), ability.source].filter(Boolean).join(' · ')}
                </span>
              </summary>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-fg-secondary">
                {ability.description}
              </p>
            </details>
            {(() => {
              const options = choicesFor?.(ability) ?? [];
              if (!options.length) return null;
              return (
                <div className="mt-1 flex shrink-0 flex-wrap items-center gap-1" role="group" aria-label={`Escolha de ${ability.name}`}>
                  <span className="text-xs text-amber-300">Escolha:</span>
                  {options.map((option) => (
                    <Button key={option} size="sm" variant="secondary" disabled={!onChoose} onClick={() => onChoose?.(ability, option)}>
                      {option}
                    </Button>
                  ))}
                </div>
              );
            })()}
            {onEdit ? (
              <Button size="icon" variant="ghost" className="mt-1 shrink-0" aria-label={`Editar ${ability.name}`} onClick={() => onEdit(ability)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
            {onUse ? (
              <Button
                size="sm"
                variant="secondary"
                className="mt-1 shrink-0"
                icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                onClick={() => onUse(ability)}
              >
                {useLabel}
                {t20AbilityCost(ability) > 0 ? ` (${t20AbilityCost(ability)} PM)` : ''}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StoryCard({
  sheet,
  canEdit,
  onSave,
}: {
  sheet: T20Sheet;
  canEdit: boolean;
  onSave: (identity: Partial<T20Sheet['identity']>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    height: sheet.identity.height,
    age: sheet.identity.age,
    appearance: sheet.identity.appearance,
    personality: sheet.identity.personality,
    history: sheet.identity.history,
    notes: sheet.identity.notes,
  });
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader
        title="Personagem"
        description={`Livros: ${sheet.identity.sourcebooks.join(', ') || '—'}`}
      />
      {!canEdit ? <Alert tone="info">Somente leitura.</Alert> : null}
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="t20-sheet-height"
            label="Altura"
            maxLength={40}
            value={form.height}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, height: event.target.value })}
          />
          <TextField
            id="t20-sheet-age"
            label="Idade"
            maxLength={40}
            value={form.age}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, age: event.target.value })}
          />
        </div>
        <TextareaField
          id="t20-appearance"
          label="Aparência"
          rows={3}
          maxLength={4000}
          value={form.appearance}
          disabled={!canEdit}
          onChange={(event) => setForm({ ...form, appearance: event.target.value })}
        />
        <TextareaField
          id="t20-personality"
          label="Personalidade"
          rows={3}
          maxLength={4000}
          value={form.personality}
          disabled={!canEdit}
          onChange={(event) => setForm({ ...form, personality: event.target.value })}
        />
        <TextareaField
          id="t20-history"
          label="História"
          rows={6}
          maxLength={8000}
          value={form.history}
          disabled={!canEdit}
          onChange={(event) => setForm({ ...form, history: event.target.value })}
        />
        <TextareaField
          id="t20-notes"
          label="Anotações"
          rows={4}
          maxLength={8000}
          value={form.notes}
          disabled={!canEdit}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
        {canEdit ? (
          <div>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await onSave(form);
                setBusy(false);
              }}
            >
              Salvar
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
