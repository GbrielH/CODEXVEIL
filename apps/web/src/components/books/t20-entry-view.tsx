import {
  T20_SKILLS,
  safeT20BookEntryData,
  t20AttributeLabels,
  t20SizeLabels,
  type T20BookEntryKind,
} from '@codexveil/rpg-systems/tormenta20';
import { BookText } from './book-text';

/** Uma linha "rótulo: valor" (só quando há valor). */
function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function Named({
  title,
  items,
}: {
  title: string;
  items: readonly { name: string; text: string; level?: number; prerequisite?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="eyebrow">{title}</h3>
      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="text-sm">
            <p className="font-medium text-fg-accent">
              {item.level ? `${item.level}º nível · ` : ''}
              {item.name}
            </p>
            <BookText body={item.text} />
            {item.prerequisite ? (
              <p className="mt-1 text-xs text-fg-muted">Pré-requisito: {item.prerequisite}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

const sign = (value: number) => (value >= 0 ? `+${value}` : `–${Math.abs(value)}`);
const skillName = (id: string) => T20_SKILLS[id as keyof typeof T20_SKILLS]?.label ?? id;

/** Conteúdo de uma entrada de livro do Tormenta20, conforme o tipo. */
export function T20BookEntryView({ kind, data }: { kind: string; data: unknown }) {
  const k = kind as T20BookEntryKind;
  switch (k) {
    case 'species': {
      const race = safeT20BookEntryData('species', data);
      if (!race) break;
      const fixed = Object.entries(race.attributes).map(
        ([attr, value]) =>
          `${t20AttributeLabels[attr as keyof typeof t20AttributeLabels].name} ${sign(value)}`,
      );
      const choice = race.attributeChoice
        ? `+${race.attributeChoice.value} em ${race.attributeChoice.count} atributos diferentes${race.attributeChoice.exclude.length ? ` (exceto ${race.attributeChoice.exclude.map((a) => t20AttributeLabels[a].abbreviation).join(', ')})` : ''}`
        : '';
      const variants = race.variants.map(
        (variant) =>
          `${variant.name}: ${Object.entries(variant.attributes)
            .map(
              ([a, v]) =>
                `${t20AttributeLabels[a as keyof typeof t20AttributeLabels].abbreviation} ${sign(v)}`,
            )
            .join(', ')}`,
      );
      return (
        <div className="flex flex-col gap-5">
          <BookText body={race.summary} />
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <Field
              label="Atributos"
              value={[choice, ...fixed, ...variants].filter(Boolean).join('; ')}
            />
            <Field label="Tamanho" value={t20SizeLabels[race.size]} />
            <Field label="Deslocamento" value={`${String(race.speed).replace('.', ',')} m`} />
          </dl>
          <Named title="Habilidades de raça" items={race.abilities} />
        </div>
      );
    }
    case 'class': {
      const klass = safeT20BookEntryData('class', data);
      if (!klass) break;
      return (
        <div className="flex flex-col gap-5">
          <BookText body={klass.summary} />
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <Field
              label="Pontos de vida"
              value={`${klass.pvInitial} + Constituição no 1º nível; ${klass.pvPerLevel} + Constituição por nível`}
            />
            <Field label="Pontos de mana" value={`${klass.pmPerLevel} por nível`} />
            <Field
              label="Perícias"
              value={[
                ...klass.skillsFixed.map(skillName),
                ...klass.skillsFixedChoices.map((options) => options.map(skillName).join(' ou ')),
                klass.skillsChoice.count
                  ? `mais ${klass.skillsChoice.count} entre ${klass.skillsChoice.options.map(skillName).join(', ')}`
                  : '',
              ]
                .filter(Boolean)
                .join(', ')}
            />
            <Field label="Proficiências" value={klass.proficiencies.text} />
            {klass.spellcasting ? (
              <Field
                label="Magias"
                value={`${klass.spellcasting.type === 'arcana' ? 'Arcanas' : 'Divinas'} (${t20AttributeLabels[klass.spellcasting.attribute].name}); círculos nos níveis ${Object.entries(
                  klass.spellcasting.circles,
                )
                  .map(([circle, level]) => `${circle}º: ${level}º`)
                  .join(', ')}`}
              />
            ) : null}
          </dl>
          {Object.keys(klass.table).length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="eyebrow">Progressão</h3>
              <ol className="grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(klass.table)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([level, text]) => (
                    <li key={level}>
                      <span className="tabular text-fg-muted">{level}º</span> {text}
                    </li>
                  ))}
              </ol>
            </section>
          ) : null}
          <Named
            title="Habilidades de classe"
            items={klass.abilities.flatMap((ability) => [
              ability,
              ...ability.options.map((option) => ({
                ...option,
                name: `${ability.name}: ${option.name}`,
              })),
            ])}
          />
          <Named title="Poderes da classe" items={klass.powers} />
          {klass.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-2">
              <h3 className="eyebrow">{section.title}</h3>
              <BookText body={section.text} />
              <Named title="" items={section.entries} />
            </section>
          ))}
        </div>
      );
    }
    case 'background': {
      const origin = safeT20BookEntryData('background', data);
      if (!origin) break;
      return (
        <div className="flex flex-col gap-5">
          <BookText body={origin.summary} />
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <Field label="Itens" value={origin.items} />
            <Field label="Benefícios" value={origin.benefitsText} />
          </dl>
          <Named title="Poder da origem" items={origin.uniquePowers} />
        </div>
      );
    }
    case 'feat': {
      const power = safeT20BookEntryData('feat', data);
      if (!power) break;
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg-muted">
            {power.group === 'concedidos'
              ? 'Poder concedido'
              : power.group === 'classe'
                ? 'Poder de classe'
                : `Poder de ${power.group}`}
            {power.owners.length ? ` · ${power.owners.join(', ')}` : ''}
          </p>
          <BookText body={power.text} />
          {power.prerequisite ? (
            <p className="text-sm text-fg-muted">Pré-requisito: {power.prerequisite}</p>
          ) : null}
        </div>
      );
    }
    case 'spell': {
      const spell = safeT20BookEntryData('spell', data);
      if (!spell) break;
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg-accent">
            {spell.type[0]!.toUpperCase() + spell.type.slice(1)} {spell.circle} ({spell.school})
          </p>
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <Field label="Execução" value={spell.execution} />
            <Field label="Alcance" value={spell.range} />
            <Field label="Alvo" value={spell.target} />
            <Field label="Área" value={spell.area} />
            <Field label="Efeito" value={spell.effect} />
            <Field label="Duração" value={spell.duration} />
            <Field label="Resistência" value={spell.resistance} />
          </dl>
          <BookText body={spell.text} />
          <Named
            title="Aprimoramentos"
            items={spell.upgrades.map((upgrade) => ({
              name: `+${upgrade.cost} PM`,
              text: upgrade.text,
            }))}
          />
        </div>
      );
    }
    case 'deity': {
      const deity = safeT20BookEntryData('deity', data);
      if (!deity) break;
      return (
        <div className="flex flex-col gap-4">
          <BookText body={deity.summary} />
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <Field label="Energia" value={deity.energy} />
            <Field label="Poderes concedidos" value={deity.grantedPowers.join(', ')} />
            {Object.entries(deity.details).map(([label, value]) => (
              <Field key={label} label={label} value={value} />
            ))}
          </dl>
        </div>
      );
    }
    case 'equipment': {
      const item = safeT20BookEntryData('equipment', data);
      if (!item) break;
      return (
        <div className="flex flex-col gap-4">
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <Field label="Categoria" value={item.category} />
            <Field label="Preço" value={item.price} />
            <Field label="Espaços" value={item.spaces} />
            <Field label="Dano" value={item.damage} />
            <Field label="Crítico" value={item.critical} />
            <Field label="Alcance" value={item.range} />
            <Field label="Tipo de dano" value={item.damageType} />
            <Field
              label="Bônus na Defesa"
              value={item.defense !== undefined ? `+${item.defense}` : ''}
            />
            <Field
              label="Penalidade de armadura"
              value={item.penalty !== undefined ? item.penalty : ''}
            />
            <Field label="Efeito" value={item.effect} />
          </dl>
          <BookText body={item.text} />
        </div>
      );
    }
    case 'magic_item': {
      const item = safeT20BookEntryData('magic_item', data);
      if (!item) break;
      return (
        <div className="flex flex-col gap-4">
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <Field label="Tipo" value={item.kind.replace(/-/g, ' ')} />
            <Field label="Preço" value={item.price} />
            <Field label="Efeito" value={item.effect} />
          </dl>
          <BookText body={item.text} />
        </div>
      );
    }
    case 'monster': {
      const threat = safeT20BookEntryData('monster', data);
      if (!threat) break;
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg-accent">
            {threat.type} · ND {threat.challenge}
          </p>
          <BookText body={threat.description} />
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <Field label="Iniciativa" value={threat.senses} />
            <Field label="Defesa" value={threat.defenseNotes || threat.defense} />
            <Field label="Pontos de vida" value={threat.hitPoints} />
            <Field label="Pontos de mana" value={threat.manaPoints} />
            <Field label="Deslocamento" value={threat.speed} />
            <Field label="Corpo a corpo" value={threat.melee} />
            <Field label="À distância" value={threat.ranged} />
            <Field
              label="Atributos"
              value={Object.entries(threat.attributes)
                .map(
                  ([a, v]) =>
                    `${t20AttributeLabels[a as keyof typeof t20AttributeLabels].abbreviation} ${v === null ? '—' : sign(v)}`,
                )
                .join(', ')}
            />
            <Field label="Perícias" value={threat.skills} />
            <Field label="Equipamento" value={threat.equipment} />
            <Field label="Tesouro" value={threat.treasure} />
          </dl>
          <Named title="Habilidades" items={threat.abilities} />
        </div>
      );
    }
    case 'section': {
      const section = safeT20BookEntryData('section', data);
      if (!section) break;
      return <BookText body={section.body} />;
    }
  }
  return <p className="text-sm text-fg-muted">Esta entrada não pôde ser exibida.</p>;
}
