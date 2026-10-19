import {
  abilityLabels,
  bookMonsterToStatBlock,
  featCategoryLabels,
  findClass,
  formatDistance,
  safeBookEntryData,
  skillDefinitions,
  spellListLabel,
  spellNamePt,
  spellSchoolLabels,
  srdSpellNameFor,
  type BookEntryKind,
  type BookFeature,
} from '@codexveil/rpg-systems/dnd5e';
import type { ReactNode } from 'react';
import { StatBlockView } from '@/components/library/stat-block-view';
import { Alert } from '@/components/ui/alert';
import { BookParagraphs, BookText } from './book-text';

/** Uma entrada do livro, conforme o tipo. Conteúdo que não segue o formato vira um aviso. */
export function BookEntryView({ kind, name, data }: { kind: BookEntryKind; name: string; data: unknown }) {
  const content = renderEntry(kind, name, data);
  return content ?? <Alert tone="warning">Esta entrada não segue o formato do pacote e não pode ser exibida. Importe o livro de novo.</Alert>;
}

function renderEntry(kind: BookEntryKind, name: string, raw: unknown): ReactNode | null {
  switch (kind) {
    case 'section': {
      const data = safeBookEntryData('section', raw);
      return data ? <BookText body={data.body} /> : null;
    }
    case 'class': {
      const data = safeBookEntryData('class', raw);
      if (!data) return null;
      return (
        <div className="flex flex-col gap-5">
          {data.summary ? <BookText body={data.summary} /> : null}
          <Facts
            items={[
              ['Dado de vida', data.hitDie],
              ['Atributo principal', data.primaryAbilities.map((ability) => abilityLabels[ability].name).join(' e ')],
              ['Testes de resistência', data.savingThrows.map((ability) => abilityLabels[ability].name).join(' e ')],
              [
                'Perícias',
                data.skillChoices.count
                  ? `Escolha ${data.skillChoices.count}: ${data.skillChoices.options.map((skill) => skillDefinitions[skill].label).join(', ')}`
                  : '',
              ],
              ['Armaduras', data.armor.map((armor) => ({ light: 'leves', medium: 'médias', heavy: 'pesadas', shield: 'escudos' })[armor]).join(', ')],
              ['Armas', data.weapons.martial === 'none' ? 'Simples' : 'Simples e marciais'],
              ['Ferramentas', data.tools],
              ['Equipamento inicial', data.equipment],
              ['Subclasse', data.subclassLabel ? `${data.subclassLabel} (${data.subclassLevel}º nível)` : `${data.subclassLevel}º nível`],
              [
                'Conjuração',
                data.spellcasting
                  ? `${abilityLabels[data.spellcasting.ability].name} · lista ${spellListLabel(data.spellcasting.list)} · ${
                      { full: 'conjurador completo', half: 'meio conjurador', pact: 'magia de pacto' }[data.spellcasting.progression]
                    }`
                  : '',
              ],
            ]}
          />
          <Features title="Habilidades" features={data.features} />
        </div>
      );
    }
    case 'subclass': {
      const data = safeBookEntryData('subclass', raw);
      if (!data) return null;
      return (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-fg-muted">Subclasse de {findClass(data.classId)?.name ?? data.classId}.</p>
          {data.summary ? <BookText body={data.summary} /> : null}
          <Features title="Habilidades" features={data.features} />
          {data.alwaysPrepared.length > 0 ? (
            <section>
              <h3 className="eyebrow mb-2">Magias sempre preparadas</h3>
              <ul className="flex flex-col gap-1 text-sm text-fg-secondary">
                {data.alwaysPrepared.map((group) => (
                  <li key={group.level}>
                    <span className="font-medium text-fg">{group.level}º nível:</span> {group.spells.map(spellLabel).join(', ')}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      );
    }
    case 'species': {
      const data = safeBookEntryData('species', raw);
      if (!data) return null;
      return (
        <div className="flex flex-col gap-5">
          {data.summary ? <BookText body={data.summary} /> : null}
          <Facts
            items={[
              ['Tipo de criatura', data.creatureType],
              ['Tamanho', data.sizes.map((size) => ({ small: 'Pequeno', medium: 'Médio' })[size]).join(' ou ')],
              ['Deslocamento', formatDistance(data.speed, 'm')],
              ['Truques', data.cantrips.map(spellLabel).join(', ')],
            ]}
          />
          <Features title="Traços" features={data.traits} />
          {data.lineage ? (
            <section>
              <h3 className="eyebrow mb-2">{data.lineage.label}</h3>
              <ul className="flex flex-col gap-3">
                {data.lineage.options.map((option) => (
                  <li key={option.id} className="rounded-md border border-line bg-card/60 p-3">
                    <p className="font-medium text-fg">{option.name}</p>
                    {option.description ? <BookText body={option.description} className="mt-1 flex flex-col gap-2 text-sm text-fg-secondary" /> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      );
    }
    case 'background': {
      const data = safeBookEntryData('background', raw);
      if (!data) return null;
      return (
        <div className="flex flex-col gap-5">
          {data.summary ? <BookText body={data.summary} /> : null}
          <Facts
            items={[
              ['Perícias', data.skills.map((skill) => skillDefinitions[skill].label).join(' e ')],
              ['Ferramentas', data.tools],
              ['Idiomas', data.languages],
              ['Equipamento', data.equipment],
            ]}
          />
          {data.feature?.name ? (
            <section>
              <h3 className="eyebrow mb-1">{data.feature.name}</h3>
              <BookText body={data.feature.description} />
            </section>
          ) : null}
          <p className="text-xs text-fg-subtle">
            Nas regras de 2024, antecedentes de livros antigos aumentam atributos à escolha e dão um talento de origem escolhido pelo jogador.
          </p>
        </div>
      );
    }
    case 'feat': {
      const data = safeBookEntryData('feat', raw);
      if (!data) return null;
      return (
        <div className="flex flex-col gap-4">
          <Facts
            items={[
              ['Categoria', featCategoryLabels[data.category]],
              ['Pré-requisito', data.prerequisite],
              ['Aumento de atributo', data.abilityIncrease.map((ability) => abilityLabels[ability].name).join(' ou ')],
              ['Repetível', data.repeatable ? 'Sim' : ''],
            ]}
          />
          <BookText body={data.description} />
        </div>
      );
    }
    case 'spell': {
      const data = safeBookEntryData('spell', raw);
      if (!data) return null;
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg-muted">
            {data.level === 0 ? 'Truque' : `${data.level}º círculo`} de {spellSchoolLabels[data.school].toLowerCase()}
            {data.ritual ? ' (ritual)' : ''}
          </p>
          <Facts
            items={[
              ['Tempo de conjuração', data.castingTime],
              ['Alcance', data.range],
              ['Componentes', data.components],
              ['Duração', data.duration],
              ['Listas', data.classes.map(spellListLabel).join(', ')],
              ['Original', data.original],
            ]}
          />
          <BookParagraphs paragraphs={data.description} />
        </div>
      );
    }
    case 'spell_list': {
      const data = safeBookEntryData('spell_list', raw);
      if (!data) return null;
      const levels = [...new Set(data.spells.map((spell) => spell.level))].sort((a, b) => a - b);
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg-muted">Magias acrescentadas à lista de {spellListLabel(data.list)}.</p>
          {levels.map((level) => (
            <section key={level}>
              <h3 className="eyebrow mb-1">{level === 0 ? 'Truques' : `${level}º círculo`}</h3>
              <p className="text-sm text-fg-secondary">
                {data.spells
                  .filter((spell) => spell.level === level)
                  .map((spell) => spellLabel(spell.name))
                  .join(', ')}
              </p>
            </section>
          ))}
        </div>
      );
    }
    case 'monster': {
      const data = safeBookEntryData('monster', raw);
      if (!data) return null;
      return (
        <div className="flex flex-col gap-4">
          <StatBlockView name={name} statBlock={bookMonsterToStatBlock(data)} />
          {data.lore.length > 0 ? <BookParagraphs paragraphs={data.lore} /> : null}
        </div>
      );
    }
    case 'magic_item': {
      const data = safeBookEntryData('magic_item', raw);
      if (!data) return null;
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg-muted italic">
            {[data.type, data.rarity].filter(Boolean).join(', ')}
            {data.attunement ? ` (${data.attunement})` : ''}
          </p>
          <BookParagraphs paragraphs={data.description} />
        </div>
      );
    }
    default:
      return null;
  }
}

/** Nome da magia em português quando é do SRD ("Fireball" → "Bola de Fogo"). */
function spellLabel(name: string): string {
  const srd = srdSpellNameFor(name);
  return srd ? spellNamePt(srd) : name;
}

function Facts({ items }: { items: [string, string][] }) {
  const shown = items.filter(([, value]) => value);
  if (shown.length === 0) return null;
  return (
    <dl className="grid gap-x-4 gap-y-1.5 rounded-md border border-line bg-card/60 p-4 text-sm sm:grid-cols-[auto_1fr]">
      {shown.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-fg-muted">{label}</dt>
          <dd className="text-fg-secondary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Features({ title, features }: { title: string; features: readonly BookFeature[] }) {
  if (features.length === 0) return null;
  return (
    <section>
      <h3 className="eyebrow mb-2">{title}</h3>
      <ul className="flex flex-col gap-3">
        {[...features]
          .sort((a, b) => a.level - b.level)
          .map((feature, index) => (
            <li key={`${feature.level}-${feature.name}-${index}`} className="rounded-md border border-line bg-card/60 p-3">
              <p className="font-medium text-fg">
                <span className="mr-2 text-xs text-fg-accent tabular">{feature.level}º</span>
                {feature.name}
              </p>
              {feature.description ? <BookText body={feature.description} className="mt-1 flex flex-col gap-2 text-sm text-fg-secondary" /> : null}
            </li>
          ))}
      </ul>
    </section>
  );
}
