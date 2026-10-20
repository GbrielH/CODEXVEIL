import {
  ABILITIES,
  abilityLabels,
  abilityModifier,
  creatureSizeLabels,
  experienceForChallenge,
  formatModifier,
  proficiencyBonusForChallenge,
  type Dnd5eStatBlock,
} from '@codexveil/rpg-systems/dnd5e';

/** Bloco de estatísticas de D&D 5e para consulta rápida (somente mestres o recebem). */
export function StatBlockView({ name, statBlock }: { name: string; statBlock: Dnd5eStatBlock }) {
  const proficiency = proficiencyBonusForChallenge(statBlock.challengeRating);
  const xp = experienceForChallenge(statBlock.challengeRating);
  const lines: [string, string][] = [
    ['Testes de resistência', statBlock.savingThrows],
    ['Perícias', statBlock.skills],
    ['Resistências a dano', statBlock.damageResistances],
    ['Imunidades a dano', statBlock.damageImmunities],
    ['Imunidades a condições', statBlock.conditionImmunities],
    ['Sentidos', statBlock.senses],
    ['Idiomas', statBlock.languages],
  ];
  const sections = [
    ['Características', statBlock.traits],
    ['Ações', statBlock.actions],
    ['Ações bônus', statBlock.bonusActions],
    ['Reações', statBlock.reactions],
    ['Ações lendárias', statBlock.legendaryActions],
  ] as const;

  return (
    <section
      aria-label={`Estatísticas de ${name}`}
      className="parchment ornate rounded-lg px-5 py-4 text-ink"
    >
      <h3 className="font-display text-xl text-wine-800">{name}</h3>
      <p className="text-sm italic text-ink-muted">
        {creatureSizeLabels[statBlock.size]}
        {statBlock.creatureType ? ` ${statBlock.creatureType.toLowerCase()}` : ''}
        {statBlock.alignment ? `, ${statBlock.alignment}` : ''}
      </p>
      <hr className="my-2 border-wine-700/40" />
      <dl className="grid gap-1 text-sm">
        <div>
          <dt className="inline font-semibold">CA </dt>
          <dd className="inline">
            {statBlock.armorClass}
            {statBlock.armorNote ? ` (${statBlock.armorNote})` : ''}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">PV </dt>
          <dd className="inline">
            {statBlock.hitPoints}
            {statBlock.hitPointFormula ? ` (${statBlock.hitPointFormula})` : ''}
          </dd>
        </div>
        {statBlock.speed ? (
          <div>
            <dt className="inline font-semibold">Deslocamento </dt>
            <dd className="inline">{statBlock.speed}</dd>
          </div>
        ) : null}
      </dl>
      <hr className="my-2 border-wine-700/40" />
      <dl className="grid grid-cols-6 gap-1 text-center text-sm">
        {ABILITIES.map((ability) => (
          <div key={ability}>
            <dt className="font-semibold">{abilityLabels[ability].abbreviation}</dt>
            <dd className="tabular">
              {statBlock.abilities[ability]} (
              {formatModifier(abilityModifier(statBlock.abilities[ability]))})
            </dd>
          </div>
        ))}
      </dl>
      <hr className="my-2 border-wine-700/40" />
      <dl className="grid gap-1 text-sm">
        {lines
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="inline font-semibold">{label} </dt>
              <dd className="inline">{value}</dd>
            </div>
          ))}
        <div>
          <dt className="inline font-semibold">Nível de desafio </dt>
          <dd className="inline">
            {statBlock.challengeRating}
            {xp !== null ? ` (${xp.toLocaleString('pt-BR')} XP)` : ''}
            {proficiency !== null ? ` · proficiência +${proficiency}` : ''}
          </dd>
        </div>
      </dl>
      {sections
        .filter(([, entries]) => entries.length > 0)
        .map(([title, entries]) => (
          <div key={title} className="mt-3">
            <h4 className="border-b border-wine-700/40 font-display text-base text-wine-800">
              {title}
            </h4>
            <ul className="mt-1 flex flex-col gap-1.5 text-sm">
              {entries.map((entry, index) => (
                <li key={index}>
                  <strong className="italic">{entry.name}.</strong>{' '}
                  <span className="whitespace-pre-line">{entry.description}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}
