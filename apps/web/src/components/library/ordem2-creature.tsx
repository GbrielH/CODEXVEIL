import {
  ordem2AttributeLabels,
  ordem2SkillLabel,
  type Ordem2Setting,
  type Ordem2StatBlock,
} from '@codexveil/rpg-systems/ordem2';
import { Card, CardHeader } from '@/components/ui/card';

/**
 * Ficha de criatura ou NPC do Ordem Paranormal 2 (como nos quadros das missões). `only` limita
 * às partes que o mestre revelou aos jogadores.
 */
export function Ordem2CreatureView({
  name,
  stats,
  setting = 'medieval',
  only,
}: {
  name?: string;
  stats: Ordem2StatBlock;
  setting?: Ordem2Setting;
  only?: ReadonlySet<string>;
}) {
  const show = (key: string) => !only || only.has(key);
  const body = (
    <div className="flex flex-col gap-3 text-sm">
      {show('description') && stats.description ? (
        <p className="italic text-fg-secondary">{stats.description}</p>
      ) : null}
      {show('hitPoints') || show('attributes') ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          {show('hitPoints') ? (
            <span>
              <strong className="text-fg">PV</strong> {stats.hitPoints}
              {stats.armor ? ` · armadura ${stats.armor}` : ''}
            </span>
          ) : null}
          {show('attributes')
            ? (['fisico', 'mente', 'emocao'] as const).map((key) => (
                <span key={key}>
                  <strong className="text-fg">{ordem2AttributeLabels[key]}</strong> d
                  {stats.attributes[key]}
                </span>
              ))
            : null}
        </p>
      ) : null}
      {show('skills') && stats.skills.length ? (
        <p>
          {stats.skills
            .map((skill) => `${ordem2SkillLabel(skill.key, setting)} d${skill.die}`)
            .join(', ')}
        </p>
      ) : null}
      {show('actions')
        ? stats.actions.map((action, index) => (
            <p key={`a${index}`}>
              <strong className="text-fg">{action.name}</strong> (
              {action.kind === 'distancia'
                ? 'à distância'
                : action.kind === 'geral'
                  ? 'geral'
                  : 'corpo a corpo'}
              ) {action.dice}
              {action.damage ? ` · dano ${action.damage}` : ''}
            </p>
          ))
        : null}
      {show('abilities')
        ? stats.abilities.map((ability, index) => (
            <p key={`h${index}`}>
              <strong className="text-fg">{ability.name}.</strong> {ability.text}
            </p>
          ))
        : null}
      {show('strategy') && stats.strategy ? (
        <p className="text-fg-secondary">
          <strong className="text-fg">Estratégia.</strong> {stats.strategy}
        </p>
      ) : null}
    </div>
  );
  if (!name)
    return <section className="rounded-md border border-line bg-sunken p-4">{body}</section>;
  return (
    <Card>
      <CardHeader title={name} description="Ficha (Ordem Paranormal 2)" />
      {body}
    </Card>
  );
}
